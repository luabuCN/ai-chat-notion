export function getDocumentEditorPath(
  document: { id: string; kind?: string | null },
  workspaceSlug?: string
): string {
  const segment = document.kind === "whiteboard" ? "whiteboard" : "editor";
  if (workspaceSlug) {
    return `/${workspaceSlug}/${segment}/${document.id}`;
  }
  return `/${segment}/${document.id}`;
}
