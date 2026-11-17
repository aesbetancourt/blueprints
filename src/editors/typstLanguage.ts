import { EditorSelection, Prec } from '@codemirror/state';
import { keymap, type Command } from '@codemirror/view';
import { HighlightStyle, LanguageSupport, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  typst_lezer,
  typstTags,
  typstLezerFoldService,
  typstLezerIndentService,
  typstLezerListKeymap,
} from 'codemirror-lang-typst/lezer';

/** Typst token colors for the dark editor. Uses the One Dark palette. */
export const typstDarkHighlight = HighlightStyle.define([
  { tag: t.comment, color: '#7d8799', fontStyle: 'italic' },
  { tag: t.heading, color: '#e5c07b', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.monospace, color: '#98c379' },
  { tag: t.link, color: '#61afef', textDecoration: 'underline' },
  { tag: t.escape, color: '#56b6c2' },
  { tag: typstTags.listMarker, color: '#c678dd' },
  { tag: typstTags.mathDelimiter, color: '#98c379', fontWeight: 'bold' },
  { tag: typstTags.interpolated, color: '#c678dd' },
  { tag: t.keyword, color: '#c678dd' },
  { tag: [t.bool, t.null, t.atom, t.number], color: '#d19a66' },
  { tag: t.string, color: '#98c379' },
  { tag: t.function(t.variableName), color: '#61afef' },
  { tag: t.propertyName, color: '#e06c75' },
  { tag: t.operator, color: '#56b6c2' },
  { tag: t.punctuation, color: '#abb2bf' },
  { tag: t.invalid, color: '#f87171' },
]);

/** Wrap each selection in `mark`, or remove `mark` when it already wraps the selection. */
function toggleMark(mark: string): Command {
  const len = mark.length;
  return (view) => {
    const { state } = view;
    const spec = state.changeByRange((range) => {
      const outside =
        state.sliceDoc(range.from - len, range.from) === mark &&
        state.sliceDoc(range.to, range.to + len) === mark;
      if (outside) {
        return {
          changes: [
            { from: range.from - len, to: range.from },
            { from: range.to, to: range.to + len },
          ],
          range: EditorSelection.range(range.anchor - len, range.head - len),
        };
      }
      const text = state.sliceDoc(range.from, range.to);
      if (text.length >= 2 * len && text.startsWith(mark) && text.endsWith(mark)) {
        return {
          changes: [
            { from: range.from, to: range.from + len },
            { from: range.to - len, to: range.to },
          ],
          range: EditorSelection.range(range.from, range.to - 2 * len),
        };
      }
      return {
        changes: [
          { from: range.from, insert: mark },
          { from: range.to, insert: mark },
        ],
        range: EditorSelection.range(range.anchor + len, range.head + len),
      };
    });
    view.dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input' }));
    return true;
  };
}

/** Replace each selection with a Typst link and put the cursor in the URL. */
const insertLink: Command = (view) => {
  const { state } = view;
  const prefix = '#link("';
  const spec = state.changeByRange((range) => ({
    changes: {
      from: range.from,
      to: range.to,
      insert: `${prefix}")[${state.sliceDoc(range.from, range.to)}]`,
    },
    range: EditorSelection.cursor(range.from + prefix.length),
  }));
  view.dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

/** Formatting keys. They match the Markdown editor shortcuts. */
const typstFormattingKeymap = Prec.high(
  keymap.of([
    { key: 'Mod-b', run: toggleMark('*') },
    { key: 'Mod-i', run: toggleMark('_') },
    { key: 'Mod-k', run: insertLink },
  ]),
);

/**
 * Typst language support for the dark editor.
 *
 * `typst_lezer()` also adds light-theme colors and a syntax linter. The linter
 * would replace the compiler diagnostics, so this keeps only the parser,
 * autocomplete, indentation, list keys, and folding, and adds formatting keys.
 */
export function typstDark(): LanguageSupport {
  const { language } = typst_lezer();
  return new LanguageSupport(language, [
    syntaxHighlighting(typstDarkHighlight),
    typstLezerIndentService,
    typstLezerListKeymap,
    typstLezerFoldService,
    typstFormattingKeymap,
  ]);
}
