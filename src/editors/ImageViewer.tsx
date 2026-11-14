import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Copy,
  GripHorizontal,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace';
import { useToastStore } from '../components/Toast';
import { loadImage, IMAGE_CHANGED_EVENT, type LoadedImage } from '../utils/imageFiles';

type Background = 'checker' | 'dark' | 'light';

interface Point {
  x: number;
  y: number;
}

/** Scale plus pan offset, in screen px from the viewport center */
interface View extends Point {
  scale: number;
}

/** Safari/WKWebView trackpad pinch event (non-standard) */
interface GestureEventLike extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 32;
/** Cap on the rendered edge length so deep zoom on large images stays responsive */
const MAX_RENDER_SIZE = 32768;
const ZOOM_STEP = 1.25;
const WHEEL_ZOOM_SPEED = 0.01;
const FIT_PADDING = 24;
const PAN_STEP = 60;
/** Show hard pixel edges from this scale up */
const PIXELATED_FROM = 3;
/** Fallback size for SVGs without width/height */
const FALLBACK_SIZE = 512;
const CENTER: Point = { x: 0, y: 0 };

const BACKGROUNDS: { id: Background; label: string; style: React.CSSProperties }[] = [
  {
    id: 'checker',
    label: 'Checkerboard',
    style: {
      background:
        'repeating-conic-gradient(var(--color-surface-3) 0% 25%, var(--color-surface-2) 0% 50%) 0 0 / 16px 16px',
    },
  },
  { id: 'dark', label: 'Dark', style: { background: 'var(--color-surface-0)' } },
  { id: 'light', label: 'Light', style: { background: '#ffffff' } },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageViewer({ filePath }: { filePath: string }) {
  const vaultPath = useWorkspaceStore((s) => s.vaultPath);
  const { addToast } = useToastStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);

  const [image, setImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [fitMode, setFitMode] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ x: false, y: false });
  const [background, setBackground] = useState<Background>('checker');
  const [dragging, setDragging] = useState(false);

  const fileName = filePath.split('/').pop() ?? filePath;
  const dot = fileName.lastIndexOf('.');
  const format = dot > 0 ? fileName.slice(dot + 1).toUpperCase() : '';

  // Load the image bytes
  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadImage(filePath)
      .then((loaded) => {
        if (!cancelled) setImage(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, reloadKey]);

  // Reload when the file changes on disk
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === filePath) setReloadKey((k) => k + 1);
    };
    window.addEventListener(IMAGE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(IMAGE_CHANGED_EVENT, handler);
  }, [filePath]);

  // Focus the canvas so keyboard shortcuts work right away
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const maxScale = natural
    ? Math.min(MAX_SCALE, Math.max(1, MAX_RENDER_SIZE / Math.max(natural.w, natural.h)))
    : MAX_SCALE;

  const getFitScale = useCallback(() => {
    const el = containerRef.current;
    if (!el || !natural) return 1;
    const sideways = rotation % 180 !== 0;
    const w = sideways ? natural.h : natural.w;
    const h = sideways ? natural.w : natural.h;
    const fit = Math.min(
      (el.clientWidth - FIT_PADDING * 2) / w,
      (el.clientHeight - FIT_PADDING * 2) / h,
    );
    // Never upscale small images to fit
    return Math.max(MIN_SCALE, Math.min(1, fit));
  }, [natural, rotation]);

  // Keep the image fitted while in fit mode (also on pane resize)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!fitMode || !el) return;
    const apply = () => setView({ scale: getFitScale(), x: 0, y: 0 });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitMode, getFitScale]);

  /** Zoom to `next(current)`, keeping the point at `anchor` fixed on screen */
  const zoom = useCallback(
    (next: (current: number) => number, anchor: Point = CENTER) => {
      setFitMode(false);
      setView((v) => {
        const scale = Math.min(Math.max(next(v.scale), MIN_SCALE), maxScale);
        const ratio = scale / v.scale;
        return {
          scale,
          x: anchor.x - (anchor.x - v.x) * ratio,
          y: anchor.y - (anchor.y - v.y) * ratio,
        };
      });
    },
    [maxScale],
  );

  const pan = useCallback((dx: number, dy: number) => {
    setFitMode(false);
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const anchorAt = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return CENTER;
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  // Wheel and pinch need non-passive listeners to block the default scroll/zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastGestureScale = 1;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + wheel, or trackpad pinch in Chromium-based webviews
        const delta = Math.max(-25, Math.min(25, e.deltaY));
        zoom((s) => s * Math.exp(-delta * WHEEL_ZOOM_SPEED), anchorAt(e.clientX, e.clientY));
      } else {
        pan(-e.deltaX, -e.deltaY);
      }
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as GestureEventLike;
      const factor = ge.scale / lastGestureScale;
      lastGestureScale = ge.scale;
      zoom((s) => s * factor, anchorAt(ge.clientX, ge.clientY));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
    };
  }, [zoom, pan]);

  const fit = () => setFitMode(true);
  const rotate = (deg: number) => setRotation((r) => (r + deg + 360) % 360);

  const reset = () => {
    setRotation(0);
    setFlip({ x: false, y: false });
    setFitMode(true);
  };

  const copyMarkdown = () => {
    const linkPath =
      vaultPath && filePath.startsWith(vaultPath + '/')
        ? filePath.slice(vaultPath.length)
        : filePath;
    const alt = fileName.replace(/\.[^.]+$/, '');
    navigator.clipboard
      .writeText(`![${alt}](${encodeURI(linkPath)})`)
      .then(() => addToast('Markdown image link copied', 'success'))
      .catch(() => addToast('Cannot copy to clipboard', 'error'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case '+':
      case '=':
        zoom((s) => s * ZOOM_STEP);
        break;
      case '-':
      case '_':
        zoom((s) => s / ZOOM_STEP);
        break;
      case '0':
        fit();
        break;
      case '1':
        zoom(() => 1);
        break;
      case 'r':
        rotate(90);
        break;
      case 'R':
        rotate(-90);
        break;
      case 'ArrowLeft':
        pan(PAN_STEP, 0);
        break;
      case 'ArrowRight':
        pan(-PAN_STEP, 0);
        break;
      case 'ArrowUp':
        pan(0, PAN_STEP);
        break;
      case 'ArrowDown':
        pan(0, -PAN_STEP);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || (e.clientX === drag.startX && e.clientY === drag.startY)) return;
    setFitMode(false);
    setView((v) => ({
      ...v,
      x: drag.x + e.clientX - drag.startX,
      y: drag.y + e.clientY - drag.startY,
    }));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // Double-click toggles between fit and a closer look at the clicked point
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!fitMode) {
      fit();
      return;
    }
    const target = Math.max(1, getFitScale() * 2);
    zoom(() => target, anchorAt(e.clientX, e.clientY));
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 p-4">
        <p>{error}</p>
      </div>
    );
  }

  const backgroundStyle = BACKGROUNDS.find((b) => b.id === background)?.style;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-default bg-surface-1">
        <div className="flex items-center gap-1">
          <ToolButton title="Zoom out (-)" onClick={() => zoom((s) => s / ZOOM_STEP)}>
            <ZoomOut size={13} />
          </ToolButton>
          <button
            onClick={() => zoom(() => 1)}
            className="px-1.5 py-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary text-xs font-mono min-w-[3rem] text-center"
            title="Actual size (1)"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <ToolButton title="Zoom in (+)" onClick={() => zoom((s) => s * ZOOM_STEP)}>
            <ZoomIn size={13} />
          </ToolButton>
          <ToolButton title="Fit to view (0)" onClick={fit} active={fitMode}>
            <Maximize size={13} />
          </ToolButton>
        </div>

        <div className="w-px h-4 bg-surface-3" />

        <div className="flex items-center gap-1">
          <ToolButton title="Rotate left (Shift+R)" onClick={() => rotate(-90)}>
            <RotateCcw size={13} />
          </ToolButton>
          <ToolButton title="Rotate right (R)" onClick={() => rotate(90)}>
            <RotateCw size={13} />
          </ToolButton>
          <ToolButton
            title="Flip horizontal"
            onClick={() => setFlip((f) => ({ ...f, x: !f.x }))}
            active={flip.x}
          >
            <FlipHorizontal2 size={13} />
          </ToolButton>
          <ToolButton
            title="Flip vertical"
            onClick={() => setFlip((f) => ({ ...f, y: !f.y }))}
            active={flip.y}
          >
            <FlipVertical2 size={13} />
          </ToolButton>
          <button
            onClick={reset}
            className="px-1.5 py-0.5 rounded hover:bg-surface-2 text-muted hover:text-secondary text-xs"
            title="Reset rotation, flip, and zoom"
          >
            Reset
          </button>
        </div>

        <div className="w-px h-4 bg-surface-3" />

        <div className="flex items-center gap-1" title="Background">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBackground(b.id)}
              title={`${b.label} background`}
              className={`w-4 h-4 rounded border transition-colors ${
                background === b.id ? 'border-accent' : 'border-default hover:border-muted'
              }`}
              style={b.style}
            />
          ))}
        </div>

        <ToolButton title="Copy Markdown image link" onClick={copyMarkdown}>
          <Copy size={13} />
        </ToolButton>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          {natural && (
            <span className="font-mono">
              {natural.w} × {natural.h}
            </span>
          )}
          {image && <span className="font-mono">{formatBytes(image.size)}</span>}
          {format && <span>{format}</span>}
          <span className="opacity-50 flex items-center gap-1">
            <GripHorizontal size={10} />
            Drag to pan · Pinch or Ctrl+Scroll to zoom
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        tabIndex={0}
        className={`flex-1 relative overflow-hidden outline-none select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{ minHeight: 0 }}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {image && (
          <img
            key={image.url}
            src={image.url}
            alt={fileName}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setNatural({
                w: img.naturalWidth || FALLBACK_SIZE,
                h: img.naturalHeight || FALLBACK_SIZE,
              });
            }}
            onError={() => setError(`Cannot decode image: ${fileName}`)}
            className="absolute left-1/2 top-1/2"
            style={{
              ...backgroundStyle,
              // Size via layout (not transform scale) so SVGs re-render crisply
              width: natural ? natural.w * view.scale : undefined,
              height: natural ? natural.h * view.scale : undefined,
              maxWidth: 'none',
              visibility: natural ? 'visible' : 'hidden',
              imageRendering: view.scale >= PIXELATED_FROM ? 'pixelated' : 'auto',
              // Flip after rotating so flips follow the screen axes
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${
                flip.x ? -1 : 1
              }, ${flip.y ? -1 : 1}) rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

function ToolButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${
        active ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-surface-2 hover:text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
