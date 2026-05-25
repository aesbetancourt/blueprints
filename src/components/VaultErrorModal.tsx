import { useWorkspaceStore } from '../store/workspace';
import { open } from '@tauri-apps/plugin-dialog';

interface VaultErrorModalProps {
  visible: boolean;
  onRetry: () => void;
}

export function VaultErrorModal({ visible, onRetry }: VaultErrorModalProps) {
  const setVault = useWorkspaceStore((s: { setVault: (p: string) => void }) => s.setVault);

  if (!visible) return null;

  const handleSelectVault = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setVault(selected as string);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-default rounded-xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-base font-semibold text-primary mb-2">Vault inaccessible</h2>
        <p className="text-secondary text-sm mb-6">
          The vault directory could not be accessed. It may have been moved or deleted.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm rounded-lg bg-surface-3 text-secondary hover:text-primary transition-colors"
          >
            Retry
          </button>
          <button
            onClick={handleSelectVault}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:brightness-110 transition-all font-medium"
          >
            Select New Vault
          </button>
        </div>
      </div>
    </div>
  );
}
