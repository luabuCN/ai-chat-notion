import { createContext, useContext, type ReactNode } from "react";

const ExtensionPortalContainerContext = createContext<HTMLElement | null>(null);

export function ExtensionPortalProvider({
  children,
  container,
}: {
  children: ReactNode;
  container: HTMLElement;
}) {
  return (
    <ExtensionPortalContainerContext.Provider value={container}>
      {children}
    </ExtensionPortalContainerContext.Provider>
  );
}

/** 供 Radix Portal 挂到 content script 的 Shadow DOM 内，避免样式丢失 */
export function useExtensionPortalContainer(): HTMLElement | null {
  return useContext(ExtensionPortalContainerContext);
}
