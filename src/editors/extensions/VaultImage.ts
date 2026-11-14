import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { useWorkspaceStore } from '../../store/workspace';
import { loadImage, resolveImagePath } from '../../utils/imageFiles';

interface VaultImageOptions {
  /** Path of the note; relative image paths resolve against its folder */
  filePath: string;
}

// ![alt](src "title")
const inputRegex = /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;

/**
 * Inline Markdown image. Named `image` so tiptap-markdown applies its built-in
 * `![alt](src "title")` serializer. Vault files load through Tauri IPC as blob URLs.
 */
export const VaultImage = Node.create<VaultImageOptions>({
  name: 'image',
  group: 'inline',
  inline: true,
  draggable: true,

  addOptions() {
    return { filePath: '' };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src, title] = match;
          return { src, alt, title };
        },
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'vault-image';
      const img = document.createElement('img');
      dom.append(img);
      img.addEventListener('error', () => dom.classList.add('is-broken'));

      let currentSrc: string | null = null;

      const render = (attrs: Record<string, string | null>) => {
        img.alt = attrs.alt ?? '';
        if (attrs.title) dom.title = attrs.title;
        else dom.removeAttribute('title');

        const src = attrs.src ?? '';
        if (src === currentSrc) return;
        currentSrc = src;
        dom.classList.remove('is-broken');
        dom.dataset.label = attrs.alt || src;

        const vaultPath = useWorkspaceStore.getState().vaultPath;
        const path = resolveImagePath(src, this.options.filePath, vaultPath);
        if (!path) {
          dom.removeAttribute('data-image-path');
          img.src = src;
          return;
        }
        // Double-click handler in MarkdownEditor opens this path in the image viewer
        dom.dataset.imagePath = path;
        img.removeAttribute('src');
        loadImage(path)
          .then(({ url }) => {
            if (currentSrc === src) img.src = url;
          })
          .catch(() => {
            if (currentSrc === src) dom.classList.add('is-broken');
          });
      };

      render(node.attrs);

      return {
        dom,
        update: (updated) => {
          if (updated.type !== node.type) return false;
          render(updated.attrs);
          return true;
        },
      };
    };
  },
});
