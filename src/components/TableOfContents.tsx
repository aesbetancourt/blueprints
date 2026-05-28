import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspace';
import { VaultService } from '../services/vault';

interface TocHeading {
  level: number;
  text: string;
  line: number;
}

function scrollToHeading(text: string, level: number) {
  // Find the heading in the TipTap editor DOM
  const editor = document.querySelector('.tiptap');
  if (!editor) return;
  const headings = editor.querySelectorAll(`h${level}`);
  for (const el of headings) {
    if (el.textContent?.trim() === text) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Brief highlight
      el.classList.add('toc-highlight');
      setTimeout(() => el.classList.remove('toc-highlight'), 1500);
      return;
    }
  }
}

export function TableOfContents({ forceExpanded }: { forceExpanded?: boolean }) {
  const { activeTabId, openTabs } = useWorkspaceStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  useEffect(() => {
    if (!activeTab || activeTab.fileType !== 'md') {
      setHeadings([]);
      return;
    }

    VaultService.readFile(activeTab.filePath)
      .then((content) => {
        const lines = content.split('\n');
        const h: TocHeading[] = [];
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(/^(#{1,6})\s+(.+)/);
          if (match) {
            h.push({ level: match[1].length, text: match[2].trim(), line: i + 1 });
          }
        }
        setHeadings(h);
      })
      .catch(() => setHeadings([]));
  }, [activeTab?.filePath, activeTab?.fileType]);

  if (!activeTab || activeTab.fileType !== 'md') return null;
  if (headings.length === 0) return null;

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
      >
        <ChevronRight
          size={10}
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        Outline
        <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
          {headings.length}
        </span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 max-h-48 overflow-y-auto">
          {headings.map((h, i) => (
            <button
              key={`${h.line}-${i}`}
              onClick={() => scrollToHeading(h.text, h.level)}
              className="w-full text-left text-xs text-secondary py-0.5 px-2 truncate hover:text-primary hover:bg-surface-2/50 rounded cursor-pointer transition-colors"
              style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
