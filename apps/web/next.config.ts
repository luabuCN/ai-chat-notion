import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { resolveServerProxyOrigin } from "./lib/server-proxy-origin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const WEB_URL = process.env.WEB_URL?.replace(/\/$/, "") ?? "";
const API_URL = process.env.API_URL?.replace(/\/$/, "") ?? "";

// rewrites 在 build 时求值，生产环境需设置 API_URL
const API_PROXY = resolveServerProxyOrigin();

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    // Next.js 16.2+ 默认已开启
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
  },
  env: {
    NEXT_PUBLIC_WEB_URL: WEB_URL,
    NEXT_PUBLIC_API_URL: API_URL,
  },
  reactStrictMode: false,
  reactCompiler: true,
  transpilePackages: ["@repo/database", "@repo/editor", "@repo/ui", "@repo/ai"],
  productionBrowserSourceMaps: false,
  images: {
    dangerouslyAllowSVG: true,
    qualities: [100, 75],
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "utfs.io",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
  async rewrites() {
    const server = API_PROXY;
    const apiPrefixes = [
      "/api/ai",
      "/api/chat",
      "/api/collab",
      "/api/history",
      "/api/token-usage",
      "/api/models",
      "/api/workspaces",
      "/api/editor-documents",
      "/api/document",
      "/api/documents",
      "/api/vote",
      "/api/suggestions",
      "/api/invite",
      "/api/users",
      "/api/uploadthing",
      "/api/files",
      "/api/pdf",
      "/api/document-import",
      "/api/web-scrape",
      "/api/jobs",
      "/api/image",
      "/api/unsplash",
      "/api/notifications",
    ];

    // :path* 不匹配无后缀路径（如 /api/workspaces），需同时注册精确路径
    const apiRewrites = apiPrefixes.flatMap((prefix) => [
      { source: prefix, destination: `${server}${prefix}` },
      {
        source: `${prefix}/:path*`,
        destination: `${server}${prefix}/:path*`,
      },
    ]);

    return [
      { source: "/ping", destination: `${server}/ping` },
      ...apiRewrites,
    ];
  },
};

export default withNextIntl(nextConfig);
