import { useState, useEffect, useCallback } from 'react';
import { VaultService, type FileTagInfo } from '../services/vault';
import { useWorkspaceStore } from '../store/workspace';

export function TagsPanel() {
  const [tagData, setTagData] = useState<FileTagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const vaultPath = useWorkspaceStore((s) => s.vaultPath);
  const openFile = useWorkspaceStore((s) => s.openFile);

  const refresh = useCallback(async () => {
    try {
      const data = await VaultService.scanTags();
      setTagData(data);
    } catch {
      // Not critical
    }
  }, []);

  useEffect(() => {
    if (vaultPath) refresh();
  }, [vaultPath, refresh]);

  // Refresh tags when file tree changes
  const fileTree = useWorkspaceStore((s) => s.fileTree);
  useEffect(() => {
    if (vaultPath) refresh();
  }, [fileTree, vaultPath, refresh]);

  // Aggregate tags
  const tagMap = new Map<string, FileTagInfo[]>();
  for (const file of tagData) {
    for (const tag of file.tags) {
      const existing = tagMap.get(tag) ?? [];
      existing.push(file);
      tagMap.set(tag, existing);
    }
  }
  const sortedTags = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length);

  const filteredFiles = selectedTag ? (tagMap.get(selectedTag) ?? []) : [];

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Tags
        {sortedTags.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {sortedTags.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {sortedTags.length === 0 ? (
            <div className="text-xs text-muted py-2">
              No tags found. Add <code className="text-accent">tags: [...]</code> to frontmatter.
            </div>
          ) : (
            <>
              {/* Tag chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {sortedTags.map(([tag, files]) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                      selectedTag === tag
                        ? 'bg-accent text-white'
                        : 'bg-surface-2 text-secondary hover:bg-surface-3 hover:text-primary'
                    }`}
                  >
                    <span>{tag}</span>
                    <span
                      className={`text-xs ${selectedTag === tag ? 'text-white/70' : 'text-muted'}`}
                    >
                      {files.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Filtered file list */}
              {selectedTag && filteredFiles.length > 0 && (
                <div className="border-t border-default/50 pt-1.5 space-y-0.5">
                  {filteredFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => {
                        if (vaultPath) openFile(`${vaultPath}/${file.path}`);
                      }}
                      className="w-full text-left px-2 py-1 rounded text-xs text-secondary hover:bg-surface-2 hover:text-primary truncate flex items-center gap-2"
                    >
                      {file.status && <StatusDot status={file.status} />}
                      <span className="truncate">{file.path}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'var(--color-warning)',
    'in-review': 'var(--color-accent)',
    approved: 'var(--color-success)',
    deprecated: 'var(--color-text-muted)',
  };
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: colors[status] ?? 'var(--color-text-muted)' }}
      title={status}
    />
  );
}
