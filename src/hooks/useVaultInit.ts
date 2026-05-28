import { useEffect, useRef } from 'react';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';
import { VaultService, type FileEntry as RustFileEntry } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';

export function useVaultInit() {
  const vaultPath = useWorkspaceStore((s: { vaultPath: string | null }) => s.vaultPath);
  const setFileTree = useWorkspaceStore(
    (s: { setFileTree: (tree: FileEntry[]) => void }) => s.setFileTree,
  );
  const setVault = useWorkspaceStore((s: { setVault: (path: string) => void }) => s.setVault);
  const setVaultReady = useWorkspaceStore(
    (s: { setVaultReady: (ready: boolean) => void }) => s.setVaultReady,
  );
  const initialized = useRef(false);

  useEffect(() => {
    if (!vaultPath || initialized.current) return;
    initialized.current = true;

    VaultService.openVault(vaultPath)
      .then(() => {
        setVaultReady(true);
        return VaultService.listFiles(vaultPath);
      })
      .then((entries: RustFileEntry[]) => setFileTree(mapFileEntries(entries)))
      .catch((err: unknown) => {
        console.error('Failed to load vault:', err);
        setVault('');
      });
  }, [vaultPath, setFileTree, setVault, setVaultReady]);
}
