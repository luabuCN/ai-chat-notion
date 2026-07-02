/** DiceBear HTTP API — https://www.dicebear.com/ */
export const DICEBEAR_API_VERSION = "10.x";

/** Notion 风格头像，与产品定位一致 */
export const DICEBEAR_AVATAR_STYLE = "notionists";

export function getDicebearAvatarSeed(options: {
  name?: string | null;
  email?: string | null;
  id?: string | null;
}): string {
  const name = options.name?.trim();
  if (name) {
    return name;
  }

  const email = options.email?.trim();
  if (email) {
    return email;
  }

  if (options.id) {
    return options.id;
  }

  return "anonymous";
}

/** 根据 seed（通常为用户名）生成确定性 DiceBear 头像 URL */
export function generateDicebearAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/${DICEBEAR_API_VERSION}/${DICEBEAR_AVATAR_STYLE}/svg?seed=${encodeURIComponent(seed)}`;
}

export function resolveUserAvatarUrl(options: {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  id?: string | null;
}): string {
  const seed = getDicebearAvatarSeed(options);

  if (!options.avatarUrl) {
    return generateDicebearAvatarUrl(seed);
  }

  // 旧版 9.x avataaars 等样式在展示时升级到新风格
  if (options.avatarUrl.includes("api.dicebear.com/9.x/")) {
    return generateDicebearAvatarUrl(seed);
  }

  return options.avatarUrl;
}
