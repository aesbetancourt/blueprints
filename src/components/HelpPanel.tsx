import { useState } from 'react';
import { X } from 'lucide-react';

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

type Section =
  | 'overview'
  | 'files'
  | 'editor'
  | 'shortcuts'
  | 'search'
  | 'tags'
  | 'templates'
  | 'settings';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files & Folders' },
  { id: 'editor', label: 'Editor' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'search', label: 'Search' },
  { id: 'tags', label: 'Tags, Links & Markers' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Settings' },
];

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] backdrop-blur-sm bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[80vh] bg-surface-1 border border-default rounded-xl shadow-2xl overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar nav */}
        <div className="w-48 shrink-0 bg-surface-0 border-r border-default py-3 overflow-y-auto">
          <div className="px-4 pb-2 text-xs font-medium text-muted uppercase tracking-wider">
            Help
          </div>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-accent/10 text-accent border-r-2 border-accent'
                  : 'text-secondary hover:bg-surface-2 hover:text-primary'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-primary">
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-surface-2 text-muted hover:text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="prose-help text-sm text-secondary leading-relaxed space-y-4">
            <HelpContent section={activeSection} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpContent({ section }: { section: Section }) {
  switch (section) {
    case 'overview':
      return (
        <>
          <p className="text-primary font-medium">
            Blueprints is a vault-based document editor for writing software specifications,
            architecture decisions, and technical documentation.
          </p>
          <div className="bg-surface-0 border border-default rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wider">
              Key Features
            </h4>
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Vault-based file management with folders, archiving, and hiding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Rich markdown editor with toolbar and slash commands</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Excalidraw drawings and Mermaid diagrams</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Wiki-style links between documents with [[double brackets]]</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Tags, search, command palette, and Git integration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                <span>Auto-save on focus change with scratch pad for quick notes</span>
              </li>
            </ul>
          </div>
          <div className="bg-surface-0 border border-default rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wider">
              Getting Started
            </h4>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>Open or create a vault (a folder on your machine)</li>
              <li>
                Create files using the <Kbd>+</Kbd> button or <Kbd>⌘N</Kbd>
              </li>
              <li>
                Navigate with the file explorer or <Kbd>⌘P</Kbd> command palette
              </li>
              <li>Write in rich mode or switch to raw markdown</li>
              <li>
                Use <Kbd>/</Kbd> slash commands for quick formatting
              </li>
            </ol>
          </div>
        </>
      );

    case 'files':
      return (
        <>
          <p>The file explorer on the left shows your vault's contents.</p>
          <HelpGroup title="Creating Files & Folders">
            <HelpItem
              label="New file"
              description="Click the + button in the sidebar or press ⌘N. Choose a template and location."
            />
            <HelpItem
              label="New folder"
              description="Click + and select 'New Folder' from the template grid, or right-click empty space in the explorer."
            />
            <HelpItem
              label="File types"
              description="Markdown (.md), Excalidraw drawings (.excalidraw), and Mermaid diagrams (.mermaid)."
            />
          </HelpGroup>
          <HelpGroup title="File Operations">
            <HelpItem
              label="Rename"
              description="Right-click a file/folder and select 'Rename', or use the context menu."
            />
            <HelpItem
              label="Move"
              description="Right-click and select 'Move', then choose the target folder."
            />
            <HelpItem
              label="Delete"
              description="Right-click and select 'Delete'. A confirmation dialog will appear."
            />
            <HelpItem
              label="Duplicate"
              description="Right-click a file and select 'Duplicate' to create a copy."
            />
          </HelpGroup>
          <HelpGroup title="Organization">
            <HelpItem
              label="Hide files"
              description="Right-click and select 'Hide' to remove items from view. Toggle visibility with the eye icon in the sidebar header."
            />
            <HelpItem
              label="Archive"
              description="Move files to an 'archive' folder. Toggle archive visibility with the archive icon."
            />
            <HelpItem
              label="Select mode"
              description="Use the checkbox icon to enter select mode for batch operations."
            />
            <HelpItem
              label="Sort"
              description="Click the sort icon to change ordering: alphabetical, by date modified, or by type."
            />
          </HelpGroup>
          <HelpGroup title="Include Patterns">
            <HelpItem
              label="File filtering"
              description="In Settings, configure 'Include Patterns' to control which files appear. Uses glob matching (e.g., *.md, *.excalidraw). Folders always show."
            />
          </HelpGroup>
        </>
      );

    case 'editor':
      return (
        <>
          <p>The editor supports two modes for markdown files.</p>
          <HelpGroup title="Editor Modes">
            <HelpItem
              label="Rich mode"
              description="WYSIWYG editing with a toolbar. Headings, bold, italic, lists, tables, and more render visually."
            />
            <HelpItem
              label="Raw mode"
              description="Plain text editing with monospace font. See the raw markdown source directly."
            />
            <HelpItem
              label="Toggle"
              description="Switch between modes using the Rich/Raw toggle in the breadcrumb bar below the tabs."
            />
          </HelpGroup>
          <HelpGroup title="Slash Commands">
            <HelpItem
              label="Usage"
              description="Type / at the start of a line to open the command menu."
            />
            <HelpItem
              label="Available commands"
              description="Heading 1-3, Bullet List, Numbered List, Task List, Blockquote, Code Block, Horizontal Rule, Table."
            />
            <HelpItem
              label="Filtering"
              description="Type after / to filter commands (e.g., /head shows only headings)."
            />
          </HelpGroup>
          <HelpGroup title="Wiki Links">
            <HelpItem
              label="Create links"
              description="Type [[ to open the file suggestion popup. Select a file to insert a wiki link."
            />
            <HelpItem
              label="Navigate"
              description="Click any wiki link in the editor to open that file."
            />
          </HelpGroup>
          <HelpGroup title="Tables">
            <HelpItem
              label="Insert"
              description="Use the toolbar table button or /table slash command. Creates a 3×3 table with header row."
            />
            <HelpItem
              label="Edit"
              description="Click inside a table to see the table controls toolbar (add/remove rows/columns)."
            />
          </HelpGroup>
          <HelpGroup title="Other Editors">
            <HelpItem
              label="Excalidraw"
              description="Open .excalidraw files for whiteboard-style freehand drawing."
            />
            <HelpItem
              label="Mermaid"
              description="Open .mermaid files for diagram editing with live preview."
            />
            <HelpItem
              label="JSON"
              description="Open .json files for split-view editing with CodeMirror and an interactive graph visualization."
            />
          </HelpGroup>
          <HelpGroup title="Saving">
            <HelpItem
              label="Auto-save"
              description="Files save automatically when you switch tabs, switch windows, or the app loses focus."
            />
            <HelpItem
              label="Manual save"
              description="Press ⌘S to save the current file immediately."
            />
          </HelpGroup>
          <HelpGroup title="Variables">
            <HelpItem
              label="Insert a variable"
              description="Type {{ in the editor to open the variable picker. Select a variable to insert its resolved value."
            />
            <HelpItem
              label="Built-in variables"
              description="{{today}} (date), {{now}} (datetime), {{time}} (HH:mm), {{year}}. Supports custom formats like {{today:MMM D, YYYY}}."
            />
            <HelpItem
              label="Custom variables"
              description="Define your own key-value pairs in Settings → Variables. They appear in the {{ popup alongside built-ins."
            />
            <HelpItem
              label="Templates"
              description="Variables in templates (e.g. {{today}}, {{author}}) are resolved automatically when a file is created."
            />
          </HelpGroup>
        </>
      );

    case 'shortcuts':
      return (
        <>
          <p>Keyboard shortcuts for common actions.</p>
          <HelpGroup title="General">
            <ShortcutRow keys="⌘P" desc="Command palette / quick open" />
            <ShortcutRow keys="⌘N" desc="New file" />
            <ShortcutRow keys="⌘B" desc="Toggle sidebar" />
            <ShortcutRow keys="⌘," desc="Settings" />
            <ShortcutRow keys="⌘W" desc="Close current tab" />
            <ShortcutRow keys="⌘⇧[" desc="Previous tab" />
            <ShortcutRow keys="⌘⇧]" desc="Next tab" />
          </HelpGroup>
          <HelpGroup title="Search">
            <ShortcutRow keys="⌘⇧F" desc="Search in workspace" />
            <ShortcutRow keys="⌘F" desc="Find in current file" />
          </HelpGroup>
          <HelpGroup title="Editor (Rich Mode)">
            <ShortcutRow keys="⌘S" desc="Save file" />
            <ShortcutRow keys="⌘B" desc="Bold" />
            <ShortcutRow keys="⌘I" desc="Italic" />
            <ShortcutRow keys="⌘E" desc="Inline code" />
            <ShortcutRow keys="⌘Z" desc="Undo" />
            <ShortcutRow keys="⌘⇧Z" desc="Redo" />
          </HelpGroup>
          <HelpGroup title="Panels">
            <ShortcutRow keys="⌘J" desc="Toggle scratch pad" />
            <ShortcutRow keys="⌘⇧G" desc="Toggle git panel" />
            <ShortcutRow keys="⌘⇧N" desc="Quick note" />
          </HelpGroup>
        </>
      );

    case 'search':
      return (
        <>
          <p>Search across your entire vault or within filenames.</p>
          <HelpGroup title="Search Modes">
            <HelpItem
              label="Content search"
              description="Search inside file contents. Finds text across all markdown files in your vault."
            />
            <HelpItem
              label="File name search"
              description="Filter files by name. Useful for quickly locating a specific document."
            />
          </HelpGroup>
          <HelpGroup title="Regex Support">
            <HelpItem
              label="Toggle regex"
              description="Click the .* button to enable regular expression search."
            />
            <HelpItem
              label="Examples"
              description="Click the regex examples below the input for common patterns (e.g., TODO|FIXME, ## .+)."
            />
          </HelpGroup>
          <HelpGroup title="Navigation">
            <HelpItem
              label="Keyboard"
              description="Use ↑↓ to navigate results, Enter to open, Tab to switch modes, Esc to close."
            />
            <HelpItem
              label="Click"
              description="Click any result to open that file at the matching location."
            />
          </HelpGroup>
        </>
      );

    case 'tags':
      return (
        <>
          <p>Organize files with frontmatter tags and color markers.</p>
          <HelpGroup title="Frontmatter Tags">
            <HelpItem
              label="How they work"
              description="Tags are stored in the YAML frontmatter of markdown files as tags: [tag1, tag2]. They persist with the file."
            />
            <HelpItem
              label="Add/remove tags"
              description="Use the Tags panel in the right sidebar. Click + next to 'Current file' to add a tag, or click the × on a tag to remove it."
            />
            <HelpItem
              label="Vault-wide view"
              description="The Tags panel shows all tags across the vault as chips with file counts. Click a tag to see which files use it."
            />
            <HelpItem
              label="Autocomplete"
              description="When adding a tag, existing vault tags are suggested as you type."
            />
          </HelpGroup>
          <HelpGroup title="Color Markers">
            <HelpItem
              label="Assign markers"
              description="Right-click a file and open the 'Markers' submenu to assign a color label."
            />
            <HelpItem
              label="Purpose"
              description="Markers add colored dots next to files in the explorer for visual categorization."
            />
          </HelpGroup>
          <HelpGroup title="Wiki Links & Backlinks">
            <HelpItem
              label="Create wiki links"
              description="Type [[ in the editor to open file suggestions. Links are stored as [[filename]] in markdown."
            />
            <HelpItem
              label="Navigate links"
              description="Click any [[wiki link]] in the editor to jump to that file."
            />
            <HelpItem
              label="Backlinks panel"
              description="The right sidebar shows incoming links — other files that reference the current document."
            />
            <HelpItem
              label="Outgoing links"
              description="The Links panel lists all wiki links in the current file with line numbers."
            />
          </HelpGroup>
        </>
      );

    case 'templates':
      return (
        <>
          <p>Templates provide pre-filled content for new files.</p>
          <HelpGroup title="Available Templates">
            <HelpItem
              label="Blank Document"
              description="Empty markdown file with just a heading."
            />
            <HelpItem
              label="Architecture Doc"
              description="System architecture template with components, data flow, and decisions."
            />
            <HelpItem
              label="Decision Record (ADR)"
              description="Architecture Decision Record with context, decision, and consequences."
            />
            <HelpItem
              label="Feature Spec"
              description="Feature specification with user stories, requirements, and acceptance criteria."
            />
            <HelpItem
              label="Meeting Notes"
              description="Meeting template with attendees, agenda, and action items."
            />
            <HelpItem label="API Spec" description="API endpoint documentation template." />
            <HelpItem
              label="Runbook"
              description="Operations runbook with steps, rollback, and monitoring."
            />
          </HelpGroup>
          <HelpGroup title="Diagram Templates">
            <HelpItem
              label="Mermaid diagrams"
              description="Flowchart, sequence diagram, class diagram, ER diagram, and state diagram templates."
            />
            <HelpItem
              label="Excalidraw"
              description="Blank canvas for freehand drawing and whiteboarding."
            />
          </HelpGroup>
          <HelpGroup title="Using Templates">
            <HelpItem
              label="Create from template"
              description="Press ⌘N or click +, then select a template from the grid. Choose a name and location."
            />
          </HelpGroup>
        </>
      );

    case 'settings':
      return (
        <>
          <p>Configure the app behavior and appearance.</p>
          <HelpGroup title="Editor Settings">
            <HelpItem label="Font size" description="Adjust the editor font size." />
            <HelpItem label="Font family" description="Choose between system fonts or monospace." />
            <HelpItem label="Line height" description="Control spacing between lines." />
            <HelpItem label="Word wrap" description="Toggle soft wrapping of long lines." />
            <HelpItem label="Tab size" description="Set indentation width (2 or 4 spaces)." />
          </HelpGroup>
          <HelpGroup title="File Settings">
            <HelpItem
              label="Save on focus change"
              description="When enabled, files auto-save when you switch tabs or leave the app."
            />
            <HelpItem
              label="Include patterns"
              description="Glob patterns that control which files appear in the explorer (e.g., *.md, *.excalidraw, *.mermaid). Folders always show."
            />
            <HelpItem
              label="Hidden paths"
              description="Files and folders hidden via right-click. Managed automatically."
            />
          </HelpGroup>
          <HelpGroup title="Accessing Settings">
            <HelpItem
              label="Open settings"
              description="Click the gear icon in the status bar, or press ⌘, (comma)."
            />
          </HelpGroup>
        </>
      );
  }
}

// --- Helper components ---

function HelpGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-0 border border-default rounded-lg p-4 space-y-2.5">
      <h4 className="text-xs font-medium text-muted uppercase tracking-wider">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function HelpItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-primary text-sm font-medium min-w-[120px] shrink-0">{label}</span>
      <span className="text-secondary text-sm">{description}</span>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-default text-xs font-mono text-secondary min-w-[3.5rem] text-center">
        {keys}
      </kbd>
      <span className="text-sm text-secondary">{desc}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-default text-xs font-mono text-secondary">
      {children}
    </kbd>
  );
}
