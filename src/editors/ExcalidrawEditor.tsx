import { lazy, Suspense, useCallback, useMemo, useRef } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw })),
);

interface ExcalidrawEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const DARK_BG = '#0f1117';

export function ExcalidrawEditor({ content, onChange }: ExcalidrawEditorProps) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(content) as {
        elements?: ExcalidrawElement[];
        appState?: Partial<AppState>;
      };
    } catch {
      return null;
    }
  }, [content]);

  const lastElementsRef = useRef<string>(JSON.stringify(parsed?.elements ?? []));
  const lastBgRef = useRef<string>(parsed?.appState?.viewBackgroundColor ?? DARK_BG);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      const elementsJson = JSON.stringify(elements);
      const elementsChanged = elementsJson !== lastElementsRef.current;
      const bgChanged = appState.viewBackgroundColor !== lastBgRef.current;

      // Only save when elements or background color actually change
      if (!elementsChanged && !bgChanged) return;

      if (elementsChanged) lastElementsRef.current = elementsJson;
      if (bgChanged) lastBgRef.current = appState.viewBackgroundColor;

      // Debounce to avoid saving on every micro-change during drawing
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(
          JSON.stringify({
            type: 'excalidraw',
            version: 2,
            source: 'blueprints',
            elements,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              objectsSnapModeEnabled: appState.objectsSnapModeEnabled,
            },
          }),
        );
      }, 300);
    },
    [onChange],
  );

  if (parsed === null) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-0">
        <div className="p-5 bg-red-950/40 border border-red-900/50 text-red-200 rounded-lg max-w-sm text-center">
          <p className="font-semibold text-sm">Invalid Excalidraw file</p>
          <p className="text-xs mt-1.5 text-red-300/70">
            The file content is not valid JSON. Try opening it as raw text.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-surface-0" style={{ minHeight: 0 }}>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-secondary text-sm">
            <span>Loading Excalidraw...</span>
          </div>
        }
      >
        <Excalidraw
          initialData={{
            elements: parsed.elements ?? [],
          }}
          theme="dark"
          onChange={handleChange}
        />
      </Suspense>
    </div>
  );
}
