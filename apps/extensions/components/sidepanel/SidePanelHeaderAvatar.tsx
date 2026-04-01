import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui";
import { User } from "lucide-react";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import { openMainSiteLogin } from "@/lib/auth/client";
import { WEB_ORIGIN } from "@/lib/web-config";

function initialFromUser(auth: MainSiteAuthState): string {
  const u = auth.data?.user;
  const c =
    u?.name?.trim()?.charAt(0) ||
    u?.email?.trim()?.charAt(0) ||
    "";
  return c ? c.toUpperCase() : "?";
}

export function SidePanelHeaderAvatar({ auth }: { auth: MainSiteAuthState }) {
  const authenticated = auth.data?.authenticated === true;
  const user = auth.data?.user;
  const initial = initialFromUser(auth);

  const onClick = () => {
    if (authenticated) {
      void browser.tabs.create({ url: WEB_ORIGIN });
    } else {
      void openMainSiteLogin();
    }
  };

  return (
    <button
      aria-label={authenticated ? "打开主站" : "前往主站登录"}
      className="shrink-0 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      type="button"
    >
      <Avatar className="size-8 border border-border">
        {user?.avatarUrl ? (
          <AvatarImage alt="" src={user.avatarUrl} />
        ) : null}
        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
          {auth.loading ? (
            "…"
          ) : authenticated ? (
            initial
          ) : (
            <User aria-hidden className="size-4" />
          )}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}
