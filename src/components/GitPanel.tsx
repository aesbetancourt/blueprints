import { useState, useEffect, useCallback } from 'react';
import { useGitStore } from '../store/git';
import { useSettingsStore } from '../store/settings';
import { useToastStore } from './Toast';

export function GitPanel() {
  const {
    files,
    log,
    branches,
    loading,
    error,
    selectedFile,
    selectedDiff,
    diffStaged,
    refresh,
    refreshLog,
    refreshBranches,
    selectFile,
    clearSelection,
    stage,
    unstage,
    stageAll,
    unstageAll,
    commit,
    discard,
  } = useGitStore();
  const { addToast } = useToastStore();
  const includePatterns = useSettingsStore((s) => s.file.includePatterns) ?? [
    '*.md',
    '*.excalidraw',
    '*.mermaid',
  ];
  const [commitMsg, setCommitMsg] = useState('');
  const [view, setView] = useState<'changes' | 'log'>('changes');

  useEffect(() => {
    refresh();
    refreshLog();
    refreshBranches();
  }, [refresh, refreshLog, refreshBranches]);

  const visibleFiles = files.filter((f) => {
    if (includePatterns.length === 0) return true;
    const fileName = f.path.split('/').pop() ?? '';
    return matchesIncludePatterns(fileName, includePatterns);
  });

  const staged = visibleFiles.filter((f) => f.staged);
  const unstaged = visibleFiles.filter((f) => !f.staged);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return;
    try {
      await commit(commitMsg.trim());
      setCommitMsg('');
      addToast('Committed successfully', 'success');
    } catch (err) {
      addToast(`Commit failed: ${err}`, 'error');
    }
  }, [commitMsg, commit, addToast]);

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-default">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-default flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitIcon />
          <span className="text-xs font-medium text-primary">Git</span>
          {branches && (
            <span className="text-xs text-accent px-1.5 py-0.5 rounded bg-accent-glow">
              {branches.current}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            refresh();
            refreshLog();
          }}
          className="p-1 rounded text-muted hover:text-primary hover:bg-surface-2 transition-colors"
          title="Refresh"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* View toggle */}
      <div className="flex px-3 pt-2 gap-1">
        <TabButton active={view === 'changes'} onClick={() => setView('changes')}>
          Changes{' '}
          {visibleFiles.length > 0 && (
            <span className="ml-1 text-accent">{visibleFiles.length}</span>
          )}
        </TabButton>
        <TabButton active={view === 'log'} onClick={() => setView('log')}>
          History
        </TabButton>
      </div>

      {error && <div className="px-3 py-2 text-xs text-danger">{error}</div>}

      {view === 'changes' ? (
        <ChangesView
          staged={staged}
          unstaged={unstaged}
          loading={loading}
          selectedFile={selectedFile}
          selectedDiff={selectedDiff}
          diffStaged={diffStaged}
          commitMsg={commitMsg}
          onCommitMsgChange={setCommitMsg}
          onCommit={handleCommit}
          onSelectFile={selectFile}
          onClearSelection={clearSelection}
          onStage={stage}
          onUnstage={unstage}
          onStageAll={stageAll}
          onUnstageAll={unstageAll}
          onDiscard={discard}
        />
      ) : (
        <LogView log={log} />
      )}
    </div>
  );
}

// --- Changes View ---

interface ChangesViewProps {
  staged: { path: string; status: string; staged: boolean }[];
  unstaged: { path: string; status: string; staged: boolean }[];
  loading: boolean;
  selectedFile: string | null;
  selectedDiff: string | null;
  diffStaged: boolean;
  commitMsg: string;
  onCommitMsgChange: (msg: string) => void;
  onCommit: () => void;
  onSelectFile: (path: string, staged: boolean) => Promise<void>;
  onClearSelection: () => void;
  onStage: (path: string) => Promise<void>;
  onUnstage: (path: string) => Promise<void>;
  onStageAll: () => Promise<void>;
  onUnstageAll: () => Promise<void>;
  onDiscard: (path: string) => Promise<void>;
}

