import { Node, mergeAttributes } from '@tiptap/core';
import { InputRule } from '@tiptap/core';

/* eslint-disable @typescript-eslint/no-explicit-any */

// markdown-it plugin to parse [[wiki-links]] inline
function wikiLinkPlugin(md: any) {
  md.inline.ruler.push('wiki_link', (state: any) => {
    const src = state.src;
    const pos = state.pos;

    if (src[pos] !== '[' || src[pos + 1] !== '[') return false;

    const start = pos + 2;
    const end = src.indexOf(']]', start);
    if (end === -1 || end > state.posMax) return false;

    const content = src.slice(start, end);
    if (!content) return false;

    const token = state.push('wiki_link', 'span', 0);
    token.attrs = [
      ['data-wiki-link', ''],
      ['data-href', content],
    ];
    token.content = content;
    token.markup = '[[]]';

    state.pos = end + 2;
    return true;
  });

  md.renderer.rules.wiki_link = (tokens: any[], idx: number) => {
    const token = tokens[idx];
    const href =
      token.attrs?.find((a: [string, string]) => a[0] === 'data-href')?.[1] ?? token.content;
    return `<span data-wiki-link="" data-href="${href}" class="wiki-link">[[${token.content}]]</span>`;
  };
}

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-href') || element.getAttribute('href'),
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const text = element.textContent ?? '';
          // Strip [[ and ]] if present
          return text.replace(/^\[\[/, '').replace(/\]\]$/, '') || null;
        },
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const label = node.attrs.label || node.attrs.href || '';
          state.write(`[[${label}]]`);
        },
        parse: {
          setup(markdownit: any) {
            wikiLinkPlugin(markdownit);
          },
        },
      },
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
        'data-href': HTMLAttributes.href,
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
