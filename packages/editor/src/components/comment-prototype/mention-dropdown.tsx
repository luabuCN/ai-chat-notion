import { useEffect, useRef } from "react";
import type { MentionUser } from "./comment-prototype-form";

export type MentionableUser = MentionUser & {
  email?: string;
};

type MentionDropdownProps = {
  users: MentionableUser[];
  filterText: string;
  selectedIndex: number;
  onSelect: (user: MentionableUser) => void;
  position: { top: number; left: number };
};

export function MentionDropdown({
  users,
  filterText,
  selectedIndex,
  onSelect,
  position,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLUListElement | null>(null);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(filterText.toLowerCase())
  );

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed z-[9999] w-64 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ top: position.top, left: position.left }}
    >
      <ul aria-label="选择要提及的用户" className="max-h-48 overflow-y-auto" ref={listRef}>
        {filtered.map((user, i) => (
          <li key={user.id}>
            <button
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(user);
              }}
              type="button"
            >
              {user.avatar ? (
                <span
                  className="size-6 shrink-0 rounded-sm bg-center bg-cover bg-no-repeat"
                  style={{
                    backgroundImage: `url(${JSON.stringify(user.avatar)})`,
                  }}
                />
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-medium">
                  {(user.name[0] ?? "?").toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{user.name}</span>
              {user.email && (
                <span className="shrink-0 truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function filterMentionableUsers(
  users: MentionableUser[],
  filterText: string
): MentionableUser[] {
  const lower = filterText.toLowerCase();
  return users.filter((u) => u.name.toLowerCase().includes(lower));
}
