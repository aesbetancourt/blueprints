import { useState, useEffect, useRef, useCallback } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'DM Sans, sans-serif',
});

interface MermaidEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function MermaidEditor({ content, onChange }: MermaidEditorProps) {
  const [value, setValue] = useState(content);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const renderIdRef = useRef(0);

  const renderDiagram = useCallback(async (source: string) => {
    const id = ++renderIdRef.current;
    if (!source.trim()) {
      setSvgHtml('');
      setError(null);
      return;
    }
    try {
      const { svg } = await mermaid.render(`mermaid-preview-${id}`, source);
      if (id === renderIdRef.current) {
        setSvgHtml(svg);
        setError(null);
      }
    } catch (err) {
      if (id === renderIdRef.current) {
        setError(err instanceof Error ? err.message : 'Syntax error');
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      renderDiagram(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, renderDiagram]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange(newValue);
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const zoomReset = () => setZoom(1);

  return (
    <div className="flex flex-col h-full bg-surface-0">
      <div className="flex h-full min-h-0">
        {/* Source pane */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-default">
          <div className="flex items-center px-4 py-2 border-b border-default bg-surface-1">
            <span className="text-xs font-medium text-muted">Source</span>
            <span className="ml-auto text-xs text-muted font-mono opacity-50">.mermaid</span>
          </div>
          <textarea
            className="flex-1 w-full resize-none bg-surface-0 text-primary font-mono text-sm p-4 outline-none leading-relaxed placeholder-[var(--color-text-muted)]"
            value={value}
            onChange={handleInput}
            spellCheck={false}
            placeholder={'graph TD\n    A[Start] --> B[End]'}
          />
        </div>

        {/* Preview pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center px-4 py-2 border-b border-default bg-surface-1">
            <span className="text-xs font-medium text-muted">Preview</span>
            {error && (
              <span className="ml-2 w-1.5 h-1.5 rounded-full bg-danger" title="Syntax error" />
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={zoomOut}
                className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
                title="Zoom out"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M5 7h4" strokeLinecap="round" />
                  <path d="M11 11l3 3" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={zoomReset}
                className="px-1.5 py-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary text-xs font-mono"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
                title="Zoom in"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M5 7h4M7 5v4" strokeLinecap="round" />
                  <path d="M11 11l3 3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-surface-0">
            {error ? (
              <div className="max-w-sm text-center">
                <p className="text-danger text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {error}
                </p>
              </div>
            ) : svgHtml ? (
              <div
                className="max-w-full [&>svg]:max-w-full [&>svg]:h-auto transition-transform"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            ) : (
              <p className="text-muted text-xs">Write Mermaid syntax to see a preview</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
