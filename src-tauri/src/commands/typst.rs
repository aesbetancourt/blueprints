//! Typst compilation for `.typ` files in the vault.
//!
//! The compiler runs in-process. The vault folder is the project root, so
//! relative imports and images resolve against vault files. One world is kept
//! alive between calls so that Typst can reuse its incremental cache.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;
use typst::diag::{FileResult, Severity, SourceDiagnostic, Warned};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World, WorldExt};
use typst_kit::datetime::Time;
use typst_kit::downloader::SystemDownloader;
use typst_kit::files::{FileLoader, FileStore, FsRoot, SystemFiles};
use typst_kit::fonts::{self, FontStore};
use typst_kit::packages::SystemPackages;
use typst_layout::PagedDocument;

use super::files::{get_vault_root, validate_path};

/// Number of compilations after which unused cache entries are dropped.
const CACHE_MAX_AGE: usize = 10;

/// Holds the compiler world between calls.
#[derive(Default)]
pub struct TypstState(Arc<Mutex<Option<VaultWorld>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypstDiagnostic {
    /// "error" or "warning".
    severity: &'static str,
    message: String,
    hints: Vec<String>,
    /// UTF-16 start offset in the edited source. Set only for the main file.
    from: Option<usize>,
    /// UTF-16 end offset in the edited source. Set only for the main file.
    to: Option<usize>,
    /// One-based line number in `file`.
    line: Option<usize>,
    /// One-based column number in `file`.
    column: Option<usize>,
    /// Vault-relative path or package path. `None` for the main file.
    file: Option<String>,
}

#[derive(Serialize)]
pub struct TypstCompileResult {
    /// One SVG document per page. Empty when compilation failed.
    pages: Vec<String>,
    diagnostics: Vec<TypstDiagnostic>,
}

/// Compiles unsaved Typst `source` for the file at `path` into SVG pages.
#[tauri::command]
pub async fn compile_typst(
    path: String,
    source: String,
    state: tauri::State<'_, crate::AppState>,
    typst: tauri::State<'_, TypstState>,
) -> Result<TypstCompileResult, String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    let slot = typst.0.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = slot.lock().map_err(|e| e.to_string())?;
        let world = prepare_world(&mut guard, &vault_root, &path, source)?;
        let Warned { output, warnings } = typst::compile::<PagedDocument>(&*world);
        let mut diagnostics: Vec<_> = Vec::new();
        let pages = match output {
            Ok(doc) => doc
                .pages()
                .iter()
                .map(|page| typst_svg::svg(page, &typst_svg::SvgOptions::default()))
                .collect(),
            Err(errors) => {
                diagnostics.extend(errors.iter().map(|d| to_diagnostic(world, d)));
                Vec::new()
            }
        };
        diagnostics.extend(warnings.iter().map(|d| to_diagnostic(world, d)));
        comemo::evict(CACHE_MAX_AGE);
        Ok(TypstCompileResult { pages, diagnostics })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Compiles unsaved Typst `source` for the file at `path` and writes a PDF to `out_path`.
#[tauri::command]
pub async fn export_typst_pdf(
    path: String,
    source: String,
    out_path: String,
    state: tauri::State<'_, crate::AppState>,
    typst: tauri::State<'_, TypstState>,
) -> Result<(), String> {
    let vault_root = get_vault_root(&state)?;
    validate_path(&path, &vault_root)?;
    let slot = typst.0.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = slot.lock().map_err(|e| e.to_string())?;
        let world = prepare_world(&mut guard, &vault_root, &path, source)?;
        let doc = typst::compile::<PagedDocument>(&*world)
            .output
            .map_err(|errors| summarize(world, &errors))?;
        let pdf = typst_pdf::pdf(&doc, &typst_pdf::PdfOptions::default())
            .map_err(|errors| summarize(world, &errors))?;
        std::fs::write(&out_path, pdf).map_err(|e| format!("Failed to write PDF: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Makes the world ready to compile `source` as the file at `path`.
///
/// Creates a new world when none exists or the vault changed.
fn prepare_world<'a>(
    slot: &'a mut Option<VaultWorld>,
    vault_root: &str,
    path: &str,
    source: String,
) -> Result<&'a mut VaultWorld, String> {
    let root = PathBuf::from(vault_root);
    if slot.as_ref().is_none_or(|w| w.root != root) {
        *slot = Some(VaultWorld::new(root));
    }
    let world = slot.as_mut().expect("world was just created");
    let vpath = VirtualPath::virtualize(&world.root, Path::new(path))
        .map_err(|e| format!("Invalid Typst path: {:?}", e))?;
    world.main = RootedPath::new(VirtualRoot::Project, vpath).intern();
    world.files.loader_mut().overlay = Some((world.main, Bytes::from_string(source)));
    world.files.reset();
    world.time.reset();
    Ok(world)
}

/// Returns the shared font store. Scans system fonts on first use.
fn font_store() -> Arc<FontStore> {
    static FONTS: OnceLock<Arc<FontStore>> = OnceLock::new();
    FONTS
        .get_or_init(|| {
            let mut store = FontStore::new();
            store.extend(fonts::system());
            store.extend(fonts::embedded());
            Arc::new(store)
        })
        .clone()
}

/// Loads vault and package files, but serves the unsaved editor text for the main file.
struct VaultFiles {
    inner: SystemFiles,
    overlay: Option<(FileId, Bytes)>,
}

impl FileLoader for VaultFiles {
    fn load(&self, id: FileId) -> FileResult<Bytes> {
        match &self.overlay {
            Some((main, bytes)) if *main == id => Ok(bytes.clone()),
            _ => self.inner.load(id),
        }
    }
}

struct VaultWorld {
    root: PathBuf,
    library: LazyHash<Library>,
    fonts: Arc<FontStore>,
    files: FileStore<VaultFiles>,
    main: FileId,
    time: Time,
}

impl VaultWorld {
    fn new(root: PathBuf) -> Self {
        let downloader = SystemDownloader::new(concat!("blueprints/", env!("CARGO_PKG_VERSION")));
        let inner = SystemFiles::new(FsRoot::new(root.clone()), SystemPackages::new(downloader));
        let placeholder = VirtualPath::new("main.typ").expect("static path is valid");
        Self {
            root,
            library: LazyHash::new(Library::default()),
            fonts: font_store(),
            files: FileStore::new(VaultFiles {
                inner,
                overlay: None,
            }),
            main: RootedPath::new(VirtualRoot::Project, placeholder).intern(),
            time: Time::system(),
        }
    }
}

impl World for VaultWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        self.files.source(id)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.time.today(offset)
    }
}

