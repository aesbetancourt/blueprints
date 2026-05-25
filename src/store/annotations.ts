import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Annotation {
  id: string;
  filePath: string;
  anchorText: string; // heading or text snippet to anchor to
  content: string;
  createdAt: number;
  color: 'yellow' | 'blue' | 'green' | 'red';
}

interface AnnotationsState {
  annotations: Annotation[];
  addAnnotation: (
    filePath: string,
    anchorText: string,
    content: string,
    color?: Annotation['color'],
  ) => void;
  updateAnnotation: (id: string, content: string) => void;
  deleteAnnotation: (id: string) => void;
  getFileAnnotations: (filePath: string) => Annotation[];
}

export const useAnnotationsStore = create<AnnotationsState>()(
  persist(
    (set, get) => ({
      annotations: [],

      addAnnotation: (filePath, anchorText, content, color = 'yellow') =>
        set((s) => ({
          annotations: [
            ...s.annotations,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              filePath,
              anchorText,
              content,
              createdAt: Date.now(),
              color,
            },
          ],
        })),

      updateAnnotation: (id, content) =>
        set((s) => ({
          annotations: s.annotations.map((a) => (a.id === id ? { ...a, content } : a)),
        })),

      deleteAnnotation: (id) =>
        set((s) => ({
          annotations: s.annotations.filter((a) => a.id !== id),
        })),

      getFileAnnotations: (filePath) => get().annotations.filter((a) => a.filePath === filePath),
    }),
    {
      name: 'blueprints-annotations',
    },
  ),
);
