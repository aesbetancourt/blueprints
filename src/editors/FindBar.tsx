import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

interface FindBarProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

export function FindBar({ editor, open, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setQuery('');
      setMatches([]);
      setCurrentIndex(0);
      // Clear any selection highlight when closing
      if (editor) {
        editor.commands.setTextSelection(editor.state.selection.from);
      }
    }
  }, [open, editor]);

  const findMatches = useCallback(
    (searchQuery: string) => {
      if (!editor || !searchQuery) {
        setMatches([]);
        setCurrentIndex(0);
        return;
      }

      const { doc } = editor.state;
      const results: { from: number; to: number }[] = [];
      const lowerQuery = searchQuery.toLowerCase();

      doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const text = node.text.toLowerCase();
        let index = 0;
        while (index < text.length) {
          const found = text.indexOf(lowerQuery, index);
          if (found === -1) break;
          results.push({
            from: pos + found,
            to: pos + found + searchQuery.length,
          });
          index = found + 1;
        }
      });

      setMatches(results);
      if (results.length > 0) {
        setCurrentIndex(0);
        goToMatch(results[0]);
      } else {
        setCurrentIndex(0);
      }
    },
    [editor],
  );

  const goToMatch = (match: { from: number; to: number }) => {
    if (!editor) return;
    editor.commands.setTextSelection({ from: match.from, to: match.to });
    // Scroll into view
    const { view } = editor;
    const dom = view.domAtPos(match.from);
    if (dom.node instanceof HTMLElement) {
      dom.node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (dom.node.parentElement) {
      dom.node.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const goNext = () => {
    if (matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    goToMatch(matches[next]);
  };

  const goPrev = () => {
    if (matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    goToMatch(matches[prev]);
  };

  useEffect(() => {
    findMatches(query);
  }, [query, findMatches]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goPrev();
      } else {
        goNext();
      }
    }
  };

  if (!open) return null;

  return (
    <div className="absolute top-0 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-b-lg bg-surface-1 border border-t-0 border-default shadow-lg">
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1.5"
        className="shrink-0"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l3 3" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in file..."
        className="w-44 bg-transparent text-xs text-primary placeholder-[var(--color-text-muted)] outline-none"
      />
      {query && (
        <span className="text-xs text-muted whitespace-nowrap">
          {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : 'No results'}
        </span>
      )}
      <button
        onClick={goPrev}
        disabled={matches.length === 0}
        className="p-0.5 rounded hover:bg-surface-2 text-muted hover:text-primary disabled:opacity-30"
        title="Previous (Shift+Enter)"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 6.5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={goNext}
        disabled={matches.length === 0}
        className="p-0.5 rounded hover:bg-surface-2 text-muted hover:text-primary disabled:opacity-30"
        title="Next (Enter)"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={onClose}
        className="p-0.5 rounded hover:bg-surface-2 text-muted hover:text-primary ml-1"
        title="Close (Esc)"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 2l6 6M8 2l-6 6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
