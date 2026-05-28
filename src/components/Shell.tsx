import { useState, useCallback, useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Sidebar } from './Sidebar';
import { EditorArea } from './EditorArea';
import { GitPanel } from './GitPanel';
import { CommandPalette } from './CommandPalette';
import { SearchPanel } from './SearchPanel';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { SettingsModal } from './SettingsModal';
import { CreateModal } from './CreateModal';
import { ScratchPad } from './ScratchPad';
import { StatusBar } from './StatusBar';
import { HelpPanel } from './HelpPanel';
import { ResourcePanel } from './ResourcePanel';
import { ToastContainer } from './Toast';
import { ConfirmDialog, confirm } from './ConfirmDialog';
import { VaultSelector } from './VaultSelector';
import { useHotkey } from '../hooks/useHotkey';
import { useFileEvents } from '../hooks/useFileEvents';
import { useVaultInit } from '../hooks/useVaultInit';
import { useWorkspaceStore } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { useToastStore } from './Toast';

export function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scratchPadOpen, setScratchPadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const vaultPath = useWorkspaceStore((s: { vaultPath: string | null }) => s.vaultPath);
  const {
    closeTab,
    activeTabId,
    nextTab,
    prevTab,
    openTabs,
    sidebarCollapsed,
    toggleSidebar,
    openFile,
    setFileTree,
  } = useWorkspaceStore();
  const { addToast } = useToastStore();

  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);

  const createQuickNote = useCallback(async () => {
    if (!vaultPath) return;
    const { quickNote } = useSettingsStore.getState();
    const folder = quickNote.folder || 'scratch';
    const confirmed = await confirm({
      title: 'Create Quick Note',
      message: `Create a new quick note in /${folder}?`,
      confirmLabel: 'Create',
    });
    if (!confirmed) return;
    try {
      const scratchDir = `${vaultPath}/${folder}`.replace(/\/+$/, '');
      // Ensure directory exists
      try {
        await VaultService.createDir(scratchDir);
      } catch {
        /* already exists */
      }
      // Resolve name template
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const timestamp = Math.floor(now.getTime() / 1000).toString();
      const iso = now.toISOString().replace(/[T:]/g, '-').replace(/\..+/, '');
      const fileName = (quickNote.nameTemplate || 'note-{date}-{time}')
        .replace(/\{date\}/g, date)
        .replace(/\{time\}/g, time)
        .replace(/\{timestamp\}/g, timestamp)
        .replace(/\{iso\}/g, iso);
      const fullPath = `${scratchDir}/${fileName}.md`;
      const content = `# Quick Note\n\n> ${now.toLocaleString()}\n\n`;
      const createdPath = await VaultService.createFile(fullPath, 'md');
      await VaultService.writeFile(createdPath, content);
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
      openFile(createdPath);
    } catch (err) {
      addToast(`Failed to create quick note: ${err}`, 'error');
    }
  }, [vaultPath, setFileTree, openFile, addToast]);

  useHotkey('p', true, togglePalette);

  useFileEvents();
  useVaultInit();

  // Listen for create-modal custom event from CreateFileButton
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener('open-create-modal', handler);
    return () => window.removeEventListener('open-create-modal', handler);
  }, []);

  // Additional keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+Shift+F - search in files
      if (meta && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen((v) => !v);
        return;
      }

      // Cmd+W - close tab
      if (meta && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          const tab = openTabs.find((t) => t.id === activeTabId);
          if (tab?.isDirty) {
            confirm({
              title: 'Unsaved Changes',
              message: 'This file has unsaved changes. Discard them?',
              confirmLabel: 'Discard',
              danger: true,
            }).then((confirmed) => {
              if (confirmed) closeTab(activeTabId);
            });
            return;
          }
          closeTab(activeTabId);
        }
        return;
      }

      // Cmd+Shift+[ - prev tab
      if (meta && e.shiftKey && e.key === '[') {
        e.preventDefault();
        prevTab();
        return;
      }

      // Cmd+Shift+] - next tab
      if (meta && e.shiftKey && e.key === ']') {
        e.preventDefault();
        nextTab();
        return;
      }

      // Cmd+Shift+N - quick note (instant timestamped file in /scratch)
      if (meta && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        e.stopPropagation();
        createQuickNote();
        return;
      }

      // Cmd+N - new file
      if (meta && !e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        e.stopPropagation();
        setCreateOpen(true);
        return;
      }

      // Cmd+? - shortcuts
      if (meta && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      // Cmd+B - toggle sidebar
      if (meta && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+, - settings
      if (meta && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        e.stopPropagation();
        setSettingsOpen((v) => !v);
        return;
      }

      // Cmd+Shift+G - git panel
      if (meta && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        e.stopPropagation();
        setGitPanelOpen((v) => !v);
        return;
      }

      // Cmd+J - toggle scratch pad
      if (meta && !e.shiftKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        e.stopPropagation();
        setScratchPadOpen((v) => !v);
        return;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [activeTabId, closeTab, nextTab, prevTab, openTabs, toggleSidebar, createQuickNote]);

  if (!vaultPath) {
    return <VaultSelector />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-0 text-primary">
      <Group orientation="horizontal" className="flex-1 min-h-0">
        {!sidebarCollapsed && (
          <>
            <Panel defaultSize="20%" minSize="330px" maxSize="35%">
              <Sidebar />
            </Panel>
            <Separator className="w-px bg-surface-3 hover:bg-accent transition-colors cursor-col-resize" />
          </>
        )}
        <Panel minSize="40%">
          <EditorArea />
        </Panel>
        {gitPanelOpen && (
          <>
            <Separator className="w-px bg-surface-3 hover:bg-accent transition-colors cursor-col-resize" />
            <Panel defaultSize="22%" minSize="15%" maxSize="40%">
              <GitPanel />
            </Panel>
          </>
        )}
      </Group>
      <ScratchPad
        open={scratchPadOpen}
        onClose={() => setScratchPadOpen(false)}
        onQuickNote={createQuickNote}
      />
      <StatusBar
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleGit={() => setGitPanelOpen((v) => !v)}
        onToggleScratchPad={() => setScratchPadOpen((v) => !v)}
        onQuickNote={createQuickNote}
        onToggleSearch={toggleSearch}
        onToggleHelp={() => setHelpOpen((v) => !v)}
        onToggleResources={() => setResourcesOpen((v) => !v)}
        gitOpen={gitPanelOpen}
        scratchPadOpen={scratchPadOpen}
        searchOpen={searchOpen}
        helpOpen={helpOpen}
        resourcesOpen={resourcesOpen}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      {resourcesOpen && <ResourcePanel onClose={() => setResourcesOpen(false)} />}
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}
