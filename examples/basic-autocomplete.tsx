import React, { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { useCompletion } from '@ai-sdk/react'
import StarterKit from '@tiptap/starter-kit'
import { 
  AIAutocomplete, 
  useAIAutocomplete, 
  AIGhostOverlay 
} from '@your-org/tiptap-ai-autocomplete'

export function BasicAutocompleteExample() {
  const [editor, setEditor] = useState<any>(null)

  // AI completion hook
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/openrouter/complete',
    streamProtocol: 'text'
  })

  // TipTap editor with AI extension
  const editorInstance = useEditor({
    extensions: [
      StarterKit,
      AIAutocomplete.configure({
        enabled: true,
        model: 'openrouter/auto',
        maxTokens: 60,
        temperature: 0.7,
        promptTemplate: (text: string) => 
          text.trim().length > 0
            ? `Continue this text naturally: "${text}"\n\nContinuation:`
            : 'Write an engaging opening sentence.'
      })
    ],
    content: '<p>Start typing here and press Tab for AI suggestions...</p>',
    onCreate: ({ editor }) => setEditor(editor),
    immediatelyRender: false
  })

  // AI autocomplete hook
  const { pendingCompletion, ghostPosition, registerHandlers } = useAIAutocomplete({
    editor: editorInstance,
    completionProvider: { complete, completion, isLoading },
    options: { enabled: true }
  })

  // Register handlers when editor is ready
  useEffect(() => {
    if (editorInstance) {
      registerHandlers(editorInstance)
    }
  }, [editorInstance, registerHandlers])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Basic AI Autocomplete</h1>
      
      <div className="relative border rounded-lg p-4">
        <EditorContent 
          editor={editorInstance}
          className="min-h-[200px] prose max-w-none"
        />
        
        {/* Ghost text overlay */}
        <AIGhostOverlay
          text={pendingCompletion}
          position={ghostPosition}
          isDark={false}
        />
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Type some text</li>
          <li>Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> to request AI suggestion</li>
          <li>Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> again to accept</li>
          <li>Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to dismiss</li>
        </ul>
      </div>
    </div>
  )
}