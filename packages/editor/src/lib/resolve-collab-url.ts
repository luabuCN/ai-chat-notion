/**
 * 协同 WebSocket 地址解析。
 *
 * `resolveCollabWsUrl` 的实现仍保留在 `server-ws-origin.ts` 中
 * （`@repo/editor/server-ws-origin` 子路径导出仍由该文件提供，
 *  apps/web 等消费者依赖此子路径，不可破坏）。
 *
 * 此文件仅作内部转发入口，便于 unified-editor 及其拆分后的
 * hooks 从语义化路径导入协同地址解析逻辑。
 */
export { resolveCollabWsUrl } from "./server-ws-origin";
