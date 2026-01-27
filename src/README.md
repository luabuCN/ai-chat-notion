# AI Autocomplete Extension for TipTap

A plug-and-play AI autocomplete extension for TipTap editors with ghost text suggestions and customizable key bindings.

## Features

- 🎯 **Smart Tab Handling**: Tab to request/accept suggestions intelligently 
- ⌨️ **Multiple Accept Keys**: Tab, Enter, or Right Arrow to accept
- 🔑 **Escape to Dismiss**: Easy suggestion dismissal
- 👻 **Ghost Text**: Cursor-positioned preview overlay
- 🛠️ **Highly Configurable**: Custom prompts, post-processing, and key bindings
- 🪝 **React Hook**: Simple integration with existing AI providers
- 📦 **TypeScript**: Full type safety

## Quick Start

### 1. Add the Extension

```typescript
import { AIAutocomplete } from '@/components/ui/minimal-tiptap/extensions/ai-autocomplete';

const extensions = [
  StarterKit,
  AIAutocomplete.configure({
    enabled: true,
    model: 'openrouter/auto',
    maxTokens: 60,
  }),
  // ... other extensions
];
```

### 2. Use the Hook

```typescript
import { useCompletion } from '@ai-sdk/react';
import { useAIAutocomplete, AIGhostOverlay } from '@/components/ui/minimal-tiptap/extensions/ai-autocomplete';

function MyEditor() {
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/openrouter/complete',
  });

  const [editor, setEditor] = useState(null);

  const { pendingCompletion, ghostPosition } = useAIAutocomplete({
    editor,
    completionProvider: { complete, completion, isLoading },
    options: {
      model: 'openrouter/auto',
      temperature: 0.7,
    },
  });

  return (
    <div className="relative">
      <MinimalTiptapEditor
        extensions={extensions}
        onCreate={({ editor }) => setEditor(editor)}
      />
      <AIGhostOverlay
        text={pendingCompletion}
        position={ghostPosition}
        isDark={isDarkMode}
      />
    </div>
  );
}
```

## Configuration Options

```typescript
interface AIAutocompleteOptions {
  // Core settings
  enabled?: boolean;                    // Default: true
  model?: string;                       // Default: 'openrouter/auto'
  
  // Key bindings
  acceptKeys?: string[];                // Default: ['Tab', 'Enter', 'ArrowRight']
  dismissKey?: string;                  // Default: 'Escape'
  requestKey?: string;                  // Default: 'Tab'
  
  // AI parameters
  maxTokens?: number;                   // Default: 60
  temperature?: number;                 // Default: 0.5
  stopSequences?: string[];             // Default: ['\n\n']
  
  // Customization
  promptTemplate?: (text: string) => string;
  postProcess?: (completion: string) => string;
}
```

## Key Bindings

| Key | Action |
|-----|--------|
| `Tab` | Accept suggestion (if exists) or request new (if empty) |
| `Enter` | Accept suggestion |
| `→` (Right Arrow) | Accept suggestion |
| `Esc` | Dismiss suggestion |

## Custom Prompt Template

```typescript
const customOptions = {
  promptTemplate: (text: string) => {
    if (text.trim().length === 0) {
      return 'Write an engaging opening sentence for a story.';
    }
    return `Continue this narrative with one compelling sentence:\n\n${text}\n\nNext:`;
  },
  
  postProcess: (completion: string) => {
    // Custom processing - e.g., ensure proper capitalization
    return completion.trim().replace(/^[a-z]/, (match) => match.toUpperCase());
  },
};
```

## Advanced Usage

### With Custom AI Provider

```typescript
// Custom completion provider
const customProvider = {
  complete: async (prompt: string, options: any) => {
    const response = await fetch('/my-ai-api', {
      method: 'POST',
      body: JSON.stringify({ prompt, ...options }),
    });
    const data = await response.json();
    setCompletion(data.text);
  },
  completion: myCompletion,
  isLoading: myLoadingState,
};

const autocomplete = useAIAutocomplete({
  editor,
  completionProvider: customProvider,
});
```

### Styling Ghost Text

```typescript
<AIGhostOverlay
  text={pendingCompletion}
  position={ghostPosition}
  style={{
    color: '#8b5cf6', // Purple ghost text
    fontStyle: 'italic',
    opacity: 0.6,
  }}
  className="my-custom-ghost-class"
/>
```

## Commands

The extension adds TipTap commands you can call programmatically:

```typescript
// Accept current suggestion
editor.commands.acceptSuggestion();

// Dismiss current suggestion  
editor.commands.dismissSuggestion();

// Request new suggestion
editor.commands.requestSuggestion();
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type { 
  AIAutocompleteOptions, 
  AICompletionProvider,
  GhostTextPosition 
} from '@/components/ui/minimal-tiptap/extensions/ai-autocomplete';
```

## Integration Examples

### With OpenRouter

```typescript
const { complete, completion, isLoading } = useCompletion({
  api: '/api/openrouter/complete',
  streamProtocol: 'text',
});
```

### With OpenAI

```typescript
const { complete, completion, isLoading } = useCompletion({
  api: '/api/completion',
  body: {
    model: 'gpt-4',
    stream: true,
  },
});
```

### With Anthropic Claude

```typescript
const { complete, completion, isLoading } = useCompletion({
  api: '/api/anthropic/complete',
  body: {
    model: 'claude-3-sonnet-20240229',
  },
});
```

## Troubleshooting

### Ghost Text Not Appearing
- Ensure the editor container has `position: relative`
- Check that `pendingCompletion` has content
- Verify `ghostPosition` is not null

### Tab Key Not Working
- Make sure `enabled: true` in options
- Check for conflicting extensions (snippets, etc.)
- Verify the editor has focus

### Performance Issues
- Reduce `maxTokens` for faster completions
- Add debouncing to completion requests
- Use `stopSequences` to limit generation

## License

MIT - Feel free to use in any project!