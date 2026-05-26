import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { type DataFormat, toJson, isValid } from '../utils/dataFormatConverter';
import 'jsoncrack-react/style.css';

const JSONCrackLazy = lazy(() =>
  import('jsoncrack-react').then((mod) => ({ default: mod.JSONCrack })),
);

// Error boundary to catch jsoncrack-react runtime failures
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
class GraphErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface JsonCrackEditorProps {
  content: string;
  onChange: (content: string) => void;
  showGraph?: boolean;
  format?: DataFormat;
}

type LayoutDirection = 'RIGHT' | 'DOWN';

const GRAPH_DEBOUNCE_MS = 500;

const FORMAT_LABELS: Record<DataFormat, string> = {
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  csv: 'CSV',
};

export function JsonCrackEditor({
  content,
  onChange,
  showGraph = true,
  format = 'json',
}: JsonCrackEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [graphJson, setGraphJson] = useState<string | null>(null);
  const [graphReady, setGraphReady] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('RIGHT');
  const [dividerPos, setDividerPos] = useState(50);
  const [collapsedPane, setCollapsedPane] = useState<'none' | 'editor' | 'graph'>('none');
  const [isContentValid, setIsContentValid] = useState(() => isValid(content, format));

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isInternalChange = useRef(false);

  // Defer initial graph render to avoid blocking the main thread on mount
  useEffect(() => {
    if (!showGraph) return;
    const timer = setTimeout(() => {
      const converted = toJson(content, format);
      if (converted) {
        setGraphJson(converted);
      }
      setGraphReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Update graph with debounce when content changes
  const updateGraph = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const converted = toJson(text, format);
        if (converted) {
          setGraphJson(converted);
          setIsContentValid(true);
        } else {
          setIsContentValid(false);
        }
      }, GRAPH_DEBOUNCE_MS);
    },
    [format],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      isInternalChange.current = true;
      setLocalContent(value);
      onChange(value);
      if (showGraph) {
        updateGraph(value);
      }
    },
    [onChange, showGraph, updateGraph],
  );

  // Sync external content changes (e.g., file reload)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setLocalContent(content);
    const converted = toJson(content, format);
    if (converted) {
      setGraphJson(converted);
      setIsContentValid(true);
    } else {
      setIsContentValid(false);
    }
  }, [content, format]);

  const handleBeautify = useCallback(() => {
    if (format !== 'json') return;
    try {
      const parsed = JSON.parse(localContent);
      const beautified = JSON.stringify(parsed, null, 2);
      isInternalChange.current = true;
      setLocalContent(beautified);
      onChange(beautified);
      setGraphJson(beautified);
      setIsContentValid(true);
    } catch {
      // no-op if invalid JSON
    }
  }, [localContent, onChange, format]);

  const handleMinify = useCallback(() => {
    if (format !== 'json') return;
    try {
      const parsed = JSON.parse(localContent);
      const minified = JSON.stringify(parsed);
      isInternalChange.current = true;
      setLocalContent(minified);
      onChange(minified);
      setGraphJson(minified);
      setIsContentValid(true);
    } catch {
      // no-op if invalid JSON
    }
  }, [localContent, onChange, format]);

  // Divider drag logic
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setDividerPos(Math.max(20, Math.min(80, pct)));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const extensions = useMemo(() => {
    const langExt =
      format === 'yaml' ? yaml() : format === 'xml' ? xml() : format === 'csv' ? [] : json();
    return [langExt, oneDark, EditorView.lineWrapping].flat();
  }, [format]);

  const editorVisible = collapsedPane !== 'editor';
  const graphVisible = showGraph && collapsedPane !== 'graph';

  return (
    <div className="h-full w-full flex flex-col bg-surface-0" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-default bg-surface-1 shrink-0">
        {format === 'json' && (
          <>
            <button
              onClick={handleBeautify}
              disabled={!isContentValid}
              className="px-2.5 py-1 text-xs font-medium rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={isContentValid ? 'Beautify JSON' : 'Fix JSON errors first'}
            >
              Beautify
            </button>
            <button
              onClick={handleMinify}
              disabled={!isContentValid}
              className="px-2.5 py-1 text-xs font-medium rounded bg-surface-2 text-secondary hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={isContentValid ? 'Minify JSON' : 'Fix JSON errors first'}
            >
              Minify
            </button>
          </>
        )}

        {format !== 'json' && (
          <span className="px-2.5 py-1 text-xs font-medium text-secondary">
            {FORMAT_LABELS[format]}
          </span>
        )}

        {showGraph && (
          <>
            <div className="w-px h-4 bg-default mx-1" />
            <button
              onClick={() => setLayoutDirection((d) => (d === 'RIGHT' ? 'DOWN' : 'RIGHT'))}
              className="px-2.5 py-1 text-xs font-medium rounded bg-surface-2 text-secondary hover:bg-surface-3 transition-colors"
              title="Toggle graph layout direction"
            >
              Layout: {layoutDirection === 'RIGHT' ? '\u2192' : '\u2193'}
            </button>
            <div className="w-px h-4 bg-default mx-1" />
            <button
              onClick={() => setCollapsedPane((p) => (p === 'graph' ? 'none' : 'graph'))}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                collapsedPane === 'graph'
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
              title={collapsedPane === 'graph' ? 'Show graph' : 'Hide graph'}
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
              Graph
            </button>
          </>
        )}

        <div className="flex-1" />

        {!isContentValid && (
          <span className="text-xs text-red-400 font-medium">Invalid {FORMAT_LABELS[format]}</span>
        )}
        {isContentValid && <span className="text-xs text-green-400/70 font-medium">Valid</span>}
      </div>

      {/* Editor + Graph split */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* CodeMirror pane */}
        {editorVisible && (
          <div
            className="h-full overflow-auto"
            style={{
              width: !graphVisible ? '100%' : `${dividerPos}%`,
            }}
          >
            <CodeMirror
              value={localContent}
              height="100%"
              extensions={extensions}
              onChange={handleEditorChange}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                highlightActiveLine: true,
              }}
              style={{ height: '100%' }}
            />
          </div>
        )}

        {/* Divider */}
        {editorVisible && graphVisible && (
          <div
            className="w-1.5 cursor-col-resize bg-surface-2 hover:bg-accent/40 active:bg-accent/60 transition-colors shrink-0"
            onMouseDown={handleDividerMouseDown}
          />
        )}

        {/* JSON Crack graph pane */}
        {graphVisible && (
          <div
            className="h-full overflow-hidden bg-surface-0 relative"
            style={{ width: !editorVisible ? '100%' : `${100 - dividerPos}%` }}
          >
            <div className="absolute inset-0">
              <GraphErrorBoundary
                fallback={
                  <div className="flex h-full items-center justify-center text-secondary text-sm p-4 text-center">
                    <div>
                      <p className="text-yellow-400 font-medium">Graph visualization unavailable</p>
                      <p className="text-xs text-muted mt-1">
                        The graph renderer encountered an error. You can still edit JSON in the left
                        pane.
                      </p>
                    </div>
                  </div>
                }
              >
                {graphReady && graphJson ? (
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center text-secondary text-sm">
                        <span>Loading graph...</span>
                      </div>
                    }
                  >
                    <JSONCrackLazy
                      json={graphJson}
                      theme="dark"
                      layoutDirection={layoutDirection}
                      maxRenderableNodes={1500}
                    />
                  </Suspense>
                ) : (
                  <div className="flex h-full items-center justify-center text-secondary text-sm p-4 text-center">
                    {!graphReady ? (
                      <span>Preparing graph...</span>
                    ) : (
                      <div>
                        <p className="text-red-400 font-medium">Cannot render graph</p>
                        <p className="text-xs text-muted mt-1">
                          Fix {FORMAT_LABELS[format]} syntax errors to see visualization
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </GraphErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
