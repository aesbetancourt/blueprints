import { useEffect, useState, useRef } from 'react';
import type { Editor } from '@tiptap/react';

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
          <RowAboveIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="Add row below"
        >
          <RowBelowIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().deleteRow().run()}
          title="Delete row"
          danger
        >
          <DeleteRowIcon />
        </ControlButton>
      </ControlGroup>

      <ControlDivider />

      {/* Column operations */}
      <ControlGroup label="Columns">
        <ControlButton
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="Add column left"
        >
          <ColLeftIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="Add column right"
        >
          <ColRightIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().deleteColumn().run()}
          title="Delete column"
          danger
        >
          <DeleteColIcon />
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
          <MergeIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().splitCell().run()}
          title="Split cell"
          disabled={!editor.can().splitCell()}
        >
          <SplitIcon />
        </ControlButton>
        <ControlButton
          onClick={() => editor.chain().focus().toggleHeaderCell().run()}
          title="Toggle header cell"
        >
          <HeaderCellIcon />
        </ControlButton>
      </ControlGroup>

      <ControlDivider />

      {/* Delete table */}
      <ControlButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="Delete table"
        danger
      >
        <DeleteTableIcon />
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

// --- Icons ---

function RowAboveIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <polyline points="9 10 12 7 15 10" />
    </svg>
  );
}

function RowBelowIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <polyline points="9 14 12 17 15 14" />
    </svg>
  );
}

function DeleteRowIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function ColLeftIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="7" y1="12" x2="13" y2="12" />
      <polyline points="10 9 7 12 10 15" />
    </svg>
  );
}

function ColRightIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="11" y1="12" x2="17" y2="12" />
      <polyline points="14 9 17 12 14 15" />
    </svg>
  );
}

function DeleteColIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

function MergeIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <polyline points="8 12 12 12" />
      <polyline points="16 12 12 12" />
      <polyline points="10 9 8 12 10 15" />
      <polyline points="14 9 16 12 14 15" />
    </svg>
  );
}

function SplitIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <polyline points="8 10 6 12 8 14" />
      <polyline points="16 10 18 12 16 14" />
    </svg>
  );
}

function HeaderCellIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <text
        x="12"
        y="7.5"
        textAnchor="middle"
        fontSize="6"
        fill="currentColor"
        stroke="none"
        fontWeight="bold"
      >
        H
      </text>
    </svg>
  );
}

function DeleteTableIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="7" y1="17" x2="17" y2="7" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
