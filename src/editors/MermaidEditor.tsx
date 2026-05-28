import { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, GripHorizontal } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { mermaid as mermaidLang } from 'codemirror-lang-mermaid';
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [collapsedPane, setCollapsedPane] = useState<'none' | 'editor' | 'preview'>('none');
  const [naturalWidth, setNaturalWidth] = useState(0);
  const renderIdRef = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const editorVisible = collapsedPane !== 'editor';
  const previewVisible = collapsedPane !== 'preview';

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
        // Extract natural width from SVG
        const match = svg.match(/viewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+[\d.]+"/);
        if (match) {
          setNaturalWidth(parseFloat(match[1]));
        } else {
          const wMatch = svg.match(/width="([\d.]+)/);
          if (wMatch) setNaturalWidth(parseFloat(wMatch[1]));
        }
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

  // --- Zoom ---
  const clampZoom = (z: number) => Math.min(Math.max(z, 0.1), 20);

  const zoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fitToView = () => {
    if (!previewRef.current || !naturalWidth) return;
    const containerRect = previewRef.current.getBoundingClientRect();
    const fitZoom = (containerRect.width - 32) / naturalWidth;
    setZoom(clampZoom(fitZoom));
    setPan({ x: 0, y: 0 });
  };

  // --- Pan ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);

  // Scroll-wheel zoom (Ctrl/Cmd + wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => clampZoom(z * factor));
    }
  };

  // The zoom is applied purely via CSS `zoom` on the SVG wrapper.
  // CSS `zoom` re-rasterizes SVG content at the target size (no bitmap scaling = no blur).
  // We separate translate (for pan) from zoom to keep coordinate math simple:
  //   - Outer div: positions via translate (in screen pixels)
  //   - Inner div: applies CSS zoom (scales SVG vector content)

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-default bg-surface-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsedPane((p) => (p === 'preview' ? 'none' : 'preview'))}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              collapsedPane === 'preview'
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-2 text-secondary hover:bg-surface-3'
            }`}
            title={collapsedPane === 'preview' ? 'Show preview' : 'Hide preview'}
          >
            Editor
          </button>
          <button
            onClick={() => setCollapsedPane((p) => (p === 'editor' ? 'none' : 'editor'))}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              collapsedPane === 'editor'
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-2 text-secondary hover:bg-surface-3'
            }`}
            title={collapsedPane === 'editor' ? 'Show editor' : 'Hide editor'}
          >
            Preview
          </button>
        </div>

        <div className="mx-2 w-px h-4 bg-default" />

        {/* Zoom slider */}
        <div className="flex items-center gap-2">
          <ZoomOut size={13} className="text-muted flex-shrink-0" />
          <input
            type="range"
            min={10}
            max={2000}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value) / 100))}
            className="w-28 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
            title="Zoom"
          />
          <ZoomIn size={13} className="text-muted flex-shrink-0" />
          <button
            onClick={zoomReset}
            className="px-1.5 py-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary text-xs font-mono min-w-[3rem] text-center"
            title="Reset zoom & pan"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={fitToView}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
            title="Fit to view"
          >
            <Maximize size={13} />
          </button>
          <button
            onClick={zoomReset}
            className="p-1 rounded hover:bg-surface-2 text-muted hover:text-secondary"
            title="Reset view"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              Syntax error
            </span>
          )}
          <span className="text-xs text-muted opacity-50 flex items-center gap-1">
            <GripHorizontal size={10} />
            Drag to pan · Ctrl+Scroll to zoom
          </span>
        </div>
      </div>

      {/* Panes */}
      <div className="flex flex-1 min-h-0">
        {/* Source pane */}
        {editorVisible && (
          <div
            className={`flex flex-col border-r border-default ${previewVisible ? 'w-1/2' : 'w-full'}`}
          >
            <div className="flex items-center px-4 py-1.5 border-b border-default bg-surface-1/50">
              <span className="text-xs font-medium text-muted">Source</span>
              <span className="ml-auto text-xs text-muted font-mono opacity-50">.mermaid</span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeMirror
                value={value}
                height="100%"
                extensions={[EditorView.lineWrapping, mermaidLang()]}
                onChange={(val) => {
                  setValue(val);
                  onChange(val);
                }}
                theme={oneDark}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  bracketMatching: true,
                  highlightActiveLine: true,
                  autocompletion: false,
                }}
                style={{ height: '100%' }}
              />
            </div>
          </div>
        )}

        {/* Preview pane */}
        {previewVisible && (
          <div className={`flex flex-col ${editorVisible ? 'w-1/2' : 'w-full'}`}>
            <div className="flex items-center px-4 py-1.5 border-b border-default bg-surface-1/50">
              <span className="text-xs font-medium text-muted">Preview</span>
            </div>
            <div
              ref={previewRef}
              className={`flex-1 overflow-hidden relative bg-surface-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
            >
              {error ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <p className="text-danger text-xs font-mono whitespace-pre-wrap leading-relaxed max-w-sm text-center">
                    {error}
                  </p>
                </div>
              ) : svgHtml ? (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '50%',
                    left: '50%',
                    marginTop: Math.round(pan.y),
                    marginLeft: Math.round(pan.x),
                    width: naturalWidth ? `${naturalWidth * zoom}px` : 'auto',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div
                    className="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                    dangerouslySetInnerHTML={{ __html: svgHtml }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted text-xs">Write Mermaid syntax to see a preview</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
