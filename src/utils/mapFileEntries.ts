import type { FileEntry as StoreFileEntry } from '../store/workspace';
import type { FileEntry as RustFileEntry } from '../services/vault';

/** Maps Rust snake_case FileEntry to store camelCase FileEntry */
export function mapFileEntries(entries: RustFileEntry[]): StoreFileEntry[] {
  return entries.map((e) => ({
    name: e.name,
    path: e.path,
    isDirectory: e.is_directory,
    children: e.children ? mapFileEntries(e.children) : undefined,
  }));
}
