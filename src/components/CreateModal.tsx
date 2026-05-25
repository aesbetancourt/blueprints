import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { templates, type Template } from '../data/templates';
import { useWorkspaceStore, type FileEntry } from '../store/workspace';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { useToastStore } from './Toast';
import {
  Search,
  ChevronLeft,
  FolderClosed,
  FileText,
  LayoutGrid,
  Hexagon,
  Users,
  Star,
  Globe,
  Shield,
  Workflow,
  ArrowLeftRight,
  Boxes,
  Database,
  Circle,
  PenTool,
  Braces,
  File,
} from 'lucide-react';

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'template' | 'details' | 'folder';

const TYPE_COLORS: Record<string, string> = {
  md: 'var(--color-accent)',
  mermaid: 'var(--color-success)',
  excalidraw: 'var(--color-warning)',
  json: '#3b82f6',
};

const TYPE_LABELS: Record<string, string> = {
  md: 'Markdown',
  mermaid: 'Mermaid',
  excalidraw: 'Excalidraw',
  json: 'JSON',
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
    json: '.json',
  };

  const handleCreate = useCallback(async () => {
    if (!selectedTemplate || !fileName.trim() || !vaultPath) return;
    const ext = extensions[selectedTemplate.fileType];
    const name = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    const dir = selectedFolder ? `${vaultPath}/${selectedFolder}`.replace(/\/+$/, '') : vaultPath;
    const fullPath = `${dir}/${name}`;

    try {
      const exists = await VaultService.fileExists(fullPath);
      if (exists) {
        addToast(`A file named "${name}" already exists in this folder`, 'error');
        return;
      }
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
                <Search size={16} className="text-muted" />
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
                        <FolderClosed size={14} color="var(--color-text-muted)" />
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
                  <ChevronLeft size={14} />
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
                  <ChevronLeft size={14} />
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
  const iconProps = { size: 14, color };

  switch (icon) {
    case 'doc':
      return <FileText {...iconProps} />;
    case 'arch':
      return <LayoutGrid {...iconProps} />;
    case 'decision':
      return <Hexagon {...iconProps} />;
    case 'meeting':
      return <Users {...iconProps} />;
    case 'feature':
      return <Star {...iconProps} />;
    case 'api':
      return <Globe {...iconProps} />;
    case 'ops':
      return <Shield {...iconProps} />;
    case 'flow':
      return <Workflow {...iconProps} />;
    case 'sequence':
      return <ArrowLeftRight {...iconProps} />;
    case 'class':
      return <Boxes {...iconProps} />;
    case 'database':
      return <Database {...iconProps} />;
    case 'state':
      return <Circle {...iconProps} />;
    case 'canvas':
      return <PenTool {...iconProps} />;
    case 'json':
      return <Braces {...iconProps} />;
    default:
      return <File {...iconProps} />;
  }
}
