import * as React from "react"
import type { Editor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { TextTransformDialog } from "@/components/ui/text-transform-dialog"
import { Loader2, Wand2, Plus, Minus, Sparkles, BookOpen, Users, Building } from "lucide-react"

interface AITextBubbleMenuProps {
  editor: Editor
}

interface TextTransformAction {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

const textActions: TextTransformAction[] = [
  {
    id: 'make-longer',
    label: 'Make Longer',
    icon: <Plus className="w-4 h-4" />,
    description: 'Expand and add more detail'
  },
  {
    id: 'make-shorter',
    label: 'Make Shorter', 
    icon: <Minus className="w-4 h-4" />,
    description: 'Condense and shorten'
  },
  {
    id: 'improve',
    label: 'Improve',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Enhance writing quality'
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: <BookOpen className="w-4 h-4" />,
    description: 'Make easier to understand'
  },
  {
    id: 'formalize',
    label: 'Formalize',
    icon: <Building className="w-4 h-4" />,
    description: 'Make more professional'
  },
  {
    id: 'casualize',
    label: 'Casualize',
    icon: <Users className="w-4 h-4" />,
    description: 'Make more conversational'
  }
];

export const AITextBubbleMenu: React.FC<AITextBubbleMenuProps> = ({ editor }) => {
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null)
  const [selectedText, setSelectedText] = React.useState("")
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [currentAction, setCurrentAction] = React.useState<string>("")
  const [selectionRange, setSelectionRange] = React.useState<{ from: number; to: number } | null>(null)

  const updateSelectedText = React.useCallback(() => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, " ")
    setSelectedText(text)
    setSelectionRange({ from, to })
    
    // Calculate position at the end of selection
    try {
      const endCoords = editor.view.coordsAtPos(to)
      
      setPosition({
        top: endCoords.bottom + 8, // 8px below selection end
        left: endCoords.right - 10 // Offset left by 10px to align nicely
      })
    } catch (error) {
      console.error('Error calculating position:', error)
      setPosition(null)
    }
  }, [editor])

  const [showMenu, setShowMenu] = React.useState(false)
  
  React.useEffect(() => {
    const handleSelectionChange = () => {
      const { from, to } = editor.state.selection
      
      // Only show when there's actual text selected (not just cursor position)
      if (from === to) {
        setShowMenu(false)
        return
      }

      // Don't show if editor is not editable
      if (!editor.isEditable) {
        setShowMenu(false)
        return
      }

      const text = editor.state.doc.textBetween(from, to, " ").trim()
      
      // Only show if there's meaningful text selected (at least 5 characters)
      if (text.length < 5) {
        setShowMenu(false)
        return
      }

      updateSelectedText()
      setShowMenu(true)
    }

    editor.on('selectionUpdate', handleSelectionChange)
    editor.on('update', handleSelectionChange)
    
    return () => {
      editor.off('selectionUpdate', handleSelectionChange)
      editor.off('update', handleSelectionChange)
    }
  }, [editor, updateSelectedText])

  const handleTextTransform = React.useCallback((action: string) => {
    if (!selectedText.trim()) return
    
    setCurrentAction(action)
    setDialogOpen(true)
    setShowMenu(false) // Hide the menu when dialog opens
  }, [selectedText])

  const handleAcceptTransform = React.useCallback((transformedText: string) => {
    if (!selectionRange) return

    // Replace the selected text with the transformed text
    editor
      .chain()
      .focus()
      .setTextSelection(selectionRange)
      .deleteSelection()
      .insertContent(transformedText)
      .run()
  }, [editor, selectionRange])

  const handleRejectTransform = React.useCallback(() => {
    // Just close the dialog, no changes to text
  }, [])

  const handleDialogClose = React.useCallback(() => {
    setDialogOpen(false)
    setCurrentAction("")
  }, [])

  return (
    <>
      {/* Bubble Menu */}
      {showMenu && position && createPortal(
        <div 
          className="fixed bg-popover text-popover-foreground rounded border shadow-lg z-50"
          style={{
            top: position.top,
            left: position.left,
            minWidth: '160px',
            maxWidth: '180px'
          }}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1.5 border-b bg-muted/20">
            <Wand2 className="w-4 h-4" />
            <span>AI Edit</span>
          </div>
          
          <div className="py-1 space-y-0">
            {textActions.map((action) => (
              <button
                key={action.id}
                className="w-full h-8 px-3 text-sm text-left hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                onClick={() => handleTextTransform(action.id)}
                title={action.description}
              >
                <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {React.cloneElement(action.icon as React.ReactElement, { 
                    className: "w-4 h-4" 
                  })}
                </span>
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Streaming Dialog */}
      <TextTransformDialog
        isOpen={dialogOpen}
        onClose={handleDialogClose}
        onAccept={handleAcceptTransform}
        onReject={handleRejectTransform}
        originalText={selectedText}
        action={currentAction}
      />
    </>
  )
}