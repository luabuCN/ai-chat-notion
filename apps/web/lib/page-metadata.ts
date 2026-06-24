import type { Metadata } from "next";

export const DEFAULT_FAVICON = "/favicon.ico";
export const DEFAULT_PAGE_TITLE = "知作";
export const EDITOR_PAGE_PATH_RE = /\/editor\/[^/]+$/;

export function isEditorPagePath(pathname: string): boolean {
  return EDITOR_PAGE_PATH_RE.test(pathname);
}

export function emojiToFaviconUrl(emoji: string): string {
  return `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;
}

export function getFaviconUrl(icon: string | null | undefined): string {
  return icon ? emojiToFaviconUrl(icon) : DEFAULT_FAVICON;
}

export function setFavicon(url: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const link: HTMLLinkElement | null =
    window.document.querySelector("link[rel*='icon']");
  if (link) {
    link.href = url;
    return;
  }

  const newLink = window.document.createElement("link");
  newLink.rel = "shortcut icon";
  newLink.href = url;
  window.document.getElementsByTagName("head")[0].appendChild(newLink);
}

export function resetFavicon(): void {
  setFavicon(DEFAULT_FAVICON);
}

export function setPageTitle(title: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.document.title = title;
}

export function resetPageTitle(): void {
  setPageTitle(DEFAULT_PAGE_TITLE);
}

export function buildDocumentPageMetadata(
  document: { title: string | null; icon: string | null } | null
): Metadata {
  const titleText = document?.title?.trim() || "未命名";

  return {
    title: `${titleText} - 知作`,
    icons: document?.icon
      ? [{ url: emojiToFaviconUrl(document.icon) }]
      : [{ url: DEFAULT_FAVICON }],
  };
}
