import { create } from 'zustand';
import { X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'info' | 'success';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = Date.now().toString();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const toastStyles: Record<Toast['type'], string> = {
  error: 'bg-red-950/90 text-red-200 border-red-800/60',
  success: 'bg-green-950/90 text-green-200 border-green-800/60',
  info: 'bg-surface-2 text-primary border-default',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-3 border backdrop-blur-sm ${toastStyles[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-inherit opacity-50 hover:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
