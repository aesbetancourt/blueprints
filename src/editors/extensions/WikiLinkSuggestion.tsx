import { ReactRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';
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

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

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
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-neutral-400 text-sm">
          No results
        </div>
      );
    }

    return (
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden shadow-xl max-h-60 overflow-y-auto">
        {items.map((item, index) => (
          <button
            key={item.path}
            onClick={() => selectItem(index)}
            className={`block w-full text-left px-3 py-1.5 text-sm ${
              index === selectedIndex
                ? 'bg-blue-600 text-white'
                : 'text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            {item.name}
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
