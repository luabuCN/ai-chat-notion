import selectionToolbarCss from "@/components/selection-toolbar/content-toolbar.css?inline";
import { SelectionToolbarHost } from "@/components/selection-toolbar/SelectionToolbarHost";
import { TooltipProvider } from "@repo/ui";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

export default defineContentScript({
  matches: ["<all_urls>"],
  /** manual：样式经 Vite 内联注入 Shadow，避免 dev 下 fetch `content-scripts/*.css` 失败导致无 Tailwind。 */
  cssInjectionMode: "manual",
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: "wisewrite-selection-toolbar",
      position: "overlay",
      anchor: "body",
      zIndex: 2_147_483_647,
      css: selectionToolbarCss.replaceAll(":root", ":host"),
      onMount: (uiContainer) => {
        const mount = document.createElement("div");
        uiContainer.append(mount);
        const root = createRoot(mount);
        root.render(
          <TooltipProvider>
            <SelectionToolbarHost />
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
