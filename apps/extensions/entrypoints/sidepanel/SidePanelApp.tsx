import { useState } from "react";

export function SidePanelApp() {
  return (
    <div className="flex h-screen min-w-[min(100vw,360px)] flex-col ">
      <header className="flex shrink-0 items-center justify-between gap-2 border-gray-200 border-b  px-3 py-2.5 backdrop-blur">
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
