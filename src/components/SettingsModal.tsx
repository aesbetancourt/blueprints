import { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'editor' | 'file' | 'token' | 'notes' | 'shortcuts';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'file', label: 'Files' },
  { id: 'token', label: 'Tokens' },
  { id: 'notes', label: 'Notes' },
  { id: 'shortcuts', label: 'Shortcuts' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

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
        className="w-full max-w-lg bg-surface-1 border border-default rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-default">
          <h2 className="text-primary text-sm font-medium">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors text-xs"
            title="Close (Esc)"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 pt-3 gap-1 border-b border-default">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors -mb-px border-b-2 ${
                activeTab === tab.id
                  ? 'text-accent border-accent bg-surface-2/50'
                  : 'text-secondary border-transparent hover:text-primary hover:bg-surface-2/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {activeTab === 'editor' && <EditorSection />}
          {activeTab === 'file' && <FileSection />}
          {activeTab === 'token' && <TokenSection />}
          {activeTab === 'notes' && <NotesSection />}
          {activeTab === 'shortcuts' && <ShortcutsSection />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-default bg-surface-0/50">
          <button
            onClick={() => useSettingsStore.getState().resetAll()}
            className="text-xs text-muted hover:text-error transition-colors"
          >
            Reset to defaults
          </button>
          <span className="text-xs text-muted">Changes saved automatically</span>
        </div>
      </div>
    </div>
  );
}

// --- Editor Section ---

function EditorSection() {
  const { editor, updateEditor } = useSettingsStore();

  return (
    <div className="space-y-4">
      <SettingRow label="Font Size" description="Editor text size in pixels">
        <NumberInput
          value={editor.fontSize}
          onChange={(v) => updateEditor({ fontSize: v })}
          min={10}
          max={24}
          step={1}
          unit="px"
        />
      </SettingRow>

      <SettingRow label="Font Family" description="Editor typeface">
        <select
          value={editor.fontFamily}
          onChange={(e) => updateEditor({ fontFamily: e.target.value })}
          className="settings-select"
        >
          <option value="'Inter', system-ui, sans-serif">Inter (Default)</option>
          <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          <option value="'Fira Code', monospace">Fira Code</option>
          <option value="'SF Mono', monospace">SF Mono</option>
          <option value="system-ui, sans-serif">System UI</option>
          <option value="Georgia, serif">Georgia</option>
        </select>
      </SettingRow>

      <SettingRow label="Line Height" description="Space between lines">
        <NumberInput
          value={editor.lineHeight}
          onChange={(v) => updateEditor({ lineHeight: v })}
          min={1.2}
          max={2.5}
          step={0.05}
        />
      </SettingRow>

      <SettingRow label="Tab Size" description="Number of spaces per tab">
        <NumberInput
          value={editor.tabSize}
          onChange={(v) => updateEditor({ tabSize: v })}
          min={1}
          max={8}
          step={1}
        />
      </SettingRow>

      <SettingRow label="Word Wrap" description="Wrap long lines to fit the editor width">
        <Toggle checked={editor.wordWrap} onChange={(v) => updateEditor({ wordWrap: v })} />
      </SettingRow>
    </div>
  );
}

// --- File Section ---

