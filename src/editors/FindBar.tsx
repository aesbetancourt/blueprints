import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface FindBarProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

const findPluginKey = new PluginKey('find-highlight');

function createFindPlugin() {
  return new Plugin({
    key: findPluginKey,
    state: {
      init() {
        return {
          decorations: DecorationSet.empty,
          matches: [] as { from: number; to: number }[],
          currentIndex: -1,
        };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(findPluginKey);
        if (meta) return meta;
        // Map decorations through document changes
        if (tr.docChanged) {
          return { ...prev, decorations: prev.decorations.map(tr.mapping, tr.doc) };
        }
        return prev;
      },
    },
    props: {
      decorations(state) {
        return findPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

function updateHighlights(
  editor: Editor,
  matches: { from: number; to: number }[],
  currentIndex: number,
) {
  const { tr } = editor.state;
  const decorations: Decoration[] = matches.map((match, i) => {
    const className = i === currentIndex ? 'find-highlight-current' : 'find-highlight';
    return Decoration.inline(match.from, match.to, { class: className });
  });
  const decoSet = DecorationSet.create(editor.state.doc, decorations);
  tr.setMeta(findPluginKey, { decorations: decoSet, matches, currentIndex });
  editor.view.dispatch(tr);
}

function clearHighlights(editor: Editor) {
  const { tr } = editor.state;
  tr.setMeta(findPluginKey, { decorations: DecorationSet.empty, matches: [], currentIndex: -1 });
  editor.view.dispatch(tr);
}

export function FindBar({ editor, open, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pluginRegistered = useRef(false);

  // Register the plugin on first open
  useEffect(() => {
    if (!editor || pluginRegistered.current) return;
    // Check if plugin is already registered
    const existing = editor.state.plugins.find((p) => p.spec.key === findPluginKey);
    if (!existing) {
      editor.registerPlugin(createFindPlugin());
    }
    pluginRegistered.current = true;
  }, [editor]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setQuery('');
      setMatches([]);
      setCurrentIndex(0);
      if (editor) {
        clearHighlights(editor);
        editor.commands.setTextSelection(editor.state.selection.from);
      }
    }
  }, [open, editor]);

  const findMatches = useCallback(
    (searchQuery: string) => {
      if (!editor || !searchQuery) {
        setMatches([]);
        setCurrentIndex(0);
        if (editor) clearHighlights(editor);
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
        updateHighlights(editor, results, 0);
        goToMatch(editor, results[0]);
      } else {
        setCurrentIndex(0);
        clearHighlights(editor);
      }
    },
    [editor],
  );

  const goToMatch = (ed: Editor, match: { from: number; to: number }) => {
    ed.commands.setTextSelection({ from: match.from, to: match.to });
    const { view } = ed;
    const dom = view.domAtPos(match.from);
    if (dom.node instanceof HTMLElement) {
      dom.node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (dom.node.parentElement) {
      dom.node.parentElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const goNext = () => {
    if (!editor || matches.length === 0) return;
    const next = (currentIndex + 1) % matches.length;
    setCurrentIndex(next);
    updateHighlights(editor, matches, next);
    goToMatch(editor, matches[next]);
  };

  const goPrev = () => {
    if (!editor || matches.length === 0) return;
    const prev = (currentIndex - 1 + matches.length) % matches.length;
    setCurrentIndex(prev);
    updateHighlights(editor, matches, prev);
    goToMatch(editor, matches[prev]);
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
      <Search size={12} className="shrink-0 text-muted" />
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
        <ChevronUp size={10} />
      </button>
      <button
        onClick={goNext}
        disabled={matches.length === 0}
        className="p-0.5 rounded hover:bg-surface-2 text-muted hover:text-primary disabled:opacity-30"
        title="Next (Enter)"
      >
        <ChevronDown size={10} />
      </button>
      <button
        onClick={onClose}
        className="p-0.5 rounded hover:bg-surface-2 text-muted hover:text-primary ml-1"
        title="Close (Esc)"
      >
        <X size={10} />
      </button>
    </div>
  );
}
