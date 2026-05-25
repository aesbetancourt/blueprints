import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  {
    title: 'General',
    shortcuts: [
      { label: 'Command Palette', keys: ['⌘', 'P'] },
      { label: 'Search in Files', keys: ['⌘', '⇧', 'F'] },
      { label: 'New File', keys: ['⌘', 'N'] },
      { label: 'Save', keys: ['⌘', 'S'] },
      { label: 'Keyboard Shortcuts', keys: ['⌘', '?'] },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { label: 'Close Tab', keys: ['⌘', 'W'] },
      { label: 'Previous Tab', keys: ['⌘', '⇧', '['] },
      { label: 'Next Tab', keys: ['⌘', '⇧', ']'] },
    ],
  },
  {
    title: 'Editor (Markdown)',
    shortcuts: [
      { label: 'Bold', keys: ['⌘', 'B'] },
      { label: 'Italic', keys: ['⌘', 'I'] },
      { label: 'Insert Link', keys: ['⌘', 'K'] },
    ],
  },
];

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-1 border border-default rounded-xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-primary text-sm font-medium mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-secondary text-xs font-medium mb-2 uppercase tracking-wide">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div key={shortcut.label} className="flex items-center justify-between">
                    <span className="text-secondary text-xs">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-surface-2 border border-default text-secondary font-mono text-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
