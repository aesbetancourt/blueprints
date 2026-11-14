import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { HighlightMark } from './extensions/HighlightMark';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { WikiLink } from './extensions/WikiLink';
import { WikiLinkSuggestion } from './extensions/WikiLinkSuggestion';
import { VariableSuggestion } from './extensions/VariableSuggestion';
import { SlashCommands } from './extensions/SlashCommands';
import { MermaidCodeBlock } from './extensions/MermaidBlock';
import { VaultImage } from './extensions/VaultImage';
import { useWorkspaceStore } from '../store/workspace';
import { useSettingsStore } from '../store/settings';
import { MarkdownToolbar } from './MarkdownToolbar';
import { TableControls } from './TableControls';
import { FindBar } from './FindBar';
import './markdown-editor.css';

import type { FileEntry } from '../store/workspace';

/** Resolve a wiki-link name to a full file path by searching the file tree */
function resolveWikiLink(name: string, fileTree: FileEntry[]): string | null {
  const lower = name.toLowerCase();
  // Try with and without extensions
  function walk(entries: FileEntry[]): string | null {
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (entry.children) {
          const found = walk(entry.children);
          if (found) return found;
        }
      } else {
        const stem = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
        if (stem === lower || entry.name.toLowerCase() === lower) {
          return entry.path;
        }
      }
    }
    return null;
  }
  return walk(fileTree);
}

type EditorMode = 'rich' | 'raw';

interface MarkdownEditorProps {
  /** Path of the note; used to resolve relative image paths */
  filePath?: string;
  content: string;
  onChange: (content: string) => void;
  onUserEdit?: (content: string) => void;
  mode?: EditorMode;
}

export function MarkdownEditor({
  filePath = '',
  content,
  onChange,
  onUserEdit,
  mode = 'rich',
}: MarkdownEditorProps) {
  const openFile = useWorkspaceStore((s: { openFile: (p: string) => void }) => s.openFile);
  const editorSettings = useSettingsStore((s) => s.editor);
  const [findOpen, setFindOpen] = useState(false);
  const [rawContent, setRawContent] = useState(content);
  const prevMode = useRef(mode);
  const isInitializedRef = useRef(false);

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
      VaultImage.configure({ filePath }),
      HighlightMark.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: 'Start writing...',
        showOnlyCurrent: false,
        showOnlyWhenEditable: true,
      }),
      Markdown.configure({ html: false }),
      WikiLink,
      WikiLinkSuggestion,
      VariableSuggestion,
      SlashCommands,
    ],
    content,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    onCreate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown();
      onChange(md);
      // Mark initialized after a tick to skip any onUpdate that fires during setup
      requestAnimationFrame(() => {
        isInitializedRef.current = true;
      });
    },
    onUpdate: ({ editor }) => {
      // Skip onUpdate calls during TipTap initialization (normalization)
      if (!isInitializedRef.current) return;
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
      const href = wikiEl.dataset.href || wikiEl.getAttribute('href');
      if (!href) return;
      // If it's a full path, open directly; otherwise resolve by filename
      if (href.startsWith('/')) {
        openFile(href);
      } else {
        // Resolve by filename: find first file in vault matching the name
        const fileTree = useWorkspaceStore.getState().fileTree;
        const resolved = resolveWikiLink(href, fileTree);
        if (resolved) openFile(resolved);
      }
      return;
    }
    // Open external links in system browser
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href && /^https?:\/\//.test(anchor.href)) {
      e.preventDefault();
      open(anchor.href);
    }
  };

  // Open vault images in the image viewer tab
  const handleDoubleClick = (e: React.MouseEvent) => {
    const imageEl = (e.target as HTMLElement).closest('[data-image-path]') as HTMLElement | null;
    if (imageEl?.dataset.imagePath) openFile(imageEl.dataset.imagePath);
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
            onDoubleClick={handleDoubleClick}
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
        <RawMarkdownEditor
          value={rawContent}
          onChange={handleRawChange}
          editorSettings={editorSettings}
        />
      )}
    </div>
  );
}

interface RawMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  editorSettings: { fontSize: number; lineHeight: number; tabSize: number; wordWrap: boolean };
}

function RawMarkdownEditor({ value, onChange, editorSettings }: RawMarkdownEditorProps) {
  const isInternalChange = useRef(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (val: string) => {
      isInternalChange.current = true;
      setLocalValue(val);
      onChange(val);
    },
    [onChange],
  );

  const extensions = useMemo(
    () =>
      [
        markdown({ codeLanguages: languages }),
        oneDark,
        editorSettings.wordWrap ? EditorView.lineWrapping : [],
        EditorView.theme({
          '&': {
            fontSize: `${editorSettings.fontSize}px`,
          },
          '.cm-content': {
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: `${editorSettings.lineHeight}`,
          },
        }),
      ].flat(),
    [editorSettings.fontSize, editorSettings.lineHeight, editorSettings.wordWrap],
  );

  return (
    <div className="flex-1 w-full overflow-auto" style={{ minHeight: 0 }}>
      <CodeMirror
        value={localValue}
        height="100%"
        extensions={extensions}
        onChange={handleChange}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          highlightActiveLine: true,
          tabSize: editorSettings.tabSize,
        }}
        style={{ height: '100%' }}
      />
    </div>
  );
}
