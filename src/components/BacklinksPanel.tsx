import { useState, useEffect } from 'react';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';
import { VaultService } from '../services/vault';

interface Backlink {
  filePath: string;
  fileName: string;
  lineContent: string;
}

export function BacklinksPanel() {
  const { activeTabId, openTabs, vaultPath, fileTree, openFile } = useWorkspaceStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!activeTab || !vaultPath) {
      setBacklinks([]);
      return;
    }

    const fileName = activeTab.fileName.replace(/\.[^.]+$/, '');
    const pattern = `[[${fileName}]]`;

    async function findBacklinks() {
      const results: Backlink[] = [];
      await searchTree(fileTree, pattern, activeTab?.filePath ?? '', results);
      setBacklinks(results);
    }

    findBacklinks();
  }, [activeTab?.filePath, vaultPath, fileTree]);

  if (!activeTab) return null;
  if (activeTab.fileType !== 'md') return null;

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
        Backlinks
        {backlinks.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {backlinks.length}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-2 pb-2">
          {backlinks.length === 0 ? (
            <p className="text-xs text-muted px-2 py-1">No backlinks found.</p>
          ) : (
            backlinks.map((bl, i) => (
              <button
                key={`${bl.filePath}-${i}`}
                onClick={() => openFile(bl.filePath)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-2 flex flex-col gap-0.5"
              >
                <span className="text-xs text-secondary truncate">{bl.fileName}</span>
                <span className="text-xs text-muted truncate">{bl.lineContent}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

async function searchTree(
  entries: FileEntry[],
  pattern: string,
  excludePath: string,
  results: Backlink[],
) {
  for (const entry of entries) {
    if (entry.isDirectory) {
      if (entry.children) {
        await searchTree(entry.children, pattern, excludePath, results);
      }
    } else if (entry.path !== excludePath && entry.name.endsWith('.md')) {
      try {
        const content = await VaultService.readFile(entry.path);
        if (content.includes(pattern)) {
          const lines = content.split('\n');
          const matchLine = lines.find((l) => l.includes(pattern)) ?? '';
          results.push({
            filePath: entry.path,
            fileName: entry.name,
            lineContent: matchLine.trim(),
          });
        }
      } catch {
        // skip unreadable files
      }
    }
  }
}
