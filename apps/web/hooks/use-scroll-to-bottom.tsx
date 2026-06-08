import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>("messages:should-scroll", null, { fallbackData: false });

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    // Check if we are within 100px of the bottom (like v0 does)
    const atBottom = scrollTop + clientHeight >= scrollHeight - 100;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    // 内容增长时（流式输出），如果用户停留在底部就自动跟随滚动
    const followToBottom = () => {
      if (isAtBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        followToBottom();
        handleScroll();
      });
    });

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(() => {
        followToBottom();
        requestAnimationFrame(() => {
          handleScroll();
        });
      });
    });

    resizeObserver.observe(container);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (scrollBehavior && containerRef.current) {
      const container = containerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: scrollBehavior,
      };
      container.scrollTo(scrollOptions);
      setScrollBehavior(false);
    }
  }, [scrollBehavior, setScrollBehavior]);

  const scrollToBottom = useCallback(
    (currentScrollBehavior: ScrollBehavior = "smooth") => {
      setScrollBehavior(currentScrollBehavior);
    },
    [setScrollBehavior]
  );

  function onViewportEnter() {
    isAtBottomRef.current = true;
    setIsAtBottom(true);
  }

  function onViewportLeave() {
    isAtBottomRef.current = false;
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
