import { useEffect, useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  TableRowsSplit,
  TableColumnsSplit,
  Minus,
  Merge,
  Split,
  ToggleLeft,
  Trash2,
} from 'lucide-react';

interface TableControlsProps {
  editor: Editor | null;
}

export function TableControls({ editor }: TableControlsProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const isInTable = editor.isActive('table');
      setVisible(isInTable);

      if (isInTable) {
        // Find the table DOM node to position controls above it
        const { view } = editor;
        const { from } = view.state.selection;
        const resolvedPos = view.state.doc.resolve(from);

        // Walk up to find the table node
        let tableDepth = resolvedPos.depth;
        while (tableDepth > 0 && resolvedPos.node(tableDepth).type.name !== 'table') {
          tableDepth--;
        }

        if (tableDepth > 0) {
          const tableStart = resolvedPos.start(tableDepth) - 1;
          const dom = view.nodeDOM(tableStart) as HTMLElement | null;
          if (dom) {
            const editorRect = view.dom.parentElement?.getBoundingClientRect();
            const tableRect = dom.getBoundingClientRect();
            if (editorRect) {
              setPosition({
                top: tableRect.top - editorRect.top - 40,
                left: tableRect.left - editorRect.left,
              });
            }
          }
        }
      }
    };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!editor || !visible) return null;

  return (
    <div
      ref={controlsRef}
      className="table-controls"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      {/* Row operations */}
      <ControlGroup label="Rows">
        <ControlButton
          onClick={() => editor.chain().focus().addRowBefore().run()}
          title="Add row above"
        >
          <TableRowsSplit size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="Add row below"
        >
          <TableRowsSplit size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().deleteRow().run()}
          title="Delete row"
          danger
        >
          <Minus size={14} />
        </ControlButton>
      </ControlGroup>

      <ControlDivider />

      {/* Column operations */}
      <ControlGroup label="Columns">
        <ControlButton
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="Add column left"
        >
          <TableColumnsSplit size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="Add column right"
        >
          <TableColumnsSplit size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().deleteColumn().run()}
          title="Delete column"
          danger
        >
          <Minus size={14} />
        </ControlButton>
      </ControlGroup>

      <ControlDivider />

      {/* Cell operations */}
      <ControlGroup label="Cells">
        <ControlButton
          onClick={() => editor.chain().focus().mergeCells().run()}
          title="Merge cells"
          disabled={!editor.can().mergeCells()}
        >
          <Merge size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().splitCell().run()}
          title="Split cell"
          disabled={!editor.can().splitCell()}
        >
          <Split size={14} />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().toggleHeaderCell().run()}
          title="Toggle header cell"
        >
          <ToggleLeft size={14} />
        </ControlButton>
      </ControlGroup>

      <ControlDivider />

      {/* Delete table */}
      <ControlButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="Delete table"
        danger
      >
        <Trash2 size={14} />
      </ControlButton>
    </div>
  );
}

function ControlGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function ControlDivider() {
  return <div className="w-px h-4 bg-surface-3 mx-1" />;
}

function ControlButton({
  onClick,
  title,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`table-control-btn ${danger ? 'table-control-btn--danger' : ''} ${disabled ? 'table-control-btn--disabled' : ''}`}
    >
      {children}
    </button>
  );
}
