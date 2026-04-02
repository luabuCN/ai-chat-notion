import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  cn,
} from "@repo/ui";
import { Check, User } from "lucide-react";
import { useState } from "react";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import { openMainSiteLogin } from "@/lib/auth/client";
import type { ExtensionWorkspace } from "@/lib/sidepanel-workspaces-api";
import { WEB_ORIGIN } from "@/lib/web-config";

function initialFromUser(auth: MainSiteAuthState): string {
  const u = auth.data?.user;
  const c =
    u?.name?.trim()?.charAt(0) ||
    u?.email?.trim()?.charAt(0) ||
    "";
  return c ? c.toUpperCase() : "?";
}

export function SidePanelHeaderAvatar({
  auth,
  workspaces,
  workspacesLoading,
  selectedWorkspaceSlug,
  onWorkspaceSelect,
  onWorkspacesMenuOpen,
}: {
  auth: MainSiteAuthState;
  workspaces: ExtensionWorkspace[];
  workspacesLoading: boolean;
  selectedWorkspaceSlug: string;
  onWorkspaceSelect: (slug: string) => void;
  onWorkspacesMenuOpen?: () => void;
}) {
  const authenticated = auth.data?.authenticated === true;
  const user = auth.data?.user;
  const initial = initialFromUser(auth);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const onUnauthenticatedClick = () => {
    void openMainSiteLogin();
  };

  const onOpenMainSite = () => {
    void browser.tabs.create({ url: WEB_ORIGIN });
  };

  if (!authenticated) {
    return (
      <button
        aria-label="前往主站登录"
        className="shrink-0 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onUnauthenticatedClick}
        type="button"
      >
        <Avatar className="size-8 border border-border">
          {user?.avatarUrl ? (
            <AvatarImage alt="" src={user.avatarUrl} />
          ) : null}
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {auth.loading ? (
              "…"
            ) : (
              <User aria-hidden className="size-4" />
            )}
          </AvatarFallback>
        </Avatar>
      </button>
    );
  }

  return (
    <Popover
      onOpenChange={(open) => {
        setPopoverOpen(open);
        if (open) {
          onWorkspacesMenuOpen?.();
        }
      }}
      open={popoverOpen}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          aria-label="选择空间"
          className="shrink-0 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <Avatar className="size-8 border border-border">
            {user?.avatarUrl ? (
              <AvatarImage alt="" src={user.avatarUrl} />
            ) : null}
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {auth.loading || workspacesLoading ? (
                "…"
              ) : (
                initial
              )}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-hidden p-0">
        <header
          className="border-border/80 border-b bg-muted/35 px-3 py-2.5"
          id="sidepanel-workspace-heading"
        >
          <div className="border-primary/55 border-l-2 pl-2.5">
            <p className="font-semibold text-[11px] text-muted-foreground tracking-wide">
              工作空间
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/75 leading-snug">
              当前对话将保存到所选空间
            </p>
          </div>
        </header>
        <div className="p-1.5">
          <ul
            aria-labelledby="sidepanel-workspace-heading"
            className="max-h-56 overflow-y-auto rounded-lg bg-background py-0.5"
          >
            {workspaces.map((w) => {
              const selected = w.slug === selectedWorkspaceSlug;
              return (
                <li key={w.id}>
                  <button
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-foreground text-sm transition-colors",
                      selected
                        ? "bg-muted font-medium shadow-sm"
                        : "hover:bg-muted/80",
                    )}
                    onClick={() => {
                      void onWorkspaceSelect(w.slug);
                      setPopoverOpen(false);
                    }}
                    type="button"
                  >
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {selected ? (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-primary"
                      />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {workspaces.length === 0 && !workspacesLoading ? (
            <p className="px-2 py-3 text-center text-muted-foreground text-xs">
              暂无空间
            </p>
          ) : null}
        </div>
        <Separator className="bg-border/80" />
        <div className="p-1.5 pt-1">
          <Button
            className="h-9 w-full justify-start text-muted-foreground text-xs hover:text-foreground"
            onClick={() => {
              setPopoverOpen(false);
              onOpenMainSite();
            }}
            type="button"
            variant="ghost"
          >
            打开主站
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