fn to_diagnostic(world: &VaultWorld, diag: &SourceDiagnostic) -> TypstDiagnostic {
    let mut out = TypstDiagnostic {
        severity: match diag.severity {
            Severity::Error => "error",
            Severity::Warning => "warning",
        },
        message: diag.message.to_string(),
        hints: diag.hints.iter().map(|h| h.v.to_string()).collect(),
        from: None,
        to: None,
        line: None,
        column: None,
        file: None,
    };

    let (Some(id), Some(range)) = (diag.span.id(), world.range(diag.span)) else {
        return out;
    };
    let Ok(source) = world.source(id) else {
        return out;
    };
    let lines = source.lines();
    if let Some((line, column)) = lines.byte_to_line_column(range.start) {
        out.line = Some(line + 1);
        out.column = Some(column + 1);
    }
    if id == world.main {
        out.from = lines.byte_to_utf16(range.start);
        out.to = lines.byte_to_utf16(range.end);
    } else {
        out.file = Some(describe_file(id));
    }
    out
}

fn describe_file(id: FileId) -> String {
    let path = id.get().vpath().get_without_slash().to_string();
    match id.get().root() {
        VirtualRoot::Project => path,
        VirtualRoot::Package(spec) => format!("{}/{}", spec, path),
    }
}

/// Joins errors into one message for commands that return a plain string.
fn summarize(world: &VaultWorld, errors: &[SourceDiagnostic]) -> String {
    errors
        .iter()
        .map(|d| {
            let diag = to_diagnostic(world, d);
            match diag.line {
                Some(line) => format!("Line {}: {}", line, diag.message),
                None => diag.message,
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_vault(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("blueprints-typst-{}-{}", name, std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn compile(
        slot: &mut Option<VaultWorld>,
        root: &Path,
        file: &str,
        source: &str,
    ) -> TypstCompileResult {
        let path = root.join(file);
        let world = prepare_world(
            slot,
            root.to_str().unwrap(),
            path.to_str().unwrap(),
            source.into(),
        )
        .unwrap();
        let Warned { output, warnings } = typst::compile::<PagedDocument>(&*world);
        let mut diagnostics: Vec<_> = warnings.iter().map(|d| to_diagnostic(world, d)).collect();
        let pages = match output {
            Ok(doc) => doc
                .pages()
                .iter()
                .map(|p| typst_svg::svg(p, &Default::default()))
                .collect(),
            Err(errors) => {
                diagnostics.extend(errors.iter().map(|d| to_diagnostic(world, d)));
                Vec::new()
            }
        };
        TypstCompileResult { pages, diagnostics }
    }

    #[test]
    fn compiles_unsaved_source_with_vault_import() {
        let root = temp_vault("import");
        std::fs::write(root.join("lib.typ"), "#let greet(name) = [Hello, #name!]").unwrap();
        let mut slot = None;
        let result = compile(
            &mut slot,
            &root,
            "doc.typ",
            "#import \"lib.typ\": greet\n#greet(\"vault\")\n#pagebreak()\nTwo",
        );
        assert!(result.diagnostics.iter().all(|d| d.severity != "error"));
        assert_eq!(result.pages.len(), 2);
        assert!(result.pages[0].starts_with("<svg"));
    }

    #[test]
    fn reports_error_range_in_utf16() {
        let root = temp_vault("error");
        let mut slot = None;
        let source = "é #undefined_fn()";
        let result = compile(&mut slot, &root, "doc.typ", source);
        assert!(result.pages.is_empty());
        let err = result
            .diagnostics
            .iter()
            .find(|d| d.severity == "error")
            .unwrap();
        // The error starts at `undefined_fn`: UTF-16 offset 3, byte offset 4.
        assert_eq!(err.from, Some(3));
        assert_eq!(err.line, Some(1));
    }

    #[test]
    fn recompiles_after_edit() {
        let root = temp_vault("edit");
        let mut slot = None;
        assert_eq!(compile(&mut slot, &root, "doc.typ", "One").pages.len(), 1);
        assert_eq!(
            compile(&mut slot, &root, "doc.typ", "One #pagebreak() Two")
                .pages
                .len(),
            2
        );
        assert_eq!(
            compile(&mut slot, &root, "other.typ", "Other").pages.len(),
            1
        );
    }
}
