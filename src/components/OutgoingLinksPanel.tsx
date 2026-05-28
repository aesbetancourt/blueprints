import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { VaultService } from '../services/vault';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';

interface OutgoingLink {
  label: string;
  resolvedPath: string | null;
  lineNumber: number;
}

function resolveLink(name: string, fileTree: FileEntry[]): string | null {
  const lower = name.toLowerCase().replace(/\.[^.]+$/, '');
  function walk(entries: FileEntry[]): string | null {
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (entry.children) {
          const found = walk(entry.children);
          if (found) return found;
        }
      } else {
        const stem = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
        if (stem === lower || entry.name.toLowerCase() === name.toLowerCase()) {
          return entry.path;
        }
      }
    }
    return null;
  }
  return walk(fileTree);
}

export function OutgoingLinksPanel({ forceExpanded }: { forceExpanded?: boolean }) {
  const [links, setLinks] = useState<OutgoingLink[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const openFile = useWorkspaceStore((s) => s.openFile);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const fileTree = useWorkspaceStore((s) => s.fileTree);

  const activeFilePath = useMemo(() => {
    const tab = openTabs.find((t) => t.id === activeTabId);
    return tab?.filePath ?? null;
  }, [activeTabId, openTabs]);

  const isMarkdown = activeFilePath?.endsWith('.md');

  // Extract [[...]] links from the file content
  useEffect(() => {
    if (!activeFilePath || !isMarkdown) {
      setLinks([]);
      return;
    }

    const extract = async () => {
      try {
        const content = await VaultService.readFile(activeFilePath);
        const lines = content.split('\n');
        const found: OutgoingLink[] = [];
        const seen = new Set<string>();
        for (let i = 0; i < lines.length; i++) {
          const regex = /\[\[([^\]]+)\]\]/g;
          let match;
          while ((match = regex.exec(lines[i])) !== null) {
            const label = match[1];
            if (seen.has(label.toLowerCase())) continue;
            seen.add(label.toLowerCase());
            found.push({
              label,
              resolvedPath: resolveLink(label, fileTree),
              lineNumber: i + 1,
            });
          }
        }
        setLinks(found);
      } catch {
        setLinks([]);
      }
    };

    extract();
  }, [activeFilePath, isMarkdown, fileTree]);

  // Also update when file is edited (listen for vault:file-updated)
  useEffect(() => {
    if (!activeFilePath || !isMarkdown) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { path: string; content: string };
      if (detail.path !== activeFilePath) return;
      const lines = detail.content.split('\n');
      const found: OutgoingLink[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < lines.length; i++) {
        const regex = /\[\[([^\]]+)\]\]/g;
        let match;
        while ((match = regex.exec(lines[i])) !== null) {
          const label = match[1];
          if (seen.has(label.toLowerCase())) continue;
          seen.add(label.toLowerCase());
          found.push({
            label,
            resolvedPath: resolveLink(label, fileTree),
            lineNumber: i + 1,
          });
        }
      }
      setLinks(found);
    };
    window.addEventListener('vault:file-updated', handler);
    return () => window.removeEventListener('vault:file-updated', handler);
  }, [activeFilePath, isMarkdown, fileTree]);

  if (!isMarkdown) return null;

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
        Links
        {links.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {links.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {links.length === 0 ? (
            <div className="text-xs text-muted py-2 flex items-center gap-1.5">
              <Link2 size={11} />
              No outgoing links
            </div>
          ) : (
            <div className="space-y-0.5">
              {links.map((link) => (
                <button
                  key={link.label}
                  onClick={() => {
                    if (link.resolvedPath) openFile(link.resolvedPath);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors group flex items-center gap-2 ${
                    link.resolvedPath ? 'hover:bg-surface-2 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <Link2 size={11} className="text-muted shrink-0" />
                  <span
                    className={`text-xs truncate ${
                      link.resolvedPath ? 'text-secondary group-hover:text-primary' : 'text-muted'
                    }`}
                  >
                    {link.label}
                  </span>
                  <span className="text-[10px] text-muted shrink-0 ml-auto">
                    {!link.resolvedPath ? 'unresolved' : `L${link.lineNumber}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
