import { ReactRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';
import { FileText, Pencil, GitBranch, Braces, File } from 'lucide-react';
import { useWorkspaceStore, FileEntry } from '../../store/workspace';

interface SuggestionItem {
  name: string;
  path: string;
}

function flattenFiles(entries: FileEntry[]): SuggestionItem[] {
  const result: SuggestionItem[] = [];
  function walk(items: FileEntry[]) {
    for (const item of items) {
      if (item.isDirectory) {
        if (item.children) walk(item.children);
      } else {
        result.push({ name: item.name, path: item.path });
      }
    }
  }
  walk(entries);
  return result;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  const props = { size: 14, className: 'text-muted' };
  if (ext === 'md') return <FileText {...props} />;
  if (ext === 'excalidraw') return <Pencil {...props} />;
  if (ext === 'mermaid') return <GitBranch {...props} />;
  if (ext === 'json') return <Braces {...props} />;
  return <File {...props} />;
}

interface SuggestionListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
}

interface SuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const selected = container.querySelector(`[data-index="${selectedIndex}"]`);
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="bg-surface-1 border border-default rounded-lg p-3 text-muted text-sm shadow-xl">
          No matching files
        </div>
      );
    }

    return (
      <div
        ref={scrollRef}
        className="bg-surface-1 border border-default rounded-lg overflow-hidden shadow-xl max-h-72 overflow-y-auto w-72"
      >
        <div className="px-2 py-1.5 text-[10px] font-medium text-muted uppercase tracking-wide border-b border-default">
          Links
        </div>
        {items.map((item, index) => (
          <button
            key={item.path}
            data-index={index}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-accent/15 text-primary'
                : 'text-secondary hover:bg-surface-2'
            }`}
          >
            <span className="w-7 h-7 rounded-md bg-surface-2 border border-default flex items-center justify-center shrink-0">
              <FileIcon name={item.name} />
            </span>
            <span className="text-sm font-medium truncate">{item.name}</span>
          </button>
        ))}
      </div>
    );
  },
);

SuggestionList.displayName = 'SuggestionList';

export const WikiLinkSuggestion = Extension.create({
  name: 'wikiLinkSuggestion',

  addProseMirrorPlugins() {
    return [
      Suggestion<SuggestionItem>({
        pluginKey: new PluginKey('wikiLinkSuggestion'),
        editor: this.editor,
        char: '[[',
        allowSpaces: true,
        command: ({ editor, range, props: item }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'wikiLink',
              attrs: { href: item.path, label: item.name },
            })
            .run();
        },
        items: ({ query }: { query: string }) => {
          const fileTree = useWorkspaceStore.getState().fileTree;
          const allFiles = flattenFiles(fileTree);
          if (!query) return allFiles.slice(0, 10);
          const lower = query.toLowerCase();
          return allFiles.filter((f) => f.name.toLowerCase().includes(lower)).slice(0, 10);
        },
        render: () => {
          let component: ReactRenderer<SuggestionListRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps<SuggestionItem>) => {
              component = new ReactRenderer(SuggestionList, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              popup = (tippy as any)('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props: SuggestionProps<SuggestionItem>) => {
              component?.updateProps({ items: props.items, command: props.command });
              if (props.clientRect && popup?.[0]) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              }
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
