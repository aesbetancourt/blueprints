import { useEffect, useRef, useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlock from '@tiptap/extension-code-block';
import type { NodeViewProps } from '@tiptap/react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark' });

function MermaidNodeView({ node }: NodeViewProps) {
  const isMermaid = node.attrs.language === 'mermaid';
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const renderMermaid = useCallback(async (code: string) => {
    if (!code.trim()) {
      setSvg('');
      setError('');
      return;
    }
    try {
      const { svg: rendered } = await mermaid.render(idRef.current, code);
      setSvg(rendered);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mermaid render error');
      setSvg('');
      // Reset mermaid id after error
      idRef.current = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    if (!isMermaid) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      renderMermaid(node.textContent);
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [node.textContent, isMermaid, renderMermaid]);

  return (
    <NodeViewWrapper className="relative">
      <pre className="bg-neutral-800 rounded-lg p-4 overflow-x-auto">
        <NodeViewContent as="div" />
      </pre>
      {isMermaid && svg && (
        <div
          className="mt-2 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-x-auto [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      {isMermaid && error && (
        <div className="mt-2 p-2 text-sm text-red-400 bg-red-900/20 rounded border border-red-800">
          {error}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const MermaidCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});
