import { invoke } from '@tauri-apps/api/core';

export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileEntry[];
}

export interface VaultMeta {
  path: string;
  file_count: number;
}

export interface SearchResult {
  path: string;
  name: string;
  line_number: number;
  line_content: string;
}

export const VaultService = {
  /** In-memory cache for file contents — enables synchronous initial render */
  _cache: new Map<string, string>(),

  async openVault(path: string): Promise<VaultMeta> {
    return invoke<VaultMeta>('open_vault', { path });
  },

  async listFiles(path: string): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('list_files', { path });
  },

  async readFile(path: string): Promise<string> {
    const content = await invoke<string>('read_file', { path });
    this._cache.set(path, content);
    return content;
  },

  /** Read raw bytes (images). Not cached here — see utils/imageFiles. */
  async readBinaryFile(path: string): Promise<ArrayBuffer> {
    return invoke<ArrayBuffer>('read_binary_file', { path });
  },

  /** Get cached content synchronously (returns undefined if not cached) */
  getCached(path: string): string | undefined {
    return this._cache.get(path);
  },

  /** Invalidate cache entry (e.g. after external change) */
  invalidateCache(path: string): void {
    this._cache.delete(path);
  },

  async writeFile(path: string, content: string): Promise<void> {
    await invoke('write_file', { path, content });
    this._cache.set(path, content);
  },

  async createFile(path: string, fileType: string): Promise<string> {
    this._cache.delete(path);
    const created = await invoke<string>('create_file', { path, fileType });
    return created;
  },

  async fileExists(path: string): Promise<boolean> {
    return invoke<boolean>('file_exists', { path });
  },

  async createDir(path: string): Promise<string> {
    return invoke<string>('create_dir', { path });
  },

  async archiveFile(path: string): Promise<string> {
    this._cache.delete(path);
    return invoke<string>('archive_file', { path });
  },

  async moveFile(source: string, destFolder: string): Promise<string> {
    this._cache.delete(source);
    return invoke<string>('move_file', { source, destFolder });
  },

  async countFilesInDir(path: string): Promise<number> {
    return invoke<number>('count_files_in_dir', { path });
  },

  async deleteFile(path: string): Promise<void> {
    this._cache.delete(path);
    return invoke('delete_file', { path });
  },

  async deleteFiles(paths: string[]): Promise<string[]> {
    for (const p of paths) this._cache.delete(p);
    return invoke<string[]>('delete_files', { paths });
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    this._cache.delete(oldPath);
    this._cache.delete(newPath);
    return invoke('rename_file', { oldPath, newPath });
  },

  async searchFiles(query: string): Promise<SearchResult[]> {
    return invoke<SearchResult[]>('search_files', { query });
  },

  async scanTags(): Promise<FileTagInfo[]> {
    return invoke<FileTagInfo[]>('scan_tags');
  },

  async getFileTags(path: string): Promise<string[]> {
    return invoke<string[]>('get_file_tags', { path });
  },

  async setTags(path: string, tags: string[]): Promise<void> {
    return invoke('set_tags', { path, tags });
  },

  async scanBacklinks(targetName: string): Promise<BacklinkEntry[]> {
    return invoke<BacklinkEntry[]>('scan_backlinks', { targetName });
  },
};

export interface FileTagInfo {
  path: string;
  tags: string[];
  status: string | null;
}

export interface BacklinkEntry {
  path: string;
  line_number: number;
  line_content: string;
}
