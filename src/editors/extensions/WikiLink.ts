import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': '',
        class: 'wiki-link text-blue-400 cursor-pointer hover:underline',
      }),
      `[[${HTMLAttributes.label || HTMLAttributes.href}]]`,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const text = match[1];
          const node = state.schema.nodes.wikiLink.create({
            href: text,
            label: text,
          });
          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
