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
import {
  MentionDropdown,
  filterMentionableUsers,
  type MentionableUser,
} from "./mention-dropdown";

export type MentionUser = {
  id: string;
  name: string;
  avatar?: string;
};

/** 提交评论含 @提及时，由宿主层调用服务端通知 API */
export type CommentMentionNotifyParams = {
  documentId: string;
  blockId: string;
  commentId: string;
  body: string;
  mentions: MentionUser[];
};

export type CommentPrototypeEntry = {
  id: string;
  authorName: string;
  authorColor?: string;
  authorAvatar?: string;
  body: string;
  /** 被 @提及 的用户列表 */
  mentions?: MentionUser[];
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
  onAddComment: (body: string, mentions: MentionUser[]) => void;
  onDeleteComment: (commentId: string) => void;
  /** 输入框是否在挂载后自动聚焦 */
  autoFocus?: boolean;
  /** 文档 ID，用于获取可提及用户 */
  documentId?: string;
  /** 可提及的用户列表（由外部提供） */
  mentionableUsers?: MentionableUser[];
  /** 高亮目标评论 ID（从通知跳转时使用） */
  highlightCommentId?: string;
  /** 通知跳转时的目标 block ID；有值时跳过评论列表内滚动 */
  highlightBlockId?: string;
};

function CommentBody({
  body,
  mentions,
}: {
  body: string;
  mentions?: MentionUser[];
}) {
  if (!mentions || mentions.length === 0) {
    return <>{body}</>;
  }
  const parts = body.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        const mention = mentions.find((m) => `@${m.name}` === part);
        if (mention) {
          return (
            <span
              key={i}
              className="rounded bg-primary/10 px-0.5 font-medium text-primary"
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

/** 选区气泡与边距评论共用的占位输入（无边框卡片，只靠阴影托起） */
export function CommentPrototypeForm({
  className,
  comments,
  onAddComment,
  onDeleteComment,
  autoFocus = true,
  documentId,
  mentionableUsers = [],
  highlightCommentId,
  highlightBlockId,
}: CommentPrototypeFormProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  // @mention state
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>([]);
  /** 通知跳转高亮：闪 3 次（~1.8s），不再使用 animate-pulse 无限循环 */
  const [flashingCommentId, setFlashingCommentId] = useState<
    string | undefined
  >();

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    // 评论面板为 fixed 定位；默认 focus 会触发浏览器 scrollIntoView，导致页面异常下滚
    inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (!highlightCommentId) {
      return;
    }
    setFlashingCommentId(highlightCommentId);
    const timer = window.setTimeout(() => {
      setFlashingCommentId(undefined);
    }, 1800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightCommentId]);

  // Auto-scroll to highlighted comment
  // Skipped when highlightBlockId is set (notification jump) — the parent
  // CommentBlockMarginTrigger already scrolls to the target block; scrolling
  // here would fight that and push the page downward.
  useEffect(() => {
    if (!highlightCommentId || highlightBlockId || !highlightRef.current) {
      return;
    }
    highlightRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [highlightCommentId, highlightBlockId, comments.length]);

  const filteredUsers = filterMentionableUsers(mentionableUsers, mentionFilter);

  const submitDraft = useCallback(() => {
    const next = draft.trim();
    if (next.length === 0) {
      return;
    }
    onAddComment(next, selectedMentions);
    setDraft("");
    setSelectedMentions([]);
  }, [draft, onAddComment, selectedMentions]);

  const handleSelectUser = useCallback(
    (user: MentionableUser) => {
      const atIndex = draft.lastIndexOf("@");
      const newDraft = draft.slice(0, atIndex) + `@${user.name} `;
      setDraft(newDraft);
      setSelectedMentions((prev) => {
        if (prev.some((m) => m.id === user.id)) return prev;
        return [...prev, { id: user.id, name: user.name, avatar: user.avatar }];
      });
      setShowMention(false);
      inputRef.current?.focus();
    },
    [draft]
  );

  const handleDraftKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (showMention) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % Math.max(filteredUsers.length, 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex(
            (i) =>
              (i - 1 + Math.max(filteredUsers.length, 1)) %
              Math.max(filteredUsers.length, 1)
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredUsers[mentionIndex]) {
            handleSelectUser(filteredUsers[mentionIndex]);
          }
        } else if (e.key === "Escape") {
          setShowMention(false);
        }
        return;
      }
      if (e.key !== "Enter") {
        return;
      }
      e.preventDefault();
      submitDraft();
    },
    [showMention, filteredUsers, mentionIndex, handleSelectUser, submitDraft]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setDraft(value);
      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const afterAt = value.slice(lastAtIndex + 1);
        if (!afterAt.includes(" ") && mentionableUsers.length > 0) {
          setShowMention(true);
          setMentionFilter(afterAt.toLowerCase());
          setMentionIndex(0);
          return;
        }
      }
      setShowMention(false);
    },
    [mentionableUsers.length]
  );

  const handleAtButtonClick = useCallback(() => {
    const cursorPos = inputRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursorPos);
    const after = draft.slice(cursorPos);
    const newDraft = before + "@" + after;
    setDraft(newDraft);
    setShowMention(mentionableUsers.length > 0);
    setMentionFilter("");
    setMentionIndex(0);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = cursorPos + 1;
        inputRef.current.setSelectionRange(pos, pos);
        inputRef.current.focus();
      }
    }, 0);
  }, [draft, mentionableUsers.length]);

  return (
    <div className={cn("w-[min(20rem,calc(100vw-2rem))]", className)}>
      <div className={cn("flex flex-col gap-2", cardShell)}>
        {comments.length > 0 ? (
          <ul aria-label="评论列表" className="flex flex-col gap-3">
            {comments.map((c) => (
              <li
                className={cn(
                  "group",
                  c.id === flashingCommentId && "flash-highlight"
                )}
                key={c.id}
                ref={c.id === highlightCommentId ? highlightRef : undefined}
              >
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
                      <CommentBody body={c.body} mentions={c.mentions} />
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
            aria-label="评论内容"
            className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
            onChange={(ev) => {
              handleInputChange(ev.target.value);
            }}
            onKeyDown={handleDraftKeyDown}
            placeholder="Add comment..."
            ref={inputRef}
            value={draft}
          />
          <Button
            aria-label="提及用户"
            className="size-7 shrink-0 text-muted-foreground hover:text-muted-foreground"
            onClick={handleAtButtonClick}
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
      {showMention && filteredUsers.length > 0 && (
        <MentionDropdown
          filterText={mentionFilter}
          onSelect={handleSelectUser}
          position={(() => {
            const rect = inputRef.current?.getBoundingClientRect();
            return rect
              ? { top: rect.bottom + 4, left: rect.left }
              : { top: 0, left: 0 };
          })()}
          selectedIndex={mentionIndex}
          users={filteredUsers}
        />
      )}
    </div>
  );
}
