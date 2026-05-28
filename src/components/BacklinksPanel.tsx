import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronRight, Link2 } from 'lucide-react';
import { VaultService, type BacklinkEntry } from '../services/vault';
import { useWorkspaceStore } from '../store/workspace';

export function BacklinksPanel({ forceExpanded }: { forceExpanded?: boolean }) {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const backlinksCacheRef = useRef<BacklinkEntry[]>([]);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const vaultPath = useWorkspaceStore((s) => s.vaultPath);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const openTabs = useWorkspaceStore((s) => s.openTabs);

  const activeFilePath = useMemo(() => {
    const tab = openTabs.find((t) => t.id === activeTabId);
    return tab?.filePath ?? null;
  }, [activeTabId, openTabs]);

  // Stable filename stem derived from active file
  const fileName = useMemo(() => {
    if (!activeFilePath) return null;
    return (
      activeFilePath
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? null
    );
  }, [activeFilePath]);

  const refresh = useCallback(async () => {
    if (!fileName) {
      setBacklinks([]);
      backlinksCacheRef.current = [];
      return;
    }
    setLoading(true);
    try {
      const results = await VaultService.scanBacklinks(fileName);
      // Filter out self-references
      const activeRel =
        activeFilePath && vaultPath ? activeFilePath.replace(vaultPath + '/', '') : '';
      const filtered = results.filter((r) => r.path !== activeRel);
      backlinksCacheRef.current = filtered;
      setBacklinks(filtered);
    } catch {
      // Keep cached results on error rather than clearing
      setBacklinks(backlinksCacheRef.current);
    } finally {
      setLoading(false);
    }
  }, [fileName, activeFilePath, vaultPath]);

  // Refresh when the active file changes, with a delay to allow previous file to save
  useEffect(() => {
    // Immediate scan for cached/fast results
    refresh();
    // Delayed re-scan to catch files that were just saved (autosave on tab switch)
    const timer = setTimeout(() => refresh(), 500);
    return () => clearTimeout(timer);
  }, [refresh]);

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
        Backlinks
        {backlinks.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {backlinks.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {loading && backlinks.length === 0 ? (
            <div className="text-xs text-muted py-2">Scanning...</div>
          ) : backlinks.length === 0 ? (
            <div className="text-xs text-muted py-2 flex items-center gap-1.5">
              <Link2 size={11} />
              No files link to this page
            </div>
          ) : (
            <div className="space-y-0.5">
              {backlinks.map((link, i) => (
                <button
                  key={`${link.path}-${link.line_number}-${i}`}
                  onClick={() => {
                    if (vaultPath) openFile(`${vaultPath}/${link.path}`);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-2 transition-colors group flex items-center gap-2"
                >
                  <Link2 size={11} className="text-muted shrink-0" />
                  <span className="text-xs text-secondary group-hover:text-primary truncate">
                    {link.path
                      .split('/')
                      .pop()
                      ?.replace(/\.[^.]+$/, '') ?? link.path}
                  </span>
                  <span className="text-[10px] text-muted shrink-0 ml-auto">
                    L{link.line_number}
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
