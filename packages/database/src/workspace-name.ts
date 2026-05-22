export function generateDefaultWorkspaceName(
  name: string | null | undefined
): string {
  const trimmed = name?.trim();
  return trimmed ? `${trimmed}的空间` : "我的空间";
}