function ChangesView({
  staged,
  unstaged,
  loading,
  selectedFile,
  selectedDiff,
  diffStaged,
  commitMsg,
  onCommitMsgChange,
  onCommit,
  onSelectFile,
  onClearSelection,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onDiscard,
}: ChangesViewProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Commit area */}
      <div className="px-3 py-2 border-b border-default">
        <textarea
          value={commitMsg}
          onChange={(e) => onCommitMsgChange(e.target.value)}
          placeholder="Commit message..."
          className="w-full bg-surface-2 border border-default rounded-md px-2.5 py-1.5 text-xs text-primary placeholder-muted resize-none focus:border-accent outline-none"
          rows={2}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
        />
        <button
          onClick={onCommit}
          disabled={!commitMsg.trim() || staged.length === 0}
          className="mt-1.5 w-full py-1.5 rounded-md text-xs font-medium transition-colors bg-accent text-white hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Commit ({staged.length} staged)
        </button>
      </div>

      {/* File lists */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && staged.length === 0 && unstaged.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">Loading...</div>
        )}

        {!loading && staged.length === 0 && unstaged.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">Working tree clean</div>
        )}

        {/* Staged */}
        {staged.length > 0 && (
          <FileSection
            title="Staged"
            files={staged}
            selectedFile={selectedFile}
            diffStaged={diffStaged}
            isStaged
            onSelect={(p) => onSelectFile(p, true)}
            onAction={onUnstage}
            actionTitle="Unstage"
            onBulkAction={onUnstageAll}
            bulkTitle="Unstage All"
          />
        )}

        {/* Unstaged */}
        {unstaged.length > 0 && (
          <FileSection
            title="Changes"
            files={unstaged}
            selectedFile={selectedFile}
            diffStaged={diffStaged}
            isStaged={false}
            onSelect={(p) => onSelectFile(p, false)}
            onAction={onStage}
            actionTitle="Stage"
            onBulkAction={onStageAll}
            bulkTitle="Stage All"
            onDiscard={onDiscard}
          />
        )}
      </div>

      {/* Diff viewer */}
      {selectedFile && (
        <div className="border-t border-default max-h-[40%] flex flex-col">
          <div className="px-3 py-1.5 flex items-center justify-between bg-surface-0">
            <span className="text-xs text-secondary truncate">{selectedFile}</span>
            <button onClick={onClearSelection} className="text-muted hover:text-primary text-xs">
              Close
            </button>
          </div>
          <div className="flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed bg-surface-0">
            {selectedDiff ? (
              <DiffView diff={selectedDiff} />
            ) : (
              <span className="text-muted">Loading diff...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- File Section ---

function FileSection({
  title,
  files,
  selectedFile,
  diffStaged,
  isStaged,
  onSelect,
  onAction,
  actionTitle,
  onBulkAction,
  bulkTitle,
  onDiscard,
}: {
  title: string;
  files: { path: string; status: string }[];
  selectedFile: string | null;
  diffStaged: boolean;
  isStaged: boolean;
  onSelect: (path: string) => void;
  onAction: (path: string) => Promise<void>;
  actionTitle: string;
  onBulkAction: () => Promise<void>;
  bulkTitle: string;
  onDiscard?: (path: string) => Promise<void>;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{title}</span>
        <button
          onClick={onBulkAction}
          className="text-xs text-muted hover:text-accent transition-colors"
        >
          {bulkTitle}
        </button>
      </div>
      {files.map((f) => {
        const isSelected = selectedFile === f.path && diffStaged === isStaged;
        return (
          <div
            key={`${f.path}-${isStaged}`}
            className={`group flex items-center gap-2 px-3 py-1 cursor-pointer transition-colors ${
              isSelected ? 'bg-surface-2' : 'hover:bg-surface-2/50'
            }`}
            onClick={() => onSelect(f.path)}
          >
            <StatusBadge status={f.status} />
            <span className="flex-1 text-xs text-secondary truncate">{f.path}</span>
            <div className="hidden group-hover:flex items-center gap-1">
              {onDiscard && (
                <ActionBtn
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard(f.path);
                  }}
                  title="Discard"
                  danger
                >
                  <DiscardIcon />
                </ActionBtn>
              )}
              <ActionBtn
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(f.path);
                }}
                title={actionTitle}
              >
                {isStaged ? <MinusIcon /> : <PlusIcon />}
              </ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Log View ---

function LogView({
  log,
}: {
  log: { id: string; message: string; author: string; date: number }[];
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {log.length === 0 && (
        <div className="text-xs text-muted text-center py-4">No commits yet</div>
      )}
      {log.map((entry) => (
        <div key={entry.id} className="py-1.5 border-b border-default/50 last:border-none">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-accent">{entry.id}</span>
            <span className="text-xs text-muted">{entry.author}</span>
          </div>
          <div className="text-xs text-secondary mt-0.5 truncate">{entry.message}</div>
        </div>
      ))}
    </div>
  );
}

// --- Diff View ---

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <span className="text-muted">No changes</span>;
  }

  const lines = diff.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        let cls = 'text-secondary';
        if (line.startsWith('+')) cls = 'text-green-400';
        else if (line.startsWith('-')) cls = 'text-red-400';
        else if (line.startsWith('@@')) cls = 'text-accent';
        return (
          <div key={i} className={`${cls} whitespace-pre-wrap`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

// --- Utility Components ---

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? 'text-accent bg-accent-glow' : 'text-muted hover:text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-0.5 rounded transition-colors ${
        danger ? 'text-muted hover:text-danger' : 'text-muted hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'text-green-400',
    modified: 'text-yellow-400',
    deleted: 'text-red-400',
    renamed: 'text-blue-400',
  };
  const labels: Record<string, string> = {
    new: 'N',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
  };
  return (
    <span
      className={`text-xs font-mono font-bold w-4 text-center ${colors[status] ?? 'text-muted'}`}
    >
      {labels[status] ?? '?'}
    </span>
  );
}

// --- Icons ---

function GitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="18" r="3" />
      <circle cx="12" cy="6" r="3" />
      <path d="M12 9v6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function DiscardIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

function matchesIncludePatterns(fileName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`, 'i').test(fileName);
  });
}
