import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

// Server API 代理目标（rewrites 在构建时求值，Docker/GitHub Actions 构建时通过 ARG API_PROXY_URL 注入）
const API_PROXY =
  process.env.API_PROXY_URL ||
  (process.env.NODE_ENV === "production"
    ? "http://server:4000"
    : "http://localhost:4000");

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  transpilePackages: ["@repo/database","@repo/editor","@repo/ui","@repo/ai"],
  productionBrowserSourceMaps:false,
  // 低内存 VPS 构建：限制 webpack 并行度并启用内存优化
  experimental: {
    webpackMemoryOptimizations: true,
    // 独立 worker 会多占一份 Node 进程内存，低内存机器应关闭
    webpackBuildWorker: process.env.DOCKER_BUILD === "1" ? false : undefined,
    optimizePackageImports: [
      "lodash",
      "lucide-react",
      "@radix-ui/react-icons",
    ],
  },
  webpack: (config, { dev }) => {
    // Docker 构建禁用 webpack 持久缓存，减少 PackFileCacheStrategy 内存峰值
    if (process.env.DOCKER_BUILD === "1" && !dev) {
      config.cache = false;
    }
    return config;
  },
  images: {
    dangerouslyAllowSVG: true,
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
