import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
import { VaultService, type FileTagInfo } from '../services/vault';
import { useWorkspaceStore } from '../store/workspace';

export function TagsPanel({ forceExpanded }: { forceExpanded?: boolean }) {
  const [tagData, setTagData] = useState<FileTagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [activeFileTags, setActiveFileTags] = useState<string[]>([]);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const vaultPath = useWorkspaceStore((s) => s.vaultPath);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const activeFilePath = activeTab?.filePath;
  const isMarkdown = activeFilePath?.endsWith('.md');

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

  // Load active file's tags
  useEffect(() => {
    if (!activeFilePath || !isMarkdown) {
      setActiveFileTags([]);
      return;
    }
    VaultService.getFileTags(activeFilePath)
      .then(setActiveFileTags)
      .catch(() => setActiveFileTags([]));
  }, [activeFilePath, isMarkdown]);

  // Focus input when adding
  useEffect(() => {
    if (addingTag) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [addingTag]);

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
  const allTagNames = sortedTags.map(([tag]) => tag);

  const filteredFiles = selectedTag ? (tagMap.get(selectedTag) ?? []) : [];

  const addTagToFile = useCallback(
    async (tag: string) => {
      if (!activeFilePath) return;
      const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
      if (!normalized || activeFileTags.includes(normalized)) return;
      const next = [...activeFileTags, normalized];
      setActiveFileTags(next);
      try {
        await VaultService.setTags(activeFilePath, next);
        const updated = await VaultService.readFile(activeFilePath);
        window.dispatchEvent(
          new CustomEvent('vault:file-updated', {
            detail: { path: activeFilePath, content: updated },
          }),
        );
        refresh();
      } catch {
        // revert
        setActiveFileTags(activeFileTags);
      }
    },
    [activeFilePath, activeFileTags, refresh],
  );

  const removeTagFromFile = useCallback(
    async (tag: string) => {
      if (!activeFilePath) return;
      const next = activeFileTags.filter((t) => t !== tag);
      setActiveFileTags(next);
      try {
        await VaultService.setTags(activeFilePath, next);
        const updated = await VaultService.readFile(activeFilePath);
        window.dispatchEvent(
          new CustomEvent('vault:file-updated', {
            detail: { path: activeFilePath, content: updated },
          }),
        );
        refresh();
      } catch {
        setActiveFileTags(activeFileTags);
      }
    },
    [activeFilePath, activeFileTags, refresh],
  );

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      addTagToFile(newTagInput);
      setNewTagInput('');
      setAddingTag(false);
    } else if (e.key === 'Escape') {
      setNewTagInput('');
      setAddingTag(false);
    }
  };

  // Suggestions for the add input
  const suggestions = allTagNames.filter(
    (t) =>
      !activeFileTags.includes(t) &&
      (!newTagInput || t.toLowerCase().includes(newTagInput.toLowerCase())),
  );

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
      >
        <ChevronRight
          size={10}
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        Tags
        {sortedTags.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {sortedTags.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Active file markers */}
          {isMarkdown && (
            <div className="mb-2.5 pb-2.5 border-b border-subtle">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-medium text-muted uppercase tracking-wide">
                  Current file
                </span>
                <button
                  onClick={() => setAddingTag(true)}
                  className="ml-auto p-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary transition-colors"
                  title="Add tag"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeFileTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent border border-accent/30"
                  >
                    {tag}
                    <button
                      onClick={() => removeTagFromFile(tag)}
                      className="hover:text-white transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {activeFileTags.length === 0 && !addingTag && (
                  <span className="text-xs text-muted italic">No tags</span>
                )}
              </div>
              {addingTag && (
                <div className="mt-1.5">
                  <input
                    ref={inputRef}
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onBlur={() => {
                      setTimeout(() => {
                        setAddingTag(false);
                        setNewTagInput('');
                      }, 150);
                    }}
                    placeholder="Tag name..."
                    className="w-full px-2 py-1 bg-surface-2 border border-default rounded text-xs text-primary placeholder:text-muted outline-none focus:border-accent/50"
                  />
                  {suggestions.length > 0 && newTagInput && (
                    <div className="mt-1 bg-surface-2 border border-default rounded max-h-20 overflow-y-auto">
                      {suggestions.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTagToFile(tag);
                            setNewTagInput('');
                            setAddingTag(false);
                          }}
                          className="w-full text-left px-2 py-1 text-xs text-secondary hover:bg-surface-3 hover:text-primary"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* All vault tags */}
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
                <div className="border-t border-subtle pt-1.5 space-y-0.5">
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
