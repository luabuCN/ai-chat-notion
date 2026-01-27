'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X, RefreshCw } from 'lucide-react'

interface TextTransformDialogProps {
  isOpen: boolean
  onClose: () => void
  onAccept: (transformedText: string) => void
  onReject: () => void
  originalText: string
  action: string
  model?: string
}

export function TextTransformDialog({
  isOpen,
  onClose,
  onAccept,
  onReject,
  originalText,
  action,
  model = 'openrouter/auto'
}: TextTransformDialogProps) {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actionLabels: Record<string, string> = {
    'make-longer': 'Make Longer',
    'make-shorter': 'Make Shorter',
    'improve': 'Improve',
    'simplify': 'Simplify',
    'formalize': 'Formalize',
    'casualize': 'Casualize',
  }

  const resetState = () => {
    setStreamedText('')
    setIsStreaming(false)
    setError(null)
  }

  const startStreaming = async () => {
    if (!isOpen || !originalText || !action) return

    resetState()
    setIsStreaming(true)

    try {
      const response = await fetch('/api/openrouter/text-transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: originalText,
          action,
          model,
          max_tokens: 200,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to transform text')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'content' && data.content) {
                setStreamedText(prev => prev + data.content)
              } else if (data.type === 'done') {
                setIsStreaming(false)
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error)
      setError('Failed to transform text. Please try again.')
      setIsStreaming(false)
    }
  }

  // Start streaming when dialog opens
  useEffect(() => {
    if (isOpen && originalText && action) {
      startStreaming()
    }
  }, [isOpen, originalText, action])

  const handleAccept = () => {
    if (streamedText.trim()) {
      onAccept(streamedText.trim())
      onClose()
    }
  }

  const handleReject = () => {
    onReject()
    onClose()
  }

  const handleRetry = () => {
    startStreaming()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>AI Text Transformation</span>
            <Badge variant="secondary" className="text-xs">
              {actionLabels[action] || action}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Original Text */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Original:</h4>
            <div className="p-3 bg-muted/30 rounded-md text-sm max-h-24 overflow-y-auto">
              {originalText}
            </div>
          </div>

          {/* Transformed Text */}
          <div className="flex-1 min-h-0">
            <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              {actionLabels[action] || 'Transformed'}:
              {isStreaming && <Loader2 className="w-3 h-3 animate-spin" />}
            </h4>
            <div className="p-3 bg-muted/10 rounded-md text-sm min-h-[120px] max-h-60 overflow-y-auto border-2 border-dashed border-muted">
              {error ? (
                <div className="text-destructive flex items-center gap-2">
                  <X className="w-4 h-4" />
                  {error}
                </div>
              ) : streamedText || isStreaming ? (
                <div className="whitespace-pre-wrap">
                  {streamedText}
                  {isStreaming && <span className="animate-pulse">|</span>}
                </div>
              ) : (
                <div className="text-muted-foreground italic">
                  Generating transformation...
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {error ? (
            <Button 
              onClick={handleRetry}
              variant="outline"
              disabled={isStreaming}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          ) : null}
          
          <Button 
            onClick={handleReject}
            variant="outline"
            disabled={isStreaming}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Reject
          </Button>
          
          <Button 
            onClick={handleAccept}
            disabled={isStreaming || !streamedText.trim() || !!error}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Accept Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}