import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { invalidateImage, isImagePath } from '../utils/imageFiles';

export function useFileEvents() {
  const vaultPath = useWorkspaceStore((s: { vaultPath: string | null }) => s.vaultPath);
  const setFileTree = useWorkspaceStore(
    (s: { setFileTree: (tree: FileEntry[]) => void }) => s.setFileTree,
  );

  useEffect(() => {
    if (!vaultPath) return;

    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const refresh = async (event: { payload: { path: string } }) => {
        if (isImagePath(event.payload.path)) invalidateImage(event.payload.path);
        const tree = await VaultService.listFiles(vaultPath);
        setFileTree(mapFileEntries(tree));
      };

      const unlisten1 = await listen<{ path: string }>('fs:created', refresh);
      unlisteners.push(unlisten1);

      const unlisten2 = await listen<{ path: string }>('fs:modified', refresh);
      unlisteners.push(unlisten2);

      const unlisten3 = await listen<{ path: string }>('fs:deleted', refresh);
      unlisteners.push(unlisten3);
    };

    setup();
    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [vaultPath, setFileTree]);
}
