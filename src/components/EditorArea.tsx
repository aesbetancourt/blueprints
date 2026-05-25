import { useState } from 'react';
import { useWorkspaceStore, type Tab } from '../store/workspace';
import { TabBar } from './TabBar';
import { EditorPane } from './EditorPane';
import { Breadcrumbs } from './Breadcrumbs';
import { Panel, Group, Separator } from 'react-resizable-panels';

export function EditorArea() {
  const { openTabs, activeTabId, splitTabId } = useWorkspaceStore();
  const activeTab = openTabs.find((t: Tab) => t.id === activeTabId);
  const splitTab = splitTabId ? openTabs.find((t: Tab) => t.id === splitTabId) : null;
  const [editorMode, setEditorMode] = useState<'rich' | 'raw'>('rich');

  // Only show mode toggle for md files
  const showModeToggle = activeTab?.fileType === 'md';

  return (
    <div className="h-full flex flex-col bg-surface-0">
      <TabBar />
      <Breadcrumbs
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        showModeToggle={showModeToggle}
      />
      {activeTab ? (
        <div className="flex-1 min-h-0">
          {splitTab && splitTab.id !== activeTab.id ? (
            <Group orientation="horizontal" className="h-full">
              <Panel minSize="30%">
                <EditorPane key={activeTab.id} tab={activeTab} editorMode={editorMode} />
              </Panel>
              <Separator className="w-px bg-surface-3 hover:bg-accent transition-colors cursor-col-resize" />
              <Panel minSize="30%">
                <EditorPane key={splitTab.id} tab={splitTab} editorMode={editorMode} />
              </Panel>
            </Group>
          ) : (
            <EditorPane key={activeTab.id} tab={activeTab} editorMode={editorMode} />
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="w-10 h-10 mx-auto rounded-xl bg-surface-2 border border-default flex items-center justify-center">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1.5"
              >
                <path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline points="14,2 14,8 20,8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-secondary">No file open</p>
              <p className="text-xs text-muted mt-1.5">
                Select from explorer or use a shortcut below
              </p>
            </div>
            <div className="inline-flex flex-col gap-2 text-left">
              <ShortcutRow keys="⌘P" label="Quick open file" />
              <ShortcutRow keys="⌘⇧F" label="Search in workspace" />
              <ShortcutRow keys="⌘F" label="Find in file" />
              <ShortcutRow keys="⌘N" label="New file" />
              <ShortcutRow keys="⌘B" label="Toggle sidebar" />
              <ShortcutRow keys="⌘W" label="Close tab" />
              <ShortcutRow keys="⌘⇧[" label="Previous tab" />
              <ShortcutRow keys="⌘⇧]" label="Next tab" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-default text-secondary font-mono text-xs min-w-[3rem] text-center">
        {keys}
      </kbd>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
