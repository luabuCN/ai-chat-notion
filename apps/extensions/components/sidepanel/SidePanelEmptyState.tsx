import { Button } from "@repo/ui";
import { getSidepanelGreetingLine } from "@/components/sidepanel/side-panel-greeting";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import { openMainSiteLogin } from "@/lib/auth/client";

export function SidePanelEmptyState({ auth }: { auth: MainSiteAuthState }) {
  if (auth.loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">正在同步主站状态…</p>
      </div>
    );
  }

  const authenticated = auth.data?.authenticated === true;
  const greeting = getSidepanelGreetingLine();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-semibold text-foreground text-lg leading-snug">
        {greeting}
      </p>
      {authenticated ? (
        <p className="max-w-[20rem] text-muted-foreground text-sm">
          在下方输入消息即可开始对话
        </p>
      ) : (
        <>
          <p className="max-w-[20rem] text-amber-600 text-sm">
            当前未登录。请先在登录后使用与账号绑定的完整能力。
          </p>
          <Button
            className="shrink-0"
            onClick={() => void openMainSiteLogin()}
            type="button"
            variant="default"
          >
            前往登录
          </Button>
        </>
      )}
    </div>
  );
}
