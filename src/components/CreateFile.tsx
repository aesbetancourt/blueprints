import { useState, useRef, useEffect } from 'react';
import { FolderClosed, Plus } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace';
import { VaultService } from '../services/vault';
import { mapFileEntries } from '../utils/mapFileEntries';
import { useToastStore } from './Toast';
import { templates, type Template } from '../data/templates';

type FileType = 'md' | 'excalidraw' | 'mermaid' | 'json';

interface NewFileMenuProps {
  targetDir?: string;
  onClose: () => void;
  position?: { x: number; y: number };
}

function NewFileMenu({ targetDir, onClose, position }: NewFileMenuProps) {
  const [step, setStep] = useState<'type' | 'template' | 'name' | 'folder'>('type');
  const [selectedType, setSelectedType] = useState<FileType>('md');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());

  const { vaultPath, setFileTree, openFile } = useWorkspaceStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (step === 'name' || step === 'folder') inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Ignore clicks within the first 100ms (prevents right-click from closing immediately)
      if (Date.now() - mountedAt.current < 100) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use click instead of mousedown to avoid race with button onClick handlers
    document.addEventListener('click', handler, true);
    document.addEventListener('contextmenu', handler, true);
    return () => {
      document.removeEventListener('click', handler, true);
      document.removeEventListener('contextmenu', handler, true);
    };
  }, [onClose]);

  const extensions: Record<FileType, string> = {
    md: '.md',
    excalidraw: '.excalidraw',
    mermaid: '.mermaid',
    json: '.json',
  };

  const handleTypeSelect = (type: FileType) => {
    setSelectedType(type);
    const typeTemplates = templates.filter((t) => t.fileType === type);
    if (typeTemplates.length > 1) {
      setStep('template');
    } else {
      setSelectedTemplate(typeTemplates[0] ?? null);
      setFileName('');
      setStep('name');
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setFileName('');
    setStep('name');
  };

  const handleFolderStep = () => {
    setFileName('');
    setStep('folder');
  };

  const handleCreate = async () => {
    if (!fileName.trim() || !vaultPath) return;
    const dir = (targetDir || vaultPath).replace(/\/+$/, '');
    const ext = extensions[selectedType];
    const name = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
    const fullPath = `${dir}/${name}`;
    const templateContent = selectedTemplate?.content ?? '';
    try {
      const createdPath = await VaultService.createFile(fullPath, selectedType);
      // If we have template content, write it
      if (templateContent) {
        await VaultService.writeFile(createdPath, templateContent);
      }
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
      openFile(createdPath);
      onClose();
    } catch (err) {
      addToast(`Failed to create file: ${err}`, 'error');
    }
  };

  const handleCreateFolder = async () => {
    if (!fileName.trim() || !vaultPath) return;
    const dir = (targetDir || vaultPath).replace(/\/+$/, '');
    const fullPath = `${dir}/${fileName.trim()}`;
    try {
      await VaultService.createDir(fullPath);
      const tree = await VaultService.listFiles(vaultPath);
      setFileTree(mapFileEntries(tree));
      onClose();
    } catch (err) {
      addToast(`Failed to create folder: ${err}`, 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'folder') handleCreateFolder();
      else handleCreate();
    }
    if (e.key === 'Escape') onClose();
  };

  const style = position ? { position: 'fixed' as const, left: position.x, top: position.y } : {};

  const typeTemplates = templates.filter((t) => t.fileType === selectedType);

  return (
    <div
      ref={menuRef}
      className="bg-surface-1 border border-default rounded-xl shadow-2xl z-50 w-56 overflow-hidden"
      style={style}
    >
      {step === 'type' && (
        <div className="py-1.5">
          <div className="px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wider">
            Create
          </div>
          <button
            onClick={() => handleTypeSelect('md')}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex items-center gap-2.5"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-accent)' }}
            />
            Markdown
          </button>
          <button
            onClick={() => handleTypeSelect('excalidraw')}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex items-center gap-2.5"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-warning)' }}
            />
            Excalidraw
          </button>
          <button
            onClick={() => handleTypeSelect('mermaid')}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex items-center gap-2.5"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-success)' }}
            />
            Mermaid
          </button>
          <button
            onClick={() => handleTypeSelect('json')}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex items-center gap-2.5"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--color-info, #3b82f6)' }}
            />
            JSON
          </button>
          <div className="border-t border-default my-1" />
          <button
            onClick={handleFolderStep}
            className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex items-center gap-2.5"
          >
            <FolderClosed size={12} className="shrink-0 text-muted" />
            Folder
          </button>
        </div>
      )}
      {step === 'template' && (
        <div className="py-1.5">
          <div className="px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wider">
            Template
          </div>
          {typeTemplates.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleTemplateSelect(tmpl)}
              className="w-full text-left px-3 py-2 text-sm text-secondary hover:bg-surface-2 hover:text-primary flex flex-col"
            >
              <span className="text-xs text-primary">{tmpl.label}</span>
              <span className="text-xs text-muted">{tmpl.description}</span>
            </button>
          ))}
          <div className="border-t border-default my-1" />
          <button
            onClick={() => setStep('type')}
            className="w-full text-left px-3 py-2 text-xs text-muted hover:text-secondary"
          >
            &larr; Back
          </button>
        </div>
      )}
      {step === 'name' && (
        <div className="p-3">
          <div className="text-xs text-muted mb-2">
            File name{selectedTemplate ? ` (${selectedTemplate.label})` : ''}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`untitled${extensions[selectedType]}`}
            className="w-full bg-surface-0 border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder-[var(--color-text-muted)] outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() =>
                setStep(
                  templates.filter((t) => t.fileType === selectedType).length > 1
                    ? 'template'
                    : 'type',
                )
              }
              className="text-xs text-muted hover:text-secondary px-2 py-1"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={!fileName.trim()}
              className="text-xs bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-medium"
            >
              Create
            </button>
          </div>
        </div>
      )}
      {step === 'folder' && (
        <div className="p-3">
          <div className="text-xs text-muted mb-2">Folder name</div>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="new-folder"
            className="w-full bg-surface-0 border border-default rounded-md px-2.5 py-1.5 text-sm text-primary placeholder-[var(--color-text-muted)] outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setStep('type')}
              className="text-xs text-muted hover:text-secondary px-2 py-1"
            >
              Back
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!fileName.trim()}
              className="text-xs bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md font-medium"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateFileButton() {
  return (
    <div className="relative">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-create-modal'))}
        className="p-1.5 rounded-md hover:bg-surface-2 text-muted hover:text-primary transition-colors"
        title="New file (⌘N)"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function ContextMenu({
  targetDir,
  position,
  onClose,
}: {
  targetDir: string;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  return <NewFileMenu targetDir={targetDir} position={position} onClose={onClose} />;
}
