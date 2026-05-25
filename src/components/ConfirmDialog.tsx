import { create } from 'zustand';
import { useEffect, useRef } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  show: (options: ConfirmOptions) => Promise<boolean>;
  close: (result: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  options: null,
  resolve: null,

  show: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ options, resolve });
    });
  },

  close: (result) => {
    const { resolve } = get();
    resolve?.(result);
    set({ options: null, resolve: null });
  },
}));

/** Imperative helper — call from anywhere without hooks */
export const confirm = (options: ConfirmOptions) => useConfirmStore.getState().show(options);

export function ConfirmDialog() {
  const { options, close } = useConfirmStore();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!options) return;
    confirmRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [options, close]);

  if (!options) return null;

  const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger } = options;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-default rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
        <p className="text-secondary text-xs mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => close(false)}
            className="px-3 py-1.5 text-xs rounded-lg bg-surface-3 text-secondary hover:text-primary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={() => close(true)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              danger
                ? 'bg-danger text-white hover:brightness-110'
                : 'bg-accent text-white hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
