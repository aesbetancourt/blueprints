import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, X } from 'lucide-react';
import { confirm } from './ConfirmDialog';

const STORAGE_KEY = 'blueprints-scratchpad';
const SAVE_DELAY = 500;

interface ScratchPadProps {
  open: boolean;
  onClose: () => void;
  onQuickNote: () => void;
}

export function ScratchPad({ open, onClose, onQuickNote }: ScratchPadProps) {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [height, setHeight] = useState(() => {
    const stored = localStorage.getItem('blueprints-scratchpad-height');
    return stored ? Number(stored) : 200;
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setContent(stored);
  }, []);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  // Auto-save with debounce
  const handleChange = useCallback((value: string) => {
    setContent(value);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, value);
      setSaved(true);
    }, SAVE_DELAY);
  }, []);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Save current content
      const el = textareaRef.current;
      if (el) localStorage.setItem(STORAGE_KEY, el.value);
    };
  }, []);

  const handleClear = useCallback(async () => {
    if (content.trim()) {
      const confirmed = await confirm({
        title: 'Clear Scratch Pad',
        message: 'Are you sure you want to clear the scratch pad? This cannot be undone.',
        confirmLabel: 'Clear',
        danger: true,
      });
      if (!confirmed) return;
    }
    setContent('');
    localStorage.setItem(STORAGE_KEY, '');
    setSaved(true);
  }, [content]);

  // Promote current content to a quick note file
  const handlePromote = useCallback(() => {
    onQuickNote();
  }, [onQuickNote]);

  // Resize drag handling
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      startY.current = e.clientY;
      startHeight.current = height;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const delta = startY.current - ev.clientY;
        const newHeight = Math.max(
          120,
          Math.min(startHeight.current + delta, window.innerHeight * 0.7),
        );
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        resizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Persist height
        localStorage.setItem('blueprints-scratchpad-height', String(height));
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [height],
  );

  // Persist height when it changes
  useEffect(() => {
    localStorage.setItem('blueprints-scratchpad-height', String(height));
  }, [height]);

  if (!open) return null;

  return (
    <div
      className="border-t border-default bg-surface-1 flex flex-col"
      style={{ height: `${height}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="h-1 shrink-0 cursor-row-resize hover:bg-accent/30 transition-colors group flex items-center justify-center"
      >
        <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-accent/60 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-default bg-surface-0 shrink-0">
        <div className="flex items-center gap-2">
          <NotepadIcon />
          <span className="text-xs font-medium text-secondary uppercase tracking-wide">
            Scratch Pad
          </span>
          <span className="text-xs text-muted">{saved ? '' : '(saving...)'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePromote}
            className="px-2 py-0.5 rounded text-xs text-muted hover:text-primary hover:bg-surface-2 transition-colors"
            title="Save as quick note file (⌘⇧N)"
          >
            Promote
          </button>
          <button
            onClick={handleClear}
            className="px-2 py-0.5 rounded text-xs text-muted hover:text-primary hover:bg-surface-2 transition-colors"
            title="Clear scratch pad"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-primary transition-colors"
            title="Close (⌘J)"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down quick notes, ideas, or snippets... (auto-saved)"
        className="flex-1 w-full resize-none bg-transparent px-4 py-3 text-sm text-primary font-mono leading-relaxed outline-none placeholder-muted"
        spellCheck={false}
      />

      {/* Footer */}
      <div className="px-3 py-1 border-t border-default flex items-center justify-between text-xs text-muted shrink-0">
        <span>{content.length} chars</span>
        <span className="flex items-center gap-3">
          <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">⌘J</kbd>
          <span>Toggle</span>
          <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
            ⌘⇧N
          </kbd>
          <span>Quick note file</span>
        </span>
      </div>
    </div>
  );
}

function NotepadIcon() {
  return <FileText size={12} className="text-muted" />;
}

function CloseIcon() {
  return <X size={12} />;
}
