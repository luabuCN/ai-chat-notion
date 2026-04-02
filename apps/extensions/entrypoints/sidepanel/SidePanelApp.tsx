import { SidePanelChat } from "@/components/sidepanel/SidePanelChat";
import { SidePanelHeaderAvatar } from "@/components/sidepanel/SidePanelHeaderAvatar";
import { useExtensionWorkspace } from "@/hooks/use-extension-workspace";
import { useMainSiteAuth } from "@/hooks/use-main-site-auth";

/**
 * 侧栏 UI：字体（Geist）在入口 main.tsx 已加载并随扩展打包；主站登录后
 * `main-site-auth-sync` 写入 storage，`useMainSiteAuth` 的 watch 会更新状态，
 * 头像与对话能力随之刷新，无需再单独「拉取字体」。
 */
export function SidePanelApp() {
  const { auth } = useMainSiteAuth();
  const workspace = useExtensionWorkspace(auth);

  return (
    <div className="relative flex h-screen min-w-[min(100vw,360px)] flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-2 border-border border-b px-3 py-2.5">
        <span className="min-w-0 truncate font-medium text-foreground text-sm">
          知作 · AI 对话
        </span>
        <SidePanelHeaderAvatar
          auth={auth}
          onWorkspacesMenuOpen={() => void workspace.refreshWorkspaces()}
          onWorkspaceSelect={(slug) => void workspace.setSelectedSlug(slug)}
          selectedWorkspaceSlug={workspace.selectedSlug}
          workspaces={workspace.workspaces}
          workspacesLoading={workspace.loading}
        />
      </header>

      <SidePanelChat
        auth={auth}
        workspaceLoading={workspace.loading}
        workspaceSlug={workspace.selectedSlug}
      />
    </div>
  );
}
