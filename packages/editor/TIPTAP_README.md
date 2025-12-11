# TiptapEditor

A powerful, feature-rich block editor built with Tiptap, extracted from the tiptap-block-editor project.

## Features

- **Rich Text Editing**: Full-featured WYSIWYG editor with markdown support
- **AI Integration**: Built-in AI writing assistance and commands
- **Code Blocks**: Syntax highlighting with language selection
- **Tables**: Resizable tables with advanced controls
- **Mathematics**: KaTeX support for mathematical expressions
- **Mermaid Diagrams**: Create flowcharts and diagrams
- **Charts**: Interactive chart creation and editing
- **Media**: Image and YouTube video embedding
- **Drag & Drop**: Reorder blocks with drag handles
- **Slash Commands**: Quick access to all features via `/` command

## Installation

The package is already part of the monorepo. Install dependencies:

```bash
pnpm install
```

## Usage

### Basic Usage

```tsx
import { TiptapEditor } from "@repo/editor";
import "@repo/editor/styles";

function MyEditor() {
  return (
    <TiptapEditor
      placeholder="Type / for commands..."
      onCreate={(editor) => console.log("Editor created", editor)}
      onUpdate={(editor) => console.log("Content updated", editor)}
    />
  );
}
```

### With AI Tools

```tsx
<TiptapEditor
  showAiTools={true}
  placeholder="Start writing..."
  className="min-h-[500px]"
/>
```

### Content Management

```tsx
import { TiptapEditor, type TiptapEditor as EditorType } from "@repo/editor";
import { useState } from "react";

function MyEditor() {
  const [editor, setEditor] = useState<EditorType>();

  const handleSave = () => {
    if (editor) {
      const html = editor.getHTML();
      const json = editor.getJSON();
      // Save content...
    }
  };

  return (
    <>
      <TiptapEditor
        content={initialContent}
        onCreate={setEditor}
        onUpdate={setEditor}
      />
      <button onClick={handleSave}>Save</button>
    </>
  );
}
```

## Props

### TiptapEditorProps

| Prop          | Type                       | Default                    | Description                                  |
| ------------- | -------------------------- | -------------------------- | -------------------------------------------- |
| `content`     | `Content`                  | `undefined`                | Initial editor content (HTML, JSON, or text) |
| `placeholder` | `string`                   | `"Type / for commands..."` | Placeholder text when editor is empty        |
| `onCreate`    | `(editor: Editor) => void` | `undefined`                | Callback when editor is created              |
| `onUpdate`    | `(editor: Editor) => void` | `undefined`                | Callback when content changes                |
| `className`   | `string`                   | `""`                       | Additional CSS classes                       |
| `showAiTools` | `boolean`                  | `true`                     | Enable/disable AI features                   |

## Styling

Import the editor styles in your component or app:

```tsx
import "@repo/editor/styles";
```

The editor uses Tailwind CSS classes and requires the following in your `tailwind.config.js`:

```js
module.exports = {
  content: [
    // ... your content
    "./node_modules/@repo/editor/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [require("@tailwindcss/typography")],
};
```

## Dependencies

### Required Peer Dependencies

- `react` ^18 || ^19
- `react-dom` ^18 || ^19

### UI Components

The editor requires UI components from `@repo/ui`:

- Button
- Input
- Textarea
- Popover
- Dialog
- DropdownMenu
- ScrollArea
- Separator
- Label
- Table
- Alert
- DatePicker
- AutocompleteDropdown
- CodeTextarea
- BounceSpinner

Make sure these components are available in your `@repo/ui` package.

## Content Renderer

For read-only content display, use the `ContentRenderer`:

```tsx
import { ContentRenderer } from "@repo/editor";

function DisplayContent({ html }: { html: string }) {
  return <ContentRenderer content={html} />;
}
```

## Advanced Features

### Slash Commands

Type `/` to access:

- Headings (H1-H6)
- Lists (bullet, numbered, todo)
- Code blocks
- Tables
- Images
- Videos
- Math equations
- Mermaid diagrams
- Charts
- AI commands (if enabled)

### AI Features

When `showAiTools={true}`:

- AI writing assistance
- Content generation
- Text improvement
- Summarization
- Translation

### Keyboard Shortcuts

- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + U` - Underline
- `Cmd/Ctrl + Shift + S` - Strikethrough
- `Cmd/Ctrl + K` - Add link
- `Cmd/Ctrl + Alt + 1-6` - Headings
- `Tab` - Indent in code blocks
- `Shift + Tab` - Outdent in code blocks

## File Structure

```
packages/editor/src/
├── tiptap-editor.tsx          # Main editor component
├── tiptap/
│   ├── default-extensions.ts  # All Tiptap extensions
│   ├── content-renderer.tsx   # Read-only content display
│   ├── extensions/            # Custom extensions
│   │   ├── ai.ts
│   │   ├── ai-writer/
│   │   ├── ai-placeholder/
│   │   ├── chart/
│   │   ├── code-block/
│   │   ├── mermaid/
│   │   ├── slash-command/
│   │   ├── table/
│   │   └── mathematics.ts
│   ├── menus/                 # Editor menus
│   │   ├── default-bubble-menu.tsx
│   │   ├── table-options-menu.tsx
│   │   └── selectors/
│   └── utilities/             # Helper functions
├── lib/
│   └── utils.ts               # Utility functions
└── styles/
    └── tiptap-editor.css      # Editor styles
```

## Migration from tiptap-block-editor

If you're migrating from the standalone `tiptap-block-editor`:

1. Replace `BlockEditor` imports with `TiptapEditor`
2. Import styles: `import "@repo/editor/styles"`
3. Update prop names if needed (they're mostly the same)
4. Ensure UI components from `@repo/ui` are available

## Examples

See `apps/web/components/editor/editor-client.tsx` for a complete integration example.

## License

Same as the parent project.
