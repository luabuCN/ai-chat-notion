import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

// Server API 代理目标（本地默认 localhost:4000；Docker 镜像内由 API_PROXY_URL=http://server:4000 覆盖）
const API_PROXY = process.env.API_PROXY_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  transpilePackages: ["@repo/database","@repo/editor","@repo/ui","@repo/ai"],
  productionBrowserSourceMaps:false,
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
    return [
      // 健康检查
      { source: "/ping", destination: `${server}/ping` },
      // 所有后端 API 代理到 server 容器
      { source: "/api/ai/:path*", destination: `${server}/api/ai/:path*` },
      { source: "/api/chat/:path*", destination: `${server}/api/chat/:path*` },
      { source: "/api/collab/:path*", destination: `${server}/api/collab/:path*` },
      { source: "/api/history/:path*", destination: `${server}/api/history/:path*` },
      { source: "/api/models/:path*", destination: `${server}/api/models/:path*` },
      { source: "/api/workspaces/:path*", destination: `${server}/api/workspaces/:path*` },
      { source: "/api/editor-documents/:path*", destination: `${server}/api/editor-documents/:path*` },
      { source: "/api/document/:path*", destination: `${server}/api/document/:path*` },
      { source: "/api/documents/:path*", destination: `${server}/api/documents/:path*` },
      { source: "/api/vote/:path*", destination: `${server}/api/vote/:path*` },
      { source: "/api/suggestions/:path*", destination: `${server}/api/suggestions/:path*` },
      { source: "/api/invite/:path*", destination: `${server}/api/invite/:path*` },
      { source: "/api/users/:path*", destination: `${server}/api/users/:path*` },
      { source: "/api/uploadthing/:path*", destination: `${server}/api/uploadthing/:path*` },
      { source: "/api/files/:path*", destination: `${server}/api/files/:path*` },
      { source: "/api/pdf/:path*", destination: `${server}/api/pdf/:path*` },
      { source: "/api/image/:path*", destination: `${server}/api/image/:path*` },
      { source: "/api/unsplash/:path*", destination: `${server}/api/unsplash/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
