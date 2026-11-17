import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { highlightTree } from '@lezer/highlight';
import { typstDark, typstDarkHighlight } from './typstLanguage';

const SOURCE = `// note
= Heading
#let name = "text"
#set text(size: 11pt)
- item
$ x^2 $
*bold* <label>`;

/** Return each source fragment that the dark style colors. */
function highlightedFragments(source: string): string[] {
  const state = EditorState.create({ doc: source, extensions: [typstDark()] });
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error('Typst parse did not finish');
  const fragments: string[] = [];
  highlightTree(tree, typstDarkHighlight, (from, to) => {
    fragments.push(source.slice(from, to));
  });
  return fragments;
}

describe('typstDark', () => {
  it('colors the main Typst constructs', () => {
    const fragments = highlightedFragments(SOURCE);
    for (const expected of [
      '// note',
      'Heading',
      'let',
      'text',
      '11pt',
      '-',
      '$',
      '"text"',
      '<label>',
    ]) {
      expect(
        fragments.some((f) => f.includes(expected)),
        `"${expected}" is colored`,
      ).toBe(true);
    }
  });
});
