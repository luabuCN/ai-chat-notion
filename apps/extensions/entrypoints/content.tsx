import selectionToolbarCss from "@/components/selection-toolbar/content-toolbar.css?inline";
import { SelectionToolbarHost } from "@/components/selection-toolbar/SelectionToolbarHost";
import { ExtensionPortalProvider } from "@/lib/extension-portal-context";
import {
  READABILITY_EXTRACT_MESSAGE,
  type ReadabilityExtractResponse,
} from "@/lib/readability-messages";
import { TooltipProvider } from "@repo/ui";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

function registerReadabilityMessageListener(): void {
  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender,
      sendResponse: (response: ReadabilityExtractResponse) => void,
    ) => {
      if (
        typeof message !== "object" ||
        message === null ||
        (message as { type?: string }).type !== READABILITY_EXTRACT_MESSAGE
      ) {
        return undefined;
      }
      void (async () => {
        try {
          const { Readability } = await import("@mozilla/readability");
          const documentClone = document.cloneNode(true);
          if (!(documentClone instanceof Document)) {
            sendResponse({ error: "无法克隆文档节点", ok: false });
            return;
          }
          const reader = new Readability(documentClone);
          const article = reader.parse();
          if (!article) {
            sendResponse({ article: null, ok: true });
            return;
          }
          sendResponse({
            article: {
              byline: article.byline ?? null,
              content: article.content ?? null,
              dir: article.dir ?? null,
              excerpt: article.excerpt ?? null,
              lang: article.lang ?? null,
              length: article.length ?? null,
              publishedTime: article.publishedTime ?? null,
              siteName: article.siteName ?? null,
              textContent: article.textContent ?? null,
              title: article.title ?? null,
            },
            ok: true,
          });
        } catch (e) {
          sendResponse({
            error: e instanceof Error ? e.message : String(e),
            ok: false,
          });
        }
      })();
      return true;
    },
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  /** manual：样式经 Vite 内联注入 Shadow，避免 dev 下 fetch `content-scripts/*.css` 失败导致无 Tailwind。 */
  cssInjectionMode: "manual",
  async main(ctx) {
    registerReadabilityMessageListener();
    const ui = await createShadowRootUi(ctx, {
      name: "wisewrite-selection-toolbar",
      position: "overlay",
      anchor: "body",
      zIndex: 2_147_483_647,
      css: selectionToolbarCss.replaceAll(":root", ":host"),
      onMount: (uiContainer) => {
        const portalHost = document.createElement("div");
        portalHost.setAttribute("data-extension-portal-host", "");
        /** 后插入 DOM，与面板同 z-index 时后绘制，避免菜单被盖住 */
        portalHost.style.position = "relative";
        portalHost.style.zIndex = "2147483647";
        const mount = document.createElement("div");
        uiContainer.append(mount);
        uiContainer.append(portalHost);
        const root = createRoot(mount);
        root.render(
          <TooltipProvider>
            <ExtensionPortalProvider container={portalHost}>
              <SelectionToolbarHost />
            </ExtensionPortalProvider>
          </TooltipProvider>
        );
        return root;
      },
      onRemove: (root: Root | undefined) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
