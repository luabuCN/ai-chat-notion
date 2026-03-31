import { openMainSiteLogin } from "@/lib/auth/client";
import { useMainSiteAuth } from "@/hooks/use-main-site-auth";

export function SidePanelApp() {
  const { auth, refresh } = useMainSiteAuth();

  return (
    <div className="flex h-screen min-w-[min(100vw,360px)] flex-col bg-white text-gray-900">
      <header className="flex shrink-0 items-center justify-between gap-2 border-gray-200 border-b px-3 py-2.5 backdrop-blur">
        <span className="truncate font-medium text-sm">
          知作-你的Ai文档助手
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="固定"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-500 hover:text-zinc-100"
            type="button"
          >
            <PinIcon />
          </button>
          <button
            aria-label="菜单"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-500 hover:text-zinc-100"
            type="button"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      <section
        aria-label="登录状态"
        className="border-gray-200 border-b px-3 py-2.5"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {auth.loading ? (
              <span className="text-xs text-gray-500">正在同步主站登录状态…</span>
            ) : auth.data?.authenticated ? (
              <span className="text-xs text-emerald-600">
                已登录
                {auth.data.user?.email
                  ? ` · ${auth.data.user.email}`
                  : auth.data.user?.name
                    ? ` · ${auth.data.user.name}`
                    : ""}
              </span>
            ) : (
              <span className="text-xs text-amber-600">未检测到主站登录会话</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white text-xs transition-colors hover:bg-violet-500"
              onClick={() => void openMainSiteLogin()}
              type="button"
            >
              前往主站登录
            </button>
            <button
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-800 text-xs transition-colors hover:bg-gray-50"
              onClick={() => void refresh()}
              type="button"
            >
              刷新状态
            </button>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            有主站标签时从页面读取会话；关闭主站后仍使用扩展里上次同步的会话
            （约 7 天内有效）。「刷新状态」在无主站标签时不会误清已登录缓存。
          </p>
        </div>
      </section>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>固定</title>
      <path
        d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.76Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <title>菜单</title>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}
