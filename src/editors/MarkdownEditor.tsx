import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { open } from '@tauri-apps/plugin-shell';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table';
import { TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { WikiLink } from './extensions/WikiLink';
import { WikiLinkSuggestion } from './extensions/WikiLinkSuggestion';
import { SlashCommands } from './extensions/SlashCommands';
import { MermaidCodeBlock } from './extensions/MermaidBlock';
import { useWorkspaceStore } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { MarkdownToolbar } from './MarkdownToolbar';
import { TableControls } from './TableControls';
import { FindBar } from './FindBar';
import './markdown-editor.css';

type EditorMode = 'rich' | 'raw';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onUserEdit?: (content: string) => void;
  mode?: EditorMode;
}

export function MarkdownEditor({
  content,
  onChange,
  onUserEdit,
  mode = 'rich',
}: MarkdownEditorProps) {
  const openFile = useWorkspaceStore((s: { openFile: (p: string) => void }) => s.openFile);
  const editorSettings = useSettingsStore((s) => s.editor);
  const [findOpen, setFindOpen] = useState(false);
  const [rawContent, setRawContent] = useState(content);
  const rawRef = useRef<HTMLTextAreaElement>(null);
  const prevMode = useRef(mode);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      MermaidCodeBlock,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-400 underline' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Start writing...',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
      }),
      Markdown.configure({ html: false }),
      WikiLink,
      WikiLinkSuggestion,
      SlashCommands,
    ],
    content,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    onCreate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown();
      onChange(md);
    },
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown();
      (onUserEdit ?? onChange)(md);
    },
  });

  // Sync content when mode changes
  useEffect(() => {
    if (prevMode.current !== mode) {
      if (mode === 'raw' && editor) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown.getMarkdown();
        setRawContent(md);
      } else if (mode === 'rich' && editor) {
        editor.commands.setContent(rawContent);
        (onUserEdit ?? onChange)(rawContent);
      }
      prevMode.current = mode;
    }
  }, [mode, editor, rawContent, onChange, onUserEdit]);

  const handleRawChange = useCallback(
    (value: string) => {
      setRawContent(value);
      (onUserEdit ?? onChange)(value);
    },
    [onChange, onUserEdit],
  );

  // Cmd/Ctrl+F to open find bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const wikiEl = target.closest('[data-wiki-link]') as HTMLElement | null;
    if (wikiEl) {
      const href = wikiEl.getAttribute('href') || wikiEl.dataset.href;
      if (href) openFile(href);
      return;
    }
    // Open external links in system browser
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href && /^https?:\/\//.test(anchor.href)) {
      e.preventDefault();
      open(anchor.href);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 relative">
      {mode === 'rich' && <MarkdownToolbar editor={editor} />}

      {mode === 'rich' && (
        <>
          <FindBar editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />
          <div
            className="flex-1 overflow-y-auto min-h-0 relative"
            onClick={handleClick}
            style={{
              fontSize: `${editorSettings.fontSize}px`,
              fontFamily: editorSettings.fontFamily,
              lineHeight: editorSettings.lineHeight,
              wordBreak: editorSettings.wordWrap ? 'break-word' : undefined,
              overflowWrap: editorSettings.wordWrap ? 'break-word' : undefined,
            }}
          >
            <TableControls editor={editor} />
            <EditorContent editor={editor} className="h-full" />
          </div>
        </>
      )}

      {mode === 'raw' && (
        <textarea
          ref={rawRef}
          value={rawContent}
          onChange={(e) => handleRawChange(e.target.value)}
          className="flex-1 w-full resize-none bg-transparent px-6 py-4 text-primary outline-none"
          style={{
            fontSize: `${editorSettings.fontSize}px`,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: editorSettings.lineHeight,
            tabSize: editorSettings.tabSize,
          }}
          spellCheck={false}
          autoFocus
        />
      )}
    </div>
  );
}
