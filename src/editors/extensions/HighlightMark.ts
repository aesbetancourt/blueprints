import Highlight from '@tiptap/extension-highlight';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * markdown-it plugin to parse ==highlighted text== as <mark> elements.
 * Supports multicolor via ==text=={color} syntax (optional).
 */
function highlightPlugin(md: any) {
  md.inline.ruler.before('emphasis', 'highlight_mark', (state: any) => {
    const src = state.src;
    const pos = state.pos;

    if (src[pos] !== '=' || src[pos + 1] !== '=') return false;

    const start = pos + 2;
    let end = start;

    // Find closing ==
    while (end < state.posMax - 1) {
      if (src[end] === '=' && src[end + 1] === '=') break;
      end++;
    }

    if (end >= state.posMax - 1) return false;
    if (end === start) return false; // empty ==== not valid

    const content = src.slice(start, end);

    // Check for optional color: =={color} at the end after closing ==
    let color: string | null = null;
    let advanceBy = end + 2;
    if (src[end + 2] === '{') {
      const colorEnd = src.indexOf('}', end + 3);
      if (colorEnd !== -1 && colorEnd - (end + 3) < 20) {
        color = src.slice(end + 3, colorEnd);
        advanceBy = colorEnd + 1;
      }
    }

    const tokenOpen = state.push('highlight_open', 'mark', 1);
    tokenOpen.markup = '==';
    if (color) {
      tokenOpen.attrSet('data-color', color);
      tokenOpen.attrSet('style', `background-color: ${color}`);
    }

    const tokenText = state.push('text', '', 0);
    tokenText.content = content;

    const tokenClose = state.push('highlight_close', 'mark', -1);
    tokenClose.markup = '==';

    state.pos = advanceBy;
    return true;
  });
}

/**
 * Extended Highlight mark with ==text== markdown round-trip.
 * - Serializes to ==text== or ==text=={#color}
 * - Parses ==text== back via markdown-it plugin
 */
export const HighlightMark = Highlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open() {
            return '==';
          },
          close(_state: any, mark: any) {
            const color = mark.attrs?.color;
            if (color) {
              return `=={${color}}`;
            }
            return '==';
          },
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(markdownit: any) {
            highlightPlugin(markdownit);
          },
        },
      },
    };
  },
});
