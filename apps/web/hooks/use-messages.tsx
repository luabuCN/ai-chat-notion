import { useScrollToBottom } from "./use-scroll-to-bottom";

export function useMessages() {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  } = useScrollToBottom();

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