function FileSection() {
  const { file, updateFile } = useSettingsStore();
  const [patternInput, setPatternInput] = useState('');

  return (
    <div className="space-y-4">
      <SettingRow label="Default File Type" description="Type for newly created files">
        <select
          value={file.defaultFileType}
          onChange={(e) =>
            updateFile({ defaultFileType: e.target.value as 'md' | 'excalidraw' | 'mermaid' })
          }
          className="settings-select"
        >
          <option value="md">Markdown</option>
          <option value="excalidraw">Excalidraw</option>
          <option value="mermaid">Mermaid</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Include Patterns"
        description="Only files matching these patterns will be shown (e.g. *.md, *.excalidraw)"
      >
        <div className="space-y-2 w-full">
          <div className="flex flex-wrap gap-1.5">
            {(file.includePatterns ?? []).map((pattern) => (
              <span
                key={pattern}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-default text-xs text-secondary"
              >
                {pattern}
                <button
                  onClick={() =>
                    updateFile({
                      includePatterns: (file.includePatterns ?? []).filter((p) => p !== pattern),
                    })
                  }
                  className="text-muted hover:text-error ml-0.5"
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = patternInput.trim();
              if (trimmed && !(file.includePatterns ?? []).includes(trimmed)) {
                updateFile({ includePatterns: [...(file.includePatterns ?? []), trimmed] });
                setPatternInput('');
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              placeholder="Add pattern (e.g. *.md)..."
              className="settings-input flex-1"
            />
            <button type="submit" className="settings-btn-sm">
              Add
            </button>
          </form>
        </div>
      </SettingRow>
    </div>
  );
}

// --- Token Section ---

function TokenSection() {
  const { token, updateToken } = useSettingsStore();

  return (
    <div className="space-y-4">
      <SettingRow
        label="Characters per Token"
        description="Ratio used for approximate token counting in the status bar. GPT models average ~4 chars/token for English."
      >
        <NumberInput
          value={token.charsPerToken}
          onChange={(v) => updateToken({ charsPerToken: v })}
          min={1}
          max={10}
          step={0.5}
        />
      </SettingRow>

      <div className="rounded-lg bg-surface-2/50 border border-default p-3">
        <p className="text-xs text-muted leading-relaxed">
          Common ratios: <strong className="text-secondary">4</strong> (GPT-4, English),{' '}
          <strong className="text-secondary">3</strong> (code-heavy),{' '}
          <strong className="text-secondary">3.5</strong> (mixed content),{' '}
          <strong className="text-secondary">2.5</strong> (non-Latin scripts)
        </p>
      </div>
    </div>
  );
}

// --- Notes Section ---

function NotesSection() {
  const { quickNote, updateQuickNote } = useSettingsStore();

  return (
    <div className="space-y-4">
      <SettingRow
        label="Quick Note Name"
        description="Template for auto-generated note filenames. Available variables: {date}, {time}, {timestamp}, {iso}"
      >
        <input
          type="text"
          value={quickNote.nameTemplate}
          onChange={(e) => updateQuickNote({ nameTemplate: e.target.value })}
          placeholder="note-{date}-{time}"
          className="settings-input w-48"
        />
      </SettingRow>

      <SettingRow
        label="Quick Note Folder"
        description="Folder (relative to vault root) where quick notes are saved"
      >
        <input
          type="text"
          value={quickNote.folder}
          onChange={(e) => updateQuickNote({ folder: e.target.value })}
          placeholder="scratch"
          className="settings-input w-48"
        />
      </SettingRow>

      <div className="rounded-lg bg-surface-2/50 border border-default p-3">
        <p className="text-xs text-muted leading-relaxed mb-2">
          <strong className="text-secondary">Variables:</strong>
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <span className="text-muted">
            <code className="text-secondary">{'{date}'}</code> — 2026-05-25
          </span>
          <span className="text-muted">
            <code className="text-secondary">{'{time}'}</code> — 14-30-22
          </span>
          <span className="text-muted">
            <code className="text-secondary">{'{timestamp}'}</code> — 1748193022
          </span>
          <span className="text-muted">
            <code className="text-secondary">{'{iso}'}</code> — 2026-05-25T14-30-22
          </span>
        </div>
        <p className="text-xs text-muted mt-2">
          Preview:{' '}
          <code className="text-secondary">{resolveNoteTemplate(quickNote.nameTemplate)}.md</code>
        </p>
      </div>
    </div>
  );
}

function resolveNoteTemplate(template: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const iso = now.toISOString().replace(/[T:]/g, '-').replace(/\..+/, '');

  return template
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{timestamp\}/g, timestamp)
    .replace(/\{iso\}/g, iso);
}

// --- Shortcuts Section ---

function ShortcutsSection() {
  const { shortcuts } = useSettingsStore();

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted mb-3">
        Keyboard shortcut reference. Shortcuts are currently read-only.
      </p>
      {shortcuts.map((sc) => (
        <div key={sc.id} className="flex items-center justify-between py-1.5">
          <span className="text-xs text-secondary">{sc.label}</span>
          <div className="flex items-center gap-1">
            {sc.keys.split('').map((char, i) => {
              // Group chars that are part of a key combo
              return (
                <kbd
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-surface-2 border border-default text-secondary font-mono text-xs"
                >
                  {char}
                </kbd>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Shared components ---

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-primary">{label}</div>
        {description && <div className="text-xs text-muted mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        min={min}
        max={max}
        step={step}
        className="settings-input w-20 text-right"
      />
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-surface-3'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
