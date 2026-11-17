// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';

// CodeMirror reads the platform when it loads; make Mod mean Cmd as on macOS
vi.hoisted(() => {
  Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
});

vi.mock('../services/typst', () => ({
  TypstService: {
    compile: vi.fn(async () => ({ pages: [], diagnostics: [] })),
    exportPdf: vi.fn(),
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));

let TypstEditor: typeof import('./TypstEditor').TypstEditor;

beforeAll(async () => {
  const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  Range.prototype.getClientRects = noRects as unknown as () => DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  ({ TypstEditor } = await import('./TypstEditor'));
});

afterEach(cleanup);

function mount(content = '') {
  const onChange = vi.fn();
  const { container, rerender } = render(
    <TypstEditor filePath="/vault/doc.typ" content={content} onChange={onChange} />,
  );
  const dom = container.querySelector('.cm-editor') as HTMLElement;
  const view = EditorView.findFromDOM(dom);
  if (!view) throw new Error('CodeMirror did not mount');
  // Re-render like EditorPane does after each edit
  const rerenderParent = () =>
    rerender(<TypstEditor filePath="/vault/doc.typ" content={content} onChange={onChange} />);
  return { view, onChange, rerenderParent };
}

function type(view: EditorView, text: string) {
  act(() => {
    const at = view.state.selection.main.head;
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      userEvent: 'input.type',
    });
  });
}

/** Press Cmd+key in the editor. Returns true when the editor handled the key. */
function press(view: EditorView, key: string, mods: { shift?: boolean } = {}): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: true,
    shiftKey: !!mods.shift,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    view.contentDOM.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

function select(view: EditorView, from: number, to: number) {
  act(() => view.dispatch({ selection: { anchor: from, head: to } }));
}

describe('TypstEditor shortcuts', () => {
  it('undoes and redoes with Cmd+Z and Cmd+Shift+Z after parent re-renders', async () => {
    const { view, rerenderParent } = mount('= Title\n');
    act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
    type(view, 'Hello');
    rerenderParent();
    // Separate history events need a pause longer than CodeMirror's group delay
    await act(() => new Promise((r) => setTimeout(r, 600)));
    type(view, ' world');
    rerenderParent();

    press(view, 'z');
    expect(view.state.doc.toString()).toBe('= Title\nHello');
    press(view, 'z');
    expect(view.state.doc.toString()).toBe('= Title\n');
    press(view, 'z', { shift: true });
    expect(view.state.doc.toString()).toBe('= Title\nHello');
  });

  it('toggles bold and italic marks around the selection', () => {
    const { view } = mount('make this bold');
    select(view, 10, 14);
    // Handled means the app-wide Cmd+B sidebar toggle stays off
    expect(press(view, 'b')).toBe(true);
    expect(view.state.doc.toString()).toBe('make this *bold*');
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'bold',
    );
    press(view, 'b');
    expect(view.state.doc.toString()).toBe('make this bold');
    press(view, 'i');
    expect(view.state.doc.toString()).toBe('make this _bold_');
    press(view, 'z');
    expect(view.state.doc.toString()).toBe('make this bold');
  });

  it('inserts a link with the cursor in the URL', () => {
    const { view } = mount('see docs');
    select(view, 4, 8);
    press(view, 'k');
    expect(view.state.doc.toString()).toBe('see #link("")[docs]');
    expect(view.state.selection.main.head).toBe(11);
  });

  it('toggles a line comment and selects all', () => {
    const { view } = mount('= Title');
    press(view, '/');
    expect(view.state.doc.toString()).toBe('// = Title');
    press(view, 'a');
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(view.state.doc.length);
  });
});
