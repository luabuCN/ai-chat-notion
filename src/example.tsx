/**
 * Example: How to refactor your editor to use the AI Autocomplete plugin
 * 
 * BEFORE: Manual Tab handling in editor page
 * AFTER: Clean plugin-based approach
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useCompletion } from '@ai-sdk/react';
import type { Editor } from '@tiptap/react';
import { MinimalTiptapEditor } from '../../minimal-tiptap';
import { AIAutocomplete, useAIAutocomplete, AIGhostOverlay } from './index';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { CodeBlockLowlight } from '../code-block-lowlight';
import useTheme from '../../hooks/use-theme';

interface AIEditorExampleProps {
  selectedModel?: string;
  isAutocompleteEnabled?: boolean;
}

export function AIEditorExample({ 
  selectedModel = 'openrouter/auto',
  isAutocompleteEnabled = true 
}: AIEditorExampleProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const isDark = useTheme();

  // AI SDK completion hook
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/openrouter/complete',
    streamProtocol: 'text',
  });

  // Setup extensions with AI autocomplete
  const extensions = useMemo(() => [
    StarterKit.configure({
      history: { depth: 100 },
    }),
    Placeholder.configure({
      placeholder: "Start typing... Press Tab to autocomplete to the next sentence.",
    }),
    CodeBlockLowlight,
    AIAutocomplete.configure({
      enabled: isAutocompleteEnabled,
      model: selectedModel,
      maxTokens: 60,
      temperature: 0.5,
      stopSequences: ['\n\n'],
      // Custom prompt for novel writing
      promptTemplate: (text: string) => 
        text.trim().length > 0
          ? `Continue this story with the next sentence. Keep it engaging and match the tone:\n\n${text}\n\nNext sentence:`
          : 'Write an engaging opening sentence for a story.',
    }),
  ], [selectedModel, isAutocompleteEnabled]);

  // Use the autocomplete hook
  const { pendingCompletion, ghostPosition } = useAIAutocomplete({
    editor,
    completionProvider: { complete, completion, isLoading },
    options: {
      model: selectedModel,
      enabled: isAutocompleteEnabled,
    },
  });

  const content = useMemo(() => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "" }],
      },
    ],
  }), []);

  return (
    <div className="relative">
      <MinimalTiptapEditor
        className="min-h-[200px]"
        immediatelyRender={false}
        extensions={extensions}
        content={content}
        onCreate={({ editor }) => setEditor(editor)}
      />
      
      <AIGhostOverlay
        text={pendingCompletion}
        position={ghostPosition}
        isDark={isDark}
      />
    </div>
  );
}

/**
 * COMPARISON:
 * 
 * OLD WAY (manual):
 * - 100+ lines of keyboard handling
 * - Mixed concerns in component
 * - Hard to reuse
 * - Ghost positioning logic in component
 * - Manual ref management
 * 
 * NEW WAY (plugin):
 * - ~20 lines for full setup
 * - Clean separation of concerns  
 * - Highly reusable
 * - Plugin handles positioning
 * - Hook manages state
 * 
 * BENEFITS:
 * ✅ Plug and play in any TipTap editor
 * ✅ Configurable options
 * ✅ TypeScript support
 * ✅ Multiple key bindings
 * ✅ Easy to test and maintain
 * ✅ Can be shared across projects
 */