import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';

function flattenTree(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      if (entry.children) result.push(...flattenTree(entry.children));
    } else {
      result.push(entry);
    }
  }
  return result;
}

function getRelativePath(filePath: string, vaultPath: string | null): string {
  if (!vaultPath) return filePath;
  return filePath.startsWith(vaultPath) ? filePath.slice(vaultPath.length + 1) : filePath;
}

function FileTypeIndicator({ name }: { name: string }) {
  const ext = name.split('.').pop();
  const colors: Record<string, string> = {
    md: 'var(--color-accent)',
    excalidraw: 'var(--color-warning)',
    mermaid: 'var(--color-success)',
  };
  const color = colors[ext ?? ''] ?? 'var(--color-text-muted)';
  return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fileTree, openFile, vaultPath } = useWorkspaceStore();
  const files = flattenTree(fileTree);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <Command
        className="relative w-full max-w-lg rounded-xl border border-default bg-surface-1 shadow-2xl overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-center px-4 border-b border-default">
          <Search size={14} className="shrink-0 text-muted" />
          <Command.Input
            placeholder="Search files..."
            className="flex-1 px-3 py-3.5 bg-transparent text-primary placeholder-[var(--color-text-muted)] outline-none text-sm"
            autoFocus
          />
        </div>
        <Command.List className="max-h-72 overflow-y-auto p-1.5">
          <Command.Empty className="px-4 py-10 text-sm text-muted text-center">
            No files found.
          </Command.Empty>
          {files.map((file) => {
            const relativePath = getRelativePath(file.path, vaultPath);
            const fileName = file.name;
            const dir = relativePath.includes('/')
              ? relativePath.slice(0, relativePath.lastIndexOf('/'))
              : '';
            return (
              <Command.Item
                key={file.path}
                value={relativePath}
                onSelect={() => {
                  openFile(file.path);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg text-sm text-secondary cursor-pointer flex items-center gap-3 data-[selected=true]:bg-surface-3 data-[selected=true]:text-primary"
              >
                <FileTypeIndicator name={fileName} />
                <span className="truncate">{fileName}</span>
                {dir && (
                  <span className="ml-auto text-xs text-muted truncate max-w-36 font-mono">
                    {dir}
                  </span>
                )}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
