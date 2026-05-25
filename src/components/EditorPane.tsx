import { useState, useEffect, useRef, useCallback } from 'react';
import type { Tab } from '../store/workspace';
import { useWorkspaceStore } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { VaultService } from '../services/vault';
import { MarkdownEditor } from '../editors/MarkdownEditor';
import { ExcalidrawEditor } from '../editors/ExcalidrawEditor';
import { MermaidEditor } from '../editors/MermaidEditor';
import { JsonCrackEditor } from '../editors/JsonCrackEditor';
import { useToastStore } from './Toast';

function computeStats(text: string, charsPerToken: number) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tokens = Math.ceil(chars / charsPerToken);
  return { chars, words, tokens };
}

export function EditorPane({ tab, editorMode }: { tab: Tab; editorMode?: 'rich' | 'raw' }) {
  const cached = VaultService.getCached(tab.filePath);
  const [content, setContent] = useState<string | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [forceGraph, setForceGraph] = useState(false);
  const contentRef = useRef<string | null>(cached ?? null);
  const isDirtyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabPathRef = useRef(tab.filePath);
  tabPathRef.current = tab.filePath;

  const markDirty = useWorkspaceStore(
    (s: { markDirty: (id: string, dirty: boolean) => void }) => s.markDirty,
  );
  const setDocumentStats = useWorkspaceStore((s) => s.setDocumentStats);
  const charsPerToken = useSettingsStore((s) => s.token.charsPerToken);
  const { addToast } = useToastStore();
  const hadCachedContent = useRef(cached != null);

  // Load file content
  useEffect(() => {
    let cancelled = false;
    setError(null);
    isDirtyRef.current = false;

    // If we already have content from the cache, skip the async read
    if (hadCachedContent.current) {
      if (tab.fileType === 'md' && contentRef.current != null) {
        setDocumentStats(computeStats(contentRef.current, charsPerToken));
      }
      return;
    }

    // Only show loading spinner after 300ms to avoid flash for fast loads
    const loadingTimer = setTimeout(() => {
      if (!cancelled) setShowLoading(true);
    }, 300);
    VaultService.readFile(tab.filePath)
      .then((c) => {
        if (cancelled) return;
        clearTimeout(loadingTimer);
        setShowLoading(false);
        setContent(c);
        contentRef.current = c;
        if (tab.fileType === 'md') {
          setDocumentStats(computeStats(c, charsPerToken));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          clearTimeout(loadingTimer);
          setShowLoading(false);
          setError(String(err));
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
  }, [tab.filePath, tab.fileType, setDocumentStats, charsPerToken]);

  // Clear stats when unmounting or switching to non-md
  useEffect(() => {
    if (tab.fileType !== 'md') {
      setDocumentStats(null);
    }
    return () => setDocumentStats(null);
  }, [tab.fileType, setDocumentStats]);

  const handleChange = useCallback(
    (newContent: string) => {
      // Called on TipTap onCreate — stores the normalized baseline
      contentRef.current = newContent;

      if (tab.fileType === 'md') {
        setDocumentStats(computeStats(newContent, charsPerToken));
      }
    },
    [tab.fileType, setDocumentStats, charsPerToken],
  );

  // Track real user edits via onUpdate (not onCreate)
  const handleUserEdit = useCallback(
    (newContent: string) => {
      contentRef.current = newContent;
      setContent(newContent);
      isDirtyRef.current = true;
      markDirty(tab.id, true);
      if (tab.fileType === 'md') {
        setDocumentStats(computeStats(newContent, charsPerToken));
      }
    },
    [tab.id, tab.fileType, markDirty, setDocumentStats, charsPerToken],
  );

  const saveToFile = useCallback(async () => {
    if (contentRef.current === null || !isDirtyRef.current) return;
    try {
      await VaultService.writeFile(tab.filePath, contentRef.current);
      isDirtyRef.current = false;
      markDirty(tab.id, false);
    } catch (err: unknown) {
      addToast(`Save failed: ${err}`, 'error');
    }
  }, [tab.filePath, tab.id, markDirty, addToast]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveToFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveToFile]);

  // Save when editor loses focus or window loses focus
  useEffect(() => {
    const container = containerRef.current;

    const trySave = () => {
      if (isDirtyRef.current && contentRef.current !== null) {
        VaultService.writeFile(tabPathRef.current, contentRef.current)
          .then(() => {
            isDirtyRef.current = false;
            markDirty(tab.id, false);
          })
          .catch(() => {});
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (!container || !container.contains(e.relatedTarget as Node)) {
        trySave();
      }
    };

    const handleWindowBlur = () => trySave();

    container?.addEventListener('focusout', handleFocusOut);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      container?.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [tab.id, markDirty]);

  // Save on unmount (tab switch/close)
  const tabIdRef = useRef(tab.id);
  tabIdRef.current = tab.id;
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && contentRef.current !== null) {
        // Don't save if the tab no longer exists (file was deleted/archived)
        const tabs = useWorkspaceStore.getState().openTabs;
        const tabStillExists = tabs.some((t) => t.id === tabIdRef.current);
        if (!tabStillExists) return;

        VaultService.writeFile(tabPathRef.current, contentRef.current).catch(() => {});
        // Clear dirty state directly on the store since component is unmounting
        useWorkspaceStore.getState().markDirty(tabIdRef.current, false);
      }
    };
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 p-4">
        <p>{error}</p>
      </div>
    );
  }

  if (content === null) {
    if (!showLoading) return <div className="h-full w-full bg-surface-0" />;
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">Loading...</div>
    );
  }

  let editor: React.ReactNode;
  switch (tab.fileType) {
    case 'md':
      editor = (
        <MarkdownEditor
          key={tab.filePath}
          content={content}
          onChange={handleChange}
          onUserEdit={handleUserEdit}
          mode={editorMode}
        />
      );
      break;
    case 'excalidraw':
      editor = <ExcalidrawEditor key={tab.filePath} content={content} onChange={handleUserEdit} />;
      break;
    case 'mermaid':
      editor = <MermaidEditor key={tab.filePath} content={content} onChange={handleUserEdit} />;
      break;
    case 'json': {
      const jsonGraphMaxSizeKB = useSettingsStore.getState().file.jsonGraphMaxSizeKB ?? 500;
      const fileSizeKB = content.length / 1024;
      const showGraph = forceGraph || fileSizeKB <= jsonGraphMaxSizeKB;
      editor = (
        <div className="h-full w-full flex flex-col">
          {!showGraph && (
            <div className="flex items-center gap-3 px-3 py-2 bg-yellow-950/30 border-b border-yellow-900/40 shrink-0">
              <span className="text-xs text-yellow-300/80">
                File too large for graph visualization ({Math.round(fileSizeKB)}KB &gt;{' '}
                {jsonGraphMaxSizeKB}KB limit)
              </span>
              <button
                onClick={() => setForceGraph(true)}
                className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-800/40 text-yellow-200 hover:bg-yellow-800/60 transition-colors"
              >
                Visualize anyway
              </button>
            </div>
          )}
          <div className="flex-1" style={{ minHeight: 0 }}>
            <JsonCrackEditor
              key={tab.filePath}
              content={content}
              onChange={handleUserEdit}
              showGraph={showGraph}
            />
          </div>
        </div>
      );
      break;
    }
    default:
      editor = (
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          Unsupported file type
        </div>
      );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      {editor}
    </div>
  );
}
