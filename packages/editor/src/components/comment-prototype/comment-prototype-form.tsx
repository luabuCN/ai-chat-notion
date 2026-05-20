import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AtSignIcon, CornerDownLeftIcon, Trash2Icon } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "../../lib/utils";

export type CommentPrototypeEntry = {
  id: string;
  authorName: string;
  authorColor?: string;
  authorAvatar?: string;
  body: string;
  /** epoch ms — 原型展示时间用 */
  createdAtMs: number;
};

function formatCommentPrototypeTime(createdAtMs: number) {
  const date = new Date(createdAtMs);
  const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
  const hm = date.toLocaleTimeString("zh-CN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${monthDay}, ${hm}`;
}

function getAuthorInitial(name: string) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  const [first] = Array.from(trimmed);
  return (first ?? "?").toUpperCase();
}

function CommentAuthorAvatar({
  name,
  color,
  avatar,
}: {
  name: string;
  color?: string;
  avatar?: string;
}) {
  if (avatar) {
    return (
      <span
        aria-hidden
        className="size-7 shrink-0 rounded-sm bg-center bg-cover bg-no-repeat shadow-sm"
        style={{
          backgroundImage: `url(${JSON.stringify(avatar)})`,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-sm text-xs font-semibold leading-none text-white shadow-sm"
      style={{ backgroundColor: color ?? "var(--primary)" }}
    >
      {getAuthorInitial(name)}
    </span>
  );
}

const cardShell =
  "rounded-sm border-0 bg-background pl-3 pr-2 py-2 text-foreground shadow-[0_0_1px_1px_rgb(0_0_0/0.05),0px_8px_24px_0px_rgb(0_0_0/0.1)] ring-0";

type CommentPrototypeFormProps = {
  className?: string;
  comments: CommentPrototypeEntry[];
  onAddComment: (body: string) => void;
  onDeleteComment: (commentId: string) => void;
  /** 输入框是否在挂载后自动聚焦 */
  autoFocus?: boolean;
};

/** 选区气泡与边距评论共用的占位输入（无边框卡片，只靠阴影托起） */
export function CommentPrototypeForm({
  className,
  comments,
  onAddComment,
  onDeleteComment,
  autoFocus = true,
}: CommentPrototypeFormProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    inputRef.current?.focus();
  }, [autoFocus]);

  const submitDraft = useCallback(() => {
    const next = draft.trim();
    if (next.length === 0) {
      return;
    }
    onAddComment(next);
    setDraft("");
  }, [draft, onAddComment]);

  const handleDraftKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") {
        return;
      }
      e.preventDefault();
      submitDraft();
    },
    [submitDraft]
  );

  return (
    <div className={cn("w-[min(20rem,calc(100vw-2rem))]", className)}>
      <div className={cn("flex flex-col gap-2", cardShell)}>
        {comments.length > 0 ? (
          <ul
            aria-label="评论列表"
            className="flex flex-col gap-3"
          >
            {comments.map((c) => (
              <li className="group" key={c.id}>
                <div className="flex gap-2">
                  <CommentAuthorAvatar
                    avatar={c.authorAvatar}
                    color={c.authorColor}
                    name={c.authorName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.authorName}
                        </span>
                        <time
                          className="text-xs tabular-nums text-muted-foreground"
                          dateTime={new Date(c.createdAtMs).toISOString()}
                        >
                          {formatCommentPrototypeTime(c.createdAtMs)}
                        </time>
                      </div>
                      <Button
                        aria-label="删除本条评论"
                        className="-mr-1 size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={() => {
                          onDeleteComment(c.id);
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2Icon aria-hidden className="size-3.5" />
                      </Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug">
                      {c.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-0.5",
            comments.length > 0 &&
              "-mx-px mt-px border-t border-border/50 px-px pt-1.5"
          )}
        >
          <Input
            aria-label="评论内容（原型占位）"
            className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
            onChange={(ev) => {
              setDraft(ev.target.value);
            }}
            onKeyDown={handleDraftKeyDown}
            placeholder="Add comment..."
            ref={inputRef}
            value={draft}
          />
          <Button
            aria-label="提及用户"
            className="size-7 shrink-0 text-muted-foreground hover:text-muted-foreground"
            size="icon"
            type="button"
            variant="ghost"
          >
            <AtSignIcon aria-hidden className="size-4 stroke-[1.25]" />
          </Button>
          <Button
            aria-label="提交评论"
            className="size-7 shrink-0 text-muted-foreground hover:text-muted-foreground"
            onClick={submitDraft}
            size="icon"
            type="button"
            variant="ghost"
          >
            <CornerDownLeftIcon aria-hidden className="size-4 stroke-[1.25]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
