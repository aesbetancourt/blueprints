import { useState, useEffect, useRef, useMemo } from 'react';
import { ZoomIn, ZoomOut, FileDown, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDarkTheme } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { save } from '@tauri-apps/plugin-dialog';
import { open } from '@tauri-apps/plugin-shell';
import { TypstService, type TypstDiagnostic } from '../services/typst';
import { useToastStore } from '../components/Toast';
import { typstDark } from './typstLanguage';

/** Wait this long after the last keystroke before compiling. */
const COMPILE_DEBOUNCE_MS = 200;

const clampZoom = (z: number) => Math.min(Math.max(z, 0.25), 4);

interface TypstEditorProps {
  filePath: string;
  content: string;
  onChange: (content: string) => void;
}

export function TypstEditor({ filePath, content, onChange }: TypstEditorProps) {
  const [value, setValue] = useState(content);
  const [pages, setPages] = useState<string[] | null>(null);
  const [diagnostics, setDiagnosticsState] = useState<TypstDiagnostic[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [collapsedPane, setCollapsedPane] = useState<'none' | 'editor' | 'preview'>('none');
  const viewRef = useRef<EditorView | null>(null);
  const requestRef = useRef(0);
  const { addToast } = useToastStore();

  const extensions = useMemo(() => [EditorView.lineWrapping, typstDark(), lintGutter()], []);

  const editorVisible = collapsedPane !== 'editor';
  const previewVisible = collapsedPane !== 'preview';
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.length - errorCount;

  // Compile after typing pauses. Results of older requests are dropped.
  useEffect(() => {
    const id = ++requestRef.current;
    const timer = setTimeout(() => {
      setCompiling(true);
      TypstService.compile(filePath, value)
        .then((result) => {
          if (id !== requestRef.current) return;
          // Keep the last good pages on screen while the source has errors
          if (result.pages.length > 0) setPages(result.pages);
          setDiagnosticsState(result.diagnostics);
          setFailure(null);
        })
        .catch((err: unknown) => {
          if (id === requestRef.current) setFailure(String(err));
        })
        .finally(() => {
          if (id === requestRef.current) setCompiling(false);
        });
    }, COMPILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filePath, value]);

  // Underline problems in the source
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const length = view.state.doc.length;
    const marks: Diagnostic[] = diagnostics.flatMap((d) => {
      if (d.from == null || d.to == null) return [];
      const from = Math.min(d.from, length);
      return {
        from,
        to: Math.min(Math.max(d.to, from), length),
        severity: d.severity,
        message: [d.message, ...d.hints.map((h) => `hint: ${h}`)].join('\n'),
      };
    });
    view.dispatch(setDiagnostics(view.state, marks));
  }, [diagnostics]);

  const jumpTo = (d: TypstDiagnostic) => {
    const view = viewRef.current;
    if (!view || d.from == null) return;
    view.dispatch({
      selection: { anchor: Math.min(d.from, view.state.doc.length) },
      scrollIntoView: true,
    });
    view.focus();
  };

  const handleExport = async () => {
    const outPath = await save({
      defaultPath: filePath.replace(/\.typ$/i, '.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!outPath) return;
    setExporting(true);
    try {
      await TypstService.exportPdf(filePath, value, outPath);
      addToast(`Exported ${outPath.split('/').pop()}`, 'success');
    } catch (err) {
      addToast(`PDF export failed: ${err}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Links inside the preview must not navigate the app window
  const handlePreviewClick = (e: React.MouseEvent) => {
    const anchor = (e.target as Element).closest('a');
    if (!anchor) return;
    e.preventDefault();
    const href = anchor.getAttribute('href') ?? anchor.getAttribute('xlink:href') ?? '';
    if (/^https?:\/\//.test(href)) open(href);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => clampZoom(z * factor));
    }
  };

  const paneToggleClass = (active: boolean) =>
    `px-2.5 py-1 text-xs font-medium rounded transition-colors ${
      active ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-secondary hover:bg-surface-3'
    }`;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-default bg-surface-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsedPane((p) => (p === 'preview' ? 'none' : 'preview'))}
            className={paneToggleClass(collapsedPane === 'preview')}
            title={collapsedPane === 'preview' ? 'Show preview' : 'Hide preview'}
          >
            Editor
          </button>
          <button
            onClick={() => setCollapsedPane((p) => (p === 'editor' ? 'none' : 'editor'))}
            className={paneToggleClass(collapsedPane === 'editor')}
            title={collapsedPane === 'editor' ? 'Show editor' : 'Hide editor'}
          >
            Preview
          </button>
        </div>

        <div className="mx-2 w-px h-4 bg-default" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => clampZoom(z / 1.25))}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-1.5 py-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary text-xs font-mono min-w-[3rem] text-center"
            title="Fit page width"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((z) => clampZoom(z * 1.25))}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {compiling && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Loader2 size={11} className="animate-spin" />
              Compiling
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              {errorCount} {errorCount === 1 ? 'error' : 'errors'}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
            </span>
          )}
          {pages && (
            <span className="text-xs text-muted">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'}
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={exporting || errorCount > 0}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-surface-2 text-secondary hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed"
            title={errorCount > 0 ? 'Fix errors to export' : 'Export as PDF'}
          >
            <FileDown size={12} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Panes */}
      <div className="flex flex-1 min-h-0">
        {/* Source pane */}
        {editorVisible && (
          <div
            className={`flex flex-col border-r border-default ${previewVisible ? 'w-1/2' : 'w-full'}`}
          >
            <div className="flex items-center px-4 py-1.5 border-b border-default bg-surface-1/50">
              <span className="text-xs font-medium text-muted">Source</span>
              <span className="ml-auto text-xs text-muted font-mono opacity-50">.typ</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeMirror
                value={value}
                height="100%"
                extensions={extensions}
                onCreateEditor={(view) => {
                  viewRef.current = view;
                }}
                onChange={(val) => {
                  setValue(val);
                  onChange(val);
                }}
                theme={oneDarkTheme}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  highlightActiveLine: true,
                  autocompletion: true,
                }}
                style={{ height: '100%' }}
              />
            </div>
            {diagnostics.length > 0 && (
              <ul className="max-h-40 overflow-auto border-t border-default bg-surface-1 py-1">
                {diagnostics.map((d, i) => (
                  <li key={i}>
                    <button
                      onClick={() => jumpTo(d)}
                      disabled={d.from == null}
                      className="w-full text-left px-3 py-1 flex gap-2 text-xs hover:bg-surface-2 disabled:hover:bg-transparent disabled:cursor-default"
                    >
                      {d.severity === 'error' ? (
                        <AlertCircle size={12} className="shrink-0 mt-0.5 text-danger" />
                      ) : (
                        <AlertTriangle size={12} className="shrink-0 mt-0.5 text-warning" />
                      )}
                      <span className="min-w-0">
                        <span className="text-secondary">{d.message}</span>
                        {d.line != null && (
                          <span className="ml-2 text-muted font-mono">
                            {d.file ? `${d.file}:` : 'Ln '}
                            {d.line}
                            {d.column != null && (d.file ? `:${d.column}` : `, Col ${d.column}`)}
                          </span>
                        )}
                        {d.hints.map((h, j) => (
                          <span key={j} className="block text-muted">
                            hint: {h}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Preview pane */}
        {previewVisible && (
          <div className={`flex flex-col ${editorVisible ? 'w-1/2' : 'w-full'}`}>
            <div className="flex items-center px-4 py-1.5 border-b border-default bg-surface-1/50">
              <span className="text-xs font-medium text-muted">Preview</span>
              {errorCount > 0 && pages && (
                <span className="ml-auto text-xs text-muted">Showing last successful render</span>
              )}
            </div>
            <div
              className="flex-1 overflow-auto bg-surface-0 p-6"
              onWheel={handleWheel}
              onClick={handlePreviewClick}
            >
              {failure && (
                <p className="text-danger text-xs font-mono whitespace-pre-wrap text-center mt-8">
                  {failure}
                </p>
              )}
              {!failure && !pages && (
                <p className="text-muted text-xs text-center mt-8">Compiling…</p>
              )}
              {!failure && pages && (
                <div
                  className={`mx-auto flex flex-col gap-6 transition-opacity ${errorCount > 0 ? 'opacity-60' : ''}`}
                  style={{ width: `${zoom * 100}%` }}
                >
                  {pages.map((svg, i) => (
                    <div
                      key={i}
                      className="bg-white shadow-lg [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
