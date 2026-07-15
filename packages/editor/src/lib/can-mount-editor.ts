/**
 * 判断带 Collaboration / UniqueID 的 TipTap 编辑器是否可以安全挂载。
 *
 * 在空 Y.Doc 上挂载会使 schema / UniqueID 写入默认空段落，随后与
 * IndexedDB / WebSocket 同步内容 CRDT 合并，导致每次加载头部多出空行。
 * 官方建议：先等协同 provider sync，再挂载编辑器。
 *
 * @see https://tiptap.dev/docs/editor/extensions/functionality/uniqueid
 */
export function canMountEditor(params: {
  isRestored: boolean;
  hasCollabConfig: boolean;
  isWebSocketSynced: boolean;
  httpYjsStateApplied: boolean;
  ydocFragmentLength: number;
}): boolean {
  if (!params.isRestored) {
    return false;
  }

  if (!params.hasCollabConfig) {
    return true;
  }

  return (
    params.isWebSocketSynced ||
    params.httpYjsStateApplied ||
    params.ydocFragmentLength > 0
  );
}
