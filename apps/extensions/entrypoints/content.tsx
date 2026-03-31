import "@/components/selection-toolbar/content-toolbar.css";
import { SelectionToolbarHost } from "@/components/selection-toolbar/SelectionToolbarHost";
import { createRoot } from "react-dom/client";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const anchor = document.createElement("div");
    anchor.id = "omniside-selection-toolbar-root";
    document.body.append(anchor);
    createRoot(anchor).render(<SelectionToolbarHost />);
  },
});
