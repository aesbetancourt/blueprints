import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProcessStats {
  cpu_usage: number;
  memory_bytes: number;
  memory_display: string;
}

interface SystemStats {
  total_memory: number;
  used_memory: number;
  process: ProcessStats;
}

export function ResourcePanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<{ cpu: number; mem: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await invoke<SystemStats>('get_system_stats');
        setStats(data);
        setHistory((prev) => {
          const next = [...prev, { cpu: data.process.cpu_usage, mem: data.process.memory_bytes }];
          return next.slice(-30); // Keep last 30 samples
        });
      } catch {
        // Silently fail if command not available
      }
    };

    fetchStats();
    intervalRef.current = setInterval(fetchStats, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] bg-surface-1 border border-default rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-default">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M15 2v2M15 20v2M2 15h2M20 15h2M9 2v2M9 20v2M2 9h2M20 9h2" />
            </svg>
            <span className="text-sm font-medium text-primary">Resources</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-primary hover:bg-surface-2 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!stats ? (
            <div className="text-center text-muted text-sm py-6">Loading...</div>
          ) : (
            <>
              {/* CPU Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                    App CPU
                  </span>
                  <span className="text-sm font-mono text-primary">
                    {stats.process.cpu_usage.toFixed(1)}%
                  </span>
                </div>
                <MiniGraph data={history.map((h) => h.cpu)} max={100} color="var(--color-accent)" />
              </div>

              {/* App Memory */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                    App Memory
                  </span>
                  <span className="text-sm font-mono text-primary">
                    {stats.process.memory_display}
                  </span>
                </div>
                <MiniGraph
                  data={history.map((h) => h.mem / 1_048_576)}
                  max={Math.max(...history.map((h) => h.mem / 1_048_576), 100)}
                  color="var(--color-success)"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-default bg-surface-2/50">
          <span className="text-[10px] text-muted">Refreshing every 2s</span>
        </div>
      </div>
    </div>
  );
}

function MiniGraph({ data, max, color }: { data: number[]; max: number; color: string }) {
  const width = 360;
  const height = 40;
  const points = data.length;

  if (points < 2) {
    return (
      <div className="h-10 rounded bg-surface-2 flex items-center justify-center">
        <span className="text-[10px] text-muted">Collecting data...</span>
      </div>
    );
  }

  const stepX = width / (30 - 1); // Always 30 slots
  const pathData = data
    .map((value, i) => {
      const x = (i + (30 - points)) * stepX;
      const y = height - (Math.min(value, max) / max) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  const areaPath = `${pathData} L${29 * stepX},${height} L${(30 - points) * stepX},${height} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded bg-surface-2"
    >
      <defs>
        <linearGradient id="graphFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#graphFill)" />
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
