import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { templates, type Template } from '../data/templates';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { useToastStore } from './Toast';

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'template' | 'details' | 'folder';

const TYPE_COLORS: Record<string, string> = {
  md: 'var(--color-accent)',
  mermaid: 'var(--color-success)',
  excalidraw: 'var(--color-warning)',
};

const TYPE_LABELS: Record<string, string> = {
  md: 'Markdown',
  mermaid: 'Mermaid',
  excalidraw: 'Excalidraw',
};

export function CreateModal({ open, onClose }: CreateModalProps) {
  const [step, setStep] = useState<Step>('template');
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const { vaultPath, fileTree, setFileTree, openFile } = useWorkspaceStore();
  const { addToast } = useToastStore();

  // Get all folders for the folder picker
  const folders = useMemo(() => {
    const result: { path: string; name: string; depth: number }[] = [
      { path: '', name: '/ (root)', depth: 0 },
    ];
    function walk(entries: FileEntry[], depth: number) {
      for (const entry of entries) {
        if (entry.isDirectory) {
          const rel = vaultPath ? entry.path.replace(vaultPath, '').replace(/^\//, '') : entry.name;
          result.push({ path: rel, name: rel, depth });
          if (entry.children) walk(entry.children, depth + 1);
        }
      }
    }
    walk(fileTree, 1);
    return result;
  }, [fileTree, vaultPath]);

  // Filter templates by search
  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.fileType.includes(q),
    );
  }, [search]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('template');
      setSearch('');
      setSelectedTemplate(null);
      setFileName('');
      setSelectedFolder('');
      setFocusIndex(0);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Focus name input on step change
  useEffect(() => {
    if (step === 'details' || step === 'folder') {
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [step]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'details') {
          setStep('template');
        } else {
          onClose();
        }
        return;
      }
      if (step === 'template') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered.length > 0) {
          e.preventDefault();
          handleSelectTemplate(filtered[focusIndex]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, step, filtered, focusIndex, onClose]);

  // Reset focus when filter changes
  useEffect(() => {
    setFocusIndex(0);
  }, [search]);

  const handleSelectTemplate = (tmpl: Template) => {
    setSelectedTemplate(tmpl);
    setFileName(tmpl.suggestedName);
    setStep('details');
  };

  const extensions: Record<string, string> = {
    md: '.md',
    excalidraw: '.excalidraw',
    mermaid: '.mermaid',
  };

  const handleCreate = useCallback(async () => {
    if (!selectedTemplate || !fileName.trim() || !vaultPath) return;
    const ext = extensions[selectedTemplate.fileType];
    const name = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    const dir = selectedFolder ? `${vaultPath}/${selectedFolder}`.replace(/\/+$/, '') : vaultPath;
    const fullPath = `${dir}/${name}`;

    try {
      const createdPath = await VaultService.createFile(fullPath, selectedTemplate.fileType);
      if (selectedTemplate.content) {
        await VaultService.writeFile(createdPath, selectedTemplate.content);
      }
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
      openFile(createdPath);
      onClose();
    } catch (err) {
      addToast(`Failed to create: ${err}`, 'error');
    }
  }, [
    selectedTemplate,
    fileName,
    vaultPath,
    selectedFolder,
    setFileTree,
    openFile,
    onClose,
    addToast,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!fileName.trim() || !vaultPath) return;
    const dir = selectedFolder ? `${vaultPath}/${selectedFolder}`.replace(/\/+$/, '') : vaultPath;
    const fullPath = `${dir}/${fileName.trim()}`;

    try {
      await VaultService.createDir(fullPath);
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
      onClose();
    } catch (err) {
      addToast(`Failed to create folder: ${err}`, 'error');
    }
  }, [fileName, vaultPath, selectedFolder, setFileTree, onClose, addToast]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] backdrop-blur-sm bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-1 border border-default rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'template' && (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b border-default">
              <div className="flex items-center gap-3">
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="flex-1 bg-transparent text-sm text-primary outline-none placeholder-muted"
                />
                <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-default text-muted font-mono text-xs">
                  Esc
                </kbd>
              </div>
            </div>

            {/* Template grid */}
            <div className="max-h-[50vh] overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted">
                  No templates match &quot;{search}&quot;
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((tmpl, i) => (
                    <TemplateCard
                      key={tmpl.id}
                      template={tmpl}
                      focused={i === focusIndex}
                      onClick={() => handleSelectTemplate(tmpl)}
                      onMouseEnter={() => setFocusIndex(i)}
                    />
                  ))}
                  {/* New Folder card */}
                  <button
                    onClick={() => {
                      setFileName('');
                      setStep('folder');
                    }}
                    className={`text-left p-3 rounded-lg border border-default hover:border-accent/50 bg-surface-0 transition-all`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{
                          backgroundColor:
                            'color-mix(in srgb, var(--color-text-muted) 15%, transparent)',
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="var(--color-text-muted)"
                        >
                          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1.5 1.5 0 011.06.44l.658.658A1.5 1.5 0 008.45 3.5H13.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-primary mb-0.5">New Folder</div>
                    <div className="text-xs text-muted leading-relaxed line-clamp-2">
                      Create an empty folder
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-default flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono">
                  Esc
                </kbd>
                Close
              </span>
            </div>
          </>
        )}
        {step === 'details' && (
          <>
            {/* Details header */}
            <div className="px-5 py-4 border-b border-default">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('template')}
                  className="p-1 rounded hover:bg-surface-2 text-muted hover:text-primary transition-colors"
                >
                  <BackIcon />
                </button>
                <div>
                  <h3 className="text-sm font-medium text-primary">{selectedTemplate?.label}</h3>
                  <p className="text-xs text-muted">{selectedTemplate?.description}</p>
                </div>
                <span
                  className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${TYPE_COLORS[selectedTemplate?.fileType ?? 'md']} 15%, transparent)`,
                    color: TYPE_COLORS[selectedTemplate?.fileType ?? 'md'],
                  }}
                >
                  {TYPE_LABELS[selectedTemplate?.fileType ?? 'md']}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              {/* Filename */}
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">File Name</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={nameRef}
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setStep('template');
                    }}
                    placeholder={selectedTemplate?.suggestedName ?? 'filename'}
                    className="flex-1 bg-surface-2 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-accent placeholder-muted transition-colors"
                  />
                  <span className="text-xs text-muted font-mono">
                    {extensions[selectedTemplate?.fileType ?? 'md']}
                  </span>
                </div>
              </div>

              {/* Folder picker */}
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Location</label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full bg-surface-2 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-accent cursor-pointer transition-colors"
                >
                  {folders.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.depth > 0
                        ? '\u00A0\u00A0'.repeat(f.depth - 1) + '└ ' + f.name.split('/').pop()
                        : f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {selectedTemplate && selectedTemplate.content && (
                <div>
                  <label className="text-xs font-medium text-secondary mb-1.5 block">Preview</label>
                  <div className="bg-surface-0 border border-default rounded-lg p-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-muted font-mono whitespace-pre-wrap leading-relaxed">
                      {selectedTemplate.content.slice(0, 400)}
                      {selectedTemplate.content.length > 400 && '...'}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-default flex items-center justify-between">
              <span className="text-xs text-muted">
                Press{' '}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono text-xs">
                  ↵
                </kbd>{' '}
                to create
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('template')}
                  className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!fileName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Create File
                </button>
              </div>
            </div>
          </>
        )}
        {step === 'folder' && (
          <>
            {/* Folder header */}
            <div className="px-5 py-4 border-b border-default">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep('template')}
                  className="p-1 rounded hover:bg-surface-2 text-muted hover:text-primary transition-colors"
                >
                  <BackIcon />
                </button>
                <div>
                  <h3 className="text-sm font-medium text-primary">New Folder</h3>
                  <p className="text-xs text-muted">Create a new folder in your vault</p>
                </div>
              </div>
            </div>

            {/* Folder form */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">
                  Folder Name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') setStep('template');
                  }}
                  placeholder="new-folder"
                  className="w-full bg-surface-2 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-accent placeholder-muted transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Location</label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="w-full bg-surface-2 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-accent cursor-pointer transition-colors"
                >
                  {folders.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.depth > 0
                        ? '\u00A0\u00A0'.repeat(f.depth - 1) + '└ ' + f.name.split('/').pop()
                        : f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-default flex items-center justify-between">
              <span className="text-xs text-muted">
                Press{' '}
                <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default font-mono text-xs">
                  ↵
                </kbd>{' '}
                to create
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('template')}
                  className="px-3 py-1.5 text-xs text-secondary hover:text-primary transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!fileName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Create Folder
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Template Card ---

function TemplateCard({
  template,
  focused,
  onClick,
  onMouseEnter,
}: {
  template: Template;
  focused: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`text-left p-3 rounded-lg border transition-all ${
        focused
          ? 'border-accent bg-accent-glow'
          : 'border-default hover:border-accent/50 bg-surface-0'
      }`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <TemplateIcon icon={template.icon} fileType={template.fileType} />
        <span
          className="px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            backgroundColor: `color-mix(in srgb, ${TYPE_COLORS[template.fileType]} 12%, transparent)`,
            color: TYPE_COLORS[template.fileType],
          }}
        >
          {template.fileType}
        </span>
      </div>
      <div className="text-xs font-medium text-primary mb-0.5">{template.label}</div>
      <div className="text-xs text-muted leading-relaxed line-clamp-2">{template.description}</div>
    </button>
  );
}

// --- Icons ---

function TemplateIcon({ icon, fileType }: { icon: string; fileType: string }) {
  const color = TYPE_COLORS[fileType];
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
    >
      <TemplateIconSvg icon={icon} color={color} />
    </div>
  );
}

function TemplateIconSvg({ icon, color }: { icon: string; color: string }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'doc':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'arch':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="8" y="14" width="7" height="7" />
          <line x1="6.5" y1="10" x2="11.5" y2="14" />
          <line x1="17.5" y1="10" x2="11.5" y2="14" />
        </svg>
      );
    case 'decision':
      return (
        <svg {...props}>
          <path d="M12 3l9 5v8l-9 5-9-5V8z" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    case 'meeting':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'feature':
      return (
        <svg {...props}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'api':
      return (
        <svg {...props}>
          <path d="M4 11a9 9 0 0118 0" />
          <path d="M4 11a9 9 0 0018 0" />
          <line x1="12" y1="2" x2="12" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      );
    case 'ops':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'flow':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="4" rx="1" />
          <rect x="3" y="17" width="18" height="4" rx="1" />
          <line x1="12" y1="7" x2="12" y2="17" />
          <polyline points="8 13 12 17 16 13" />
        </svg>
      );
    case 'sequence':
      return (
        <svg {...props}>
          <line x1="6" y1="3" x2="6" y2="21" />
          <line x1="18" y1="3" x2="18" y2="21" />
          <line x1="6" y1="8" x2="18" y2="8" />
          <polyline points="15 5 18 8 15 11" />
          <line x1="18" y1="16" x2="6" y2="16" />
          <polyline points="9 13 6 16 9 19" />
        </svg>
      );
    case 'class':
      return (
        <svg {...props}>
          <rect x="4" y="2" width="16" height="6" rx="1" />
          <rect x="4" y="16" width="7" height="6" rx="1" />
          <rect x="13" y="16" width="7" height="6" rx="1" />
          <line x1="7.5" y1="8" x2="7.5" y2="16" />
          <line x1="16.5" y1="8" x2="16.5" y2="16" />
          <line x1="12" y1="8" x2="12" y2="12" />
        </svg>
      );
    case 'database':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case 'state':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <polyline points="10 7 12 9 14 7" />
        </svg>
      );
    case 'canvas':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 12l3 3 5-5" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BackIcon() {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
