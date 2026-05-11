import type { Editor } from "@tiptap/core";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Replace,
  Search,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Input } from "@repo/ui";
import { getSearchReplaceState } from "../tiptap/extensions/search-replace/search-replace";

interface SearchReplacePanelProps {
  editor: Editor | null;
  readonly?: boolean;
}

interface SearchReplaceSnapshot {
  currentIndex: number;
  matchCount: number;
}

const emptySnapshot: SearchReplaceSnapshot = {
  currentIndex: 0,
  matchCount: 0,
};

function getSnapshot(editor: Editor | null): SearchReplaceSnapshot {
  if (!editor || editor.isDestroyed) {
    return emptySnapshot;
  }
  const state = getSearchReplaceState(editor.state);
  return {
    currentIndex: state.currentIndex,
    matchCount: state.matches.length,
  };
}

function scrollCurrentMatchIntoView() {
  requestAnimationFrame(() => {
    document
      .querySelector(".tiptap-search-result-current")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

export function SearchReplacePanel({
  editor,
  readonly = false,
}: SearchReplacePanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [snapshot, setSnapshot] = useState(() => getSnapshot(editor));

  const resultText = useMemo(() => {
    if (searchTerm.length === 0 || snapshot.matchCount === 0) {
      return "0/0";
    }
    return `${snapshot.currentIndex + 1}/${snapshot.matchCount}`;
  }, [searchTerm.length, snapshot.currentIndex, snapshot.matchCount]);

  const syncSnapshot = useCallback(() => {
    setSnapshot(getSnapshot(editor));
  }, [editor]);

  const closePanel = useCallback(() => {
    setOpen(false);
    setReplaceOpen(false);
    setSearchTerm("");
    setReplaceTerm("");
    editor?.commands.clearSearchResults();
    setSnapshot(emptySnapshot);
  }, [editor]);

  const openPanel = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const goToNext = useCallback(() => {
    if (!editor?.commands.goToNextSearchResult()) {
      return;
    }
    syncSnapshot();
    scrollCurrentMatchIntoView();
  }, [editor, syncSnapshot]);

  const goToPrevious = useCallback(() => {
    if (!editor?.commands.goToPreviousSearchResult()) {
      return;
    }
    syncSnapshot();
    scrollCurrentMatchIntoView();
  }, [editor, syncSnapshot]);

  const updateSearchTerm = useCallback(
    (value: string) => {
      setSearchTerm(value);
      editor?.commands.setSearchTerm(value);
      syncSnapshot();
      if (value.length > 0) {
        scrollCurrentMatchIntoView();
      }
    },
    [editor, syncSnapshot]
  );

  const replaceCurrent = useCallback(() => {
    if (readonly || !editor?.commands.replaceCurrentSearchResult(replaceTerm)) {
      return;
    }
    syncSnapshot();
    scrollCurrentMatchIntoView();
  }, [editor, readonly, replaceTerm, syncSnapshot]);

  const replaceAll = useCallback(() => {
    if (readonly || !editor?.commands.replaceAllSearchResults(replaceTerm)) {
      return;
    }
    syncSnapshot();
    scrollCurrentMatchIntoView();
  }, [editor, readonly, replaceTerm, syncSnapshot]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const onTransaction = () => {
      syncSnapshot();
    };

    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, syncSnapshot]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLocaleLowerCase() !== "f") {
        return;
      }
      event.preventDefault();
      openPanel();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [openPanel]);

  const onSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSearchTerm(event.target.value);
    },
    [updateSearchTerm]
  );

  const onReplaceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setReplaceTerm(event.target.value);
    },
    []
  );

  const onSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    },
    [closePanel, goToNext, goToPrevious]
  );

  const onReplaceKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    },
    [closePanel]
  );

  if (!open) {
    return null;
  }

  const replaceDisabled = readonly || snapshot.matchCount === 0;

  return (
    <div className="fixed right-4 top-16 z-[100010] w-[min(calc(100vw-2rem),28rem)] rounded-2xl border border-border/80 bg-background/95 p-3 text-foreground shadow-2xl shadow-black/15 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="-translate-y-1/2 pointer-events-none absolute left-3 top-1/2 size-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchTerm}
            onChange={onSearchChange}
            onKeyDown={onSearchKeyDown}
            className="h-9 rounded-xl pl-9 pr-14"
            placeholder="查找"
            aria-label="查找内容"
          />
          <span className="-translate-y-1/2 absolute right-3 top-1/2 text-xs tabular-nums text-muted-foreground">
            {resultText}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={goToPrevious}
          disabled={snapshot.matchCount === 0}
          aria-label="上一个匹配项"
        >
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={goToNext}
          disabled={snapshot.matchCount === 0}
          aria-label="下一个匹配项"
        >
          <ChevronDown className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant={replaceOpen ? "secondary" : "ghost"}
          size="icon"
          className="size-8 rounded-full"
          onClick={() => setReplaceOpen((value) => !value)}
          aria-label={replaceOpen ? "收起替换区域" : "展开替换区域"}
        >
          <ChevronsUpDown className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={closePanel}
          aria-label="关闭查找替换"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {replaceOpen ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Replace className="-translate-y-1/2 pointer-events-none absolute left-3 top-1/2 size-4 text-muted-foreground" />
            <Input
              value={replaceTerm}
              onChange={onReplaceChange}
              onKeyDown={onReplaceKeyDown}
              className="h-9 rounded-xl pl-9"
              placeholder="替换为"
              aria-label="替换内容"
              disabled={readonly}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 rounded-xl"
            onClick={replaceCurrent}
            disabled={replaceDisabled}
          >
            替换当前
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 rounded-xl"
            onClick={replaceAll}
            disabled={replaceDisabled}
          >
            全部替换
          </Button>
        </div>
      ) : null}
    </div>
  );
}
