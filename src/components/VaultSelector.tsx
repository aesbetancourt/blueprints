import { useWorkspaceStore, type FileEntry, type RecentVault } from '../store/workspace';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { open } from '@tauri-apps/plugin-dialog';
import { useToastStore } from './Toast';
import { Box, FolderClosed } from 'lucide-react';

export function VaultSelector() {
  const setVault = useWorkspaceStore((s: { setVault: (p: string) => void }) => s.setVault);
  const setFileTree = useWorkspaceStore(
    (s: { setFileTree: (t: FileEntry[]) => void }) => s.setFileTree,
  );
  const recentVaults = useWorkspaceStore((s: { recentVaults: RecentVault[] }) => s.recentVaults);
  const { addToast } = useToastStore();

  const handleOpen = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    const path = selected as string;
    try {
      await VaultService.openVault(path);
      const tree = await VaultService.listFiles(path);
      setVault(path);
      setFileTree(mapFileEntries(tree));
    } catch (err) {
      addToast(`Failed to open vault: ${err}`, 'error');
    }
  };

  const handleOpenRecent = async (vault: RecentVault) => {
    try {
      await VaultService.openVault(vault.path);
      const tree = await VaultService.listFiles(vault.path);
      setVault(vault.path);
      setFileTree(mapFileEntries(tree));
    } catch (err) {
      addToast(`Failed to open "${vault.name}": ${err}`, 'error');
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-surface-0">
      {/* Subtle gradient backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-sm w-full text-center px-6">
        {/* Logo mark */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-surface-2 border border-default flex items-center justify-center">
          <Box size={28} className="text-accent" />
        </div>

        <h1 className="text-2xl font-semibold text-primary tracking-tight">Blueprints</h1>
        <p className="text-secondary text-sm mt-2 leading-relaxed">
          Technical documentation workspace.
          <br />
          Markdown, diagrams, and drawings in one place.
        </p>

        <button
          onClick={handleOpen}
          className="mt-8 px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all active:scale-95"
        >
          Open Vault
        </button>

        {/* Recent workspaces */}
        {recentVaults.length > 0 && (
          <div className="mt-8 text-left">
            <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-2 px-1">
              Recent Workspaces
            </h2>
            <div className="space-y-1">
              {recentVaults.map((vault) => (
                <button
                  key={vault.path}
                  onClick={() => handleOpenRecent(vault)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-surface-2 group-hover:bg-surface-3 border border-default flex items-center justify-center shrink-0">
                      <FolderClosed size={12} className="text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-primary truncate">{vault.name}</div>
                      <div className="text-xs text-muted truncate">{vault.path}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent opacity-60" />
            .md
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning opacity-60" />
            .excalidraw
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success opacity-60" />
            .mermaid
          </span>
        </div>

        <p className="text-muted text-xs mt-4">Plain files on disk. Git-friendly.</p>
      </div>
    </div>
  );
}
