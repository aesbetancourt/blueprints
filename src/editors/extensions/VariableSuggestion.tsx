import { ReactRenderer } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';
import { useSettingsStore } from '../../store/settings';
import { BUILT_IN_VARIABLES, resolveVariable } from '../../utils/resolveVariables';

interface VariableItem {
  key: string;
  preview: string;
  builtIn: boolean;
}

function getVariableItems(query: string): VariableItem[] {
  const variables = useSettingsStore.getState().variables;

  const items: VariableItem[] = [
    // Built-in variables
    ...BUILT_IN_VARIABLES.map((v) => ({
      key: v.key,
      preview: v.resolve(),
      builtIn: true,
    })),
    // User-defined variables
    ...Object.entries(variables)
      .filter(([, value]) => value) // only show non-empty
      .map(([key, value]) => ({
        key,
        preview: value,
        builtIn: false,
      })),
  ];

  if (!query) return items.slice(0, 12);
  const lower = query.toLowerCase();
  return items.filter((v) => v.key.toLowerCase().includes(lower)).slice(0, 12);
}

interface VariableListProps {
  items: VariableItem[];
  command: (item: VariableItem) => void;
}

interface VariableListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const VariableList = forwardRef<VariableListRef, VariableListProps>(({ items, command }, ref) => {
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
        No matching variables
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="bg-surface-1 border border-default rounded-lg overflow-hidden shadow-xl max-h-72 overflow-y-auto w-56"
    >
      <div className="px-2 py-1.5 text-[10px] font-medium text-muted uppercase tracking-wide border-b border-default">
        Variables
      </div>
      {items.map((item, index) => (
        <button
          key={item.key}
          data-index={index}
          onClick={() => selectItem(index)}
          className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-accent/15 text-primary'
              : 'text-secondary hover:bg-surface-2'
          }`}
        >
          <span className="w-7 h-7 rounded-md bg-surface-2 border border-default flex items-center justify-center text-xs font-medium text-muted shrink-0">
            {item.builtIn ? '⚙' : '✎'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{item.key}</div>
            <div className="text-[11px] text-muted truncate">{item.preview}</div>
          </div>
        </button>
      ))}
    </div>
  );
});

VariableList.displayName = 'VariableList';

export const VariableSuggestion = Extension.create({
  name: 'variableSuggestion',

  addProseMirrorPlugins() {
    return [
      Suggestion<VariableItem>({
        pluginKey: new PluginKey('variableSuggestion'),
        editor: this.editor,
        char: '{{',
        allowSpaces: false,
        command: ({ editor, range, props: item }) => {
          const variables = useSettingsStore.getState().variables;
          const resolved = resolveVariable(item.key, variables);
          editor.chain().focus().deleteRange(range).insertContent(resolved).run();
        },
        items: ({ query }: { query: string }) => {
          return getVariableItems(query);
        },
        render: () => {
          let component: ReactRenderer<VariableListRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: SuggestionProps<VariableItem>) => {
              component = new ReactRenderer(VariableList, {
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
            onUpdate: (props: SuggestionProps<VariableItem>) => {
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
