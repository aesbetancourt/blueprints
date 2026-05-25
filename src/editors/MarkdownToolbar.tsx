import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  SquareTerminal,
  Minus,
  Table,
  Link,
  Undo,
  Redo,
} from 'lucide-react';

interface MarkdownToolbarProps {
  editor: Editor | null;
}

export function MarkdownToolbar({ editor }: MarkdownToolbarProps) {
  const [linkInput, setLinkInput] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkInput !== null) {
      linkInputRef.current?.focus();
    }
  }, [linkInput]);

  if (!editor) return null;

  const handleLinkSubmit = () => {
    if (linkInput && linkInput.trim()) {
      let url = linkInput.trim();
      // Add protocol if missing
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkInput(null);
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLinkSubmit();
    } else if (e.key === 'Escape') {
      setLinkInput(null);
      editor.chain().focus().run();
    }
  };

  return (
    <div className="flex items-center px-3 py-1.5 border-b border-default bg-surface-1">
      {/* Headings as a dropdown-style group */}
      <ToolbarGroup label="Text">
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <span className="font-bold text-xs">H1</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <span className="font-semibold text-xs">H2</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <span className="font-medium text-xs">H3</span>
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      {/* Inline formatting */}
      <ToolbarGroup>
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Cmd+B)"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Cmd+I)"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code (Cmd+E)"
        >
          <Code size={15} />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      {/* Lists */}
      <ToolbarGroup>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Ordered List"
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task List"
        >
          <ListChecks size={15} />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      {/* Block elements */}
      <ToolbarGroup>
        <ToolbarButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          <SquareTerminal size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus size={15} />
        </ToolbarButton>
      </ToolbarGroup>

      <Divider />

      {/* Table & Link */}
      <ToolbarGroup>
        <ToolbarButton
          active={editor.isActive('table')}
          onClick={() => {
            if (editor.isActive('table')) {
              editor.chain().focus().deleteTable().run();
            } else {
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
            }
          }}
          title="Insert Table"
        >
          <Table size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              setLinkInput('');
            }
          }}
          title="Link"
        >
          <Link size={15} />
        </ToolbarButton>
      </ToolbarGroup>

      {/* Link URL input */}
      {linkInput !== null && (
        <div className="ml-2 flex items-center gap-1">
          <input
            ref={linkInputRef}
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            onBlur={handleLinkSubmit}
            placeholder="https://..."
            className="h-6 w-48 px-2 text-xs rounded bg-surface-2 border border-default text-primary placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {/* Right side - undo/redo */}
      <div className="ml-auto flex items-center gap-1">
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Cmd+Z)"
        >
          <Undo size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo size={15} />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-surface-3 mx-2" />;
}

const btnBase =
  'inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-100';
const btnActive = 'bg-accent-glow text-accent';
const btnDisabled = 'text-muted cursor-not-allowed opacity-40';
const btnIdle = 'text-secondary hover:text-primary hover:bg-surface-2';

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const variant = active ? btnActive : disabled ? btnDisabled : btnIdle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${btnBase} ${variant}`}
    >
      {children}
    </button>
  );
}
