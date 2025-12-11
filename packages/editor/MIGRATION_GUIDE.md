# TiptapEditor Migration Guide

This guide explains how the TiptapEditor was extracted from `tiptap-block-editor` and integrated into the `@repo/editor` package.

## What Was Done

### 1. Files Copied

From `tiptap-block-editor/src/components/editor/` to `packages/editor/src/tiptap/`:

- ✅ `default-extensions.ts` - All Tiptap extensions configuration
- ✅ `content-renderer.tsx` - Read-only content display component
- ✅ `extensions/` - All custom extensions (AI, charts, mermaid, code blocks, etc.)
- ✅ `menus/` - Bubble menu, table menu, and all selectors
- ✅ `utilities/` - AI adapter and request completion utilities
- ✅ `styles/` - Editor CSS styles (renamed to `tiptap-editor.css`)

### 2. New Files Created

- ✅ `packages/editor/src/tiptap-editor.tsx` - Main TiptapEditor component
- ✅ `packages/editor/src/lib/utils.ts` - Utility functions (cn, safeParseNum, etc.)
- ✅ `packages/editor/TIPTAP_README.md` - Documentation
- ✅ `packages/editor/MIGRATION_GUIDE.md` - This file

### 3. Dependencies Added

Added to `packages/editor/package.json`:

```json
{
  "@tiptap/core": "^3.13.0",
  "@tiptap/extension-drag-handle-react": "^3.0.7",
  "@tiptap/extension-heading": "^3.0.7",
  "@tiptap/extension-image": "^3.0.7",
  "@tiptap/extension-table": "^3.10.4",
  "@tiptap/extension-text-align": "^3.0.7",
  "@tiptap/extension-text-style": "^3.0.7",
  "@tiptap/extension-youtube": "^3.0.7",
  "@tiptap/extensions": "^3.10.4",
  "@tiptap/markdown": "^3.10.4",
  "@tiptap/pm": "^3.10.4",
  "@tiptap/react": "^3.10.4",
  "@tiptap/starter-kit": "^3.10.4",
  "@tiptap/suggestion": "^3.0.7",
  "@floating-ui/dom": "^1.7.2",
  "chart.js": "^4.5.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "date-fns": "^4.1.0",
  "highlight.js": "^11.11.1",
  "katex": "^0.16.21",
  "lowlight": "^3.3.0",
  "lucide-react": "^0.554.0",
  "mermaid": "^11.12.1",
  "sonner": "^2.0.3",
  "tailwind-merge": "^3.3.0"
}
```

### 4. Import Path Updates

All imports were updated:

- `@/lib/utils` → `../../lib/utils` (relative paths)
- `@/components/ui/*` → `@repo/ui/*` (workspace package)

### 5. Package Exports

Updated `packages/editor/package.json`:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./styles": "./src/styles/tiptap-editor.css"
  }
}
```

## How to Use

### In Your App (e.g., apps/web)

```tsx
import { TiptapEditor } from "@repo/editor";
import "@repo/editor/styles";

function MyEditor() {
  return (
    <TiptapEditor
      placeholder="Type / for commands..."
      showAiTools={true}
      onCreate={(editor) => console.log("Editor created", editor)}
      onUpdate={(editor) => console.log("Content updated", editor)}
    />
  );
}
```

### Example: apps/web/components/editor/editor-client.tsx

```tsx
"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import "@repo/editor/styles";

const TiptapEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TiptapEditor),
  { ssr: false }
);

export function EditorClient() {
  return (
    <TiptapEditor
      placeholder="Type / for commands..."
      showAiTools={true}
      className="min-h-[500px]"
    />
  );
}
```

## Key Differences from Original

### Component Name

- **Before**: `BlockEditor` from `tiptap-block-editor`
- **After**: `TiptapEditor` from `@repo/editor`

### Import Paths

- **Before**: Direct imports from `tiptap-block-editor/src/components/editor`
- **After**: Package imports from `@repo/editor`

### Styles

- **Before**: `import "./components/editor/styles/block-editor.css"`
- **After**: `import "@repo/editor/styles"`

### Props

Props remain mostly the same:

- `content?: Content` - Initial content
- `placeholder?: string` - Placeholder text
- `onCreate?: (editor: Editor) => void` - Creation callback
- `onUpdate?: (editor: Editor) => void` - Update callback
- `className?: string` - Additional CSS classes (new)
- `showAiTools?: boolean` - Enable/disable AI features (new)

## Features Preserved

All features from the original `tiptap-block-editor` are preserved:

✅ Rich text editing with markdown support
✅ AI writing assistance
✅ Code blocks with syntax highlighting
✅ Tables with advanced controls
✅ Mathematics (KaTeX)
✅ Mermaid diagrams
✅ Charts (Chart.js)
✅ Image and YouTube embedding
✅ Drag & drop block reordering
✅ Slash commands
✅ Bubble menu
✅ Table options menu

## Required UI Components

The editor requires these components from `@repo/ui`:

- Alert
- AutocompleteDropdown
- BounceSpinner
- Button
- CodeTextarea
- DatePicker
- Dialog (DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle)
- DropdownMenu (all sub-components)
- Input
- Label
- Popover (PopoverContent, PopoverTrigger)
- ScrollArea (ScrollBar)
- Separator
- Table (all sub-components)
- Textarea

Make sure these are available in your `packages/ui` package.

## Troubleshooting

### Missing Dependencies

If you see errors about missing packages, run:

```bash
pnpm install
```

### UI Component Errors

If you see errors about missing UI components, ensure `@repo/ui` has all required components listed above.

### Style Issues

Make sure to:

1. Import the styles: `import "@repo/editor/styles"`
2. Include the package in your Tailwind config:
   ```js
   content: ["./node_modules/@repo/editor/**/*.{js,ts,jsx,tsx}"];
   ```
3. Add the typography plugin:
   ```js
   plugins: [require("@tailwindcss/typography")];
   ```

### Type Errors

The editor exports types:

```tsx
import { TiptapEditor, type TiptapEditorType } from "@repo/editor";

const [editor, setEditor] = useState<TiptapEditorType>();
```

## Next Steps

1. ✅ TiptapEditor extracted and packaged
2. ✅ Dependencies installed
3. ✅ Import paths updated
4. ✅ Documentation created
5. ⏳ Test in your application
6. ⏳ Customize as needed

## Support

For issues or questions:

1. Check `TIPTAP_README.md` for usage documentation
2. Review the example in `apps/web/components/editor/editor-client.tsx`
3. Inspect the original `tiptap-block-editor` for reference
