import { useState } from 'react';
import { useAnnotationsStore, type Annotation } from '../store/annotations';
import { useWorkspaceStore } from '../store/workspace';

export function AnnotationsPanel() {
  const { openTabs, activeTabId } = useWorkspaceStore();
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const { annotations, addAnnotation, updateAnnotation, deleteAnnotation } = useAnnotationsStore();
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState<Annotation['color']>('yellow');
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  if (!activeTab || activeTab.fileType !== 'md') return null;

  const fileAnnotations = annotations.filter((a) => a.filePath === activeTab.filePath);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    addAnnotation(activeTab.filePath, '', newContent.trim(), newColor);
    setNewContent('');
    setAdding(false);
  };

  const handleEdit = (id: string) => {
    if (!editContent.trim()) return;
    updateAnnotation(id, editContent.trim());
    setEditId(null);
    setEditContent('');
  };

  const colors: Annotation['color'][] = ['yellow', 'blue', 'green', 'red'];
  const colorClasses: Record<Annotation['color'], string> = {
    yellow: 'bg-yellow-500/20 border-yellow-500/40',
    blue: 'bg-blue-500/20 border-blue-500/40',
    green: 'bg-green-500/20 border-green-500/40',
    red: 'bg-red-500/20 border-red-500/40',
  };
  const dotColors: Record<Annotation['color'], string> = {
    yellow: 'bg-yellow-400',
    blue: 'bg-blue-400',
    green: 'bg-green-400',
    red: 'bg-red-400',
  };

  return (
    <div className="border-t border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider hover:text-secondary transition-colors"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5l4 3.5-4 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Notes
        {fileAnnotations.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono text-xs">
            {fileAnnotations.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Existing annotations */}
          {fileAnnotations.length === 0 && !adding && (
            <div className="text-xs text-muted py-1">No notes for this file.</div>
          )}

          <div className="space-y-1.5">
            {fileAnnotations.map((ann) => (
              <div
                key={ann.id}
                className={`rounded-md border px-2.5 py-1.5 text-xs ${colorClasses[ann.color]} group relative`}
              >
                {editId === ann.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-transparent text-primary text-xs outline-none resize-none"
                      rows={2}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEdit(ann.id);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                    />
                    <div className="flex justify-end gap-1 mt-1">
                      <button
                        onClick={() => setEditId(null)}
                        className="text-xs text-muted hover:text-secondary"
                      >
                        Cancel
                      </button>
                      <button onClick={() => handleEdit(ann.id)} className="text-xs text-accent">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-secondary whitespace-pre-wrap">{ann.content}</p>
                    <div className="hidden group-hover:flex absolute top-1 right-1 gap-0.5">
                      <button
                        onClick={() => {
                          setEditId(ann.id);
                          setEditContent(ann.content);
                        }}
                        className="p-0.5 rounded text-muted hover:text-primary"
                        title="Edit"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteAnnotation(ann.id)}
                        className="p-0.5 rounded text-muted hover:text-danger"
                        title="Delete"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          {adding ? (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write a note..."
                className="w-full bg-surface-2 border border-default rounded-md px-2.5 py-1.5 text-xs text-primary placeholder-muted outline-none focus:border-accent resize-none"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
                  if (e.key === 'Escape') {
                    setAdding(false);
                    setNewContent('');
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`w-4 h-4 rounded-full ${dotColors[c]} ${newColor === c ? 'ring-2 ring-white/50' : 'opacity-50 hover:opacity-100'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setAdding(false);
                      setNewContent('');
                    }}
                    className="text-xs text-muted hover:text-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!newContent.trim()}
                    className="text-xs text-accent disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="mt-2 text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="8" y1="3" x2="8" y2="13" />
                <line x1="3" y1="8" x2="13" y2="8" />
              </svg>
              Add note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
