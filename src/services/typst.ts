import { invoke } from '@tauri-apps/api/core';

export interface TypstDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  hints: string[];
  /** UTF-16 offsets in the edited source. Set only for errors in the open file. */
  from: number | null;
  to: number | null;
  /** One-based position in `file`, or in the open file when `file` is null. */
  line: number | null;
  column: number | null;
  /** Vault-relative or package path when the problem is in another file. */
  file: string | null;
}

export interface TypstCompileResult {
  /** One SVG document per page. Empty when compilation failed. */
  pages: string[];
  diagnostics: TypstDiagnostic[];
}

export const TypstService = {
  /** Compile unsaved source for the `.typ` file at `path`. */
  async compile(path: string, source: string): Promise<TypstCompileResult> {
    return invoke<TypstCompileResult>('compile_typst', { path, source });
  },

  /** Compile unsaved source and write the PDF to `outPath`. */
  async exportPdf(path: string, source: string, outPath: string): Promise<void> {
    return invoke('export_typst_pdf', { path, source, outPath });
  },
};
