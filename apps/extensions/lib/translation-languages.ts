/** 点击翻译图标（未展开语言菜单）时的默认目标语言 */
export const DEFAULT_TRANSLATION_LANGUAGE_ID = "en";

export type TranslationLanguage = {
  id: string;
  /** 中文展示名 */
  labelZh: string;
  /** 目标语原生名称 */
  nativeName: string;
};

/** 划词翻译目标语言（与常见翻译产品顺序接近，可滚动） */
export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { id: "zh-CN", labelZh: "中文（简体）", nativeName: "简体中文" },
  { id: "zh-TW", labelZh: "中文（繁體）", nativeName: "繁體中文" },
  { id: "en", labelZh: "英语", nativeName: "English" },
  { id: "es", labelZh: "西班牙语", nativeName: "Español" },
  { id: "es-419", labelZh: "西班牙语（拉丁美洲）", nativeName: "Español (Latinoamérica)" },
  { id: "ru", labelZh: "俄语", nativeName: "Русский" },
  { id: "pt-BR", labelZh: "葡萄牙语（巴西）", nativeName: "Português (Brasil)" },
  { id: "pt-PT", labelZh: "葡萄牙语（葡萄牙）", nativeName: "Português (Portugal)" },
  { id: "id", labelZh: "印度尼西亚语", nativeName: "Bahasa Indonesia" },
  { id: "cs", labelZh: "捷克语", nativeName: "Čeština" },
  { id: "de", labelZh: "德语", nativeName: "Deutsch" },
  { id: "fr", labelZh: "法语", nativeName: "Français" },
  { id: "it", labelZh: "意大利语", nativeName: "Italiano" },
  { id: "nl", labelZh: "荷兰语", nativeName: "Nederlands" },
  { id: "pl", labelZh: "波兰语", nativeName: "Polski" },
  { id: "tr", labelZh: "土耳其语", nativeName: "Türkçe" },
  { id: "vi", labelZh: "越南语", nativeName: "Tiếng Việt" },
  { id: "th", labelZh: "泰语", nativeName: "ไทย" },
  { id: "ja", labelZh: "日语", nativeName: "日本語" },
  { id: "ko", labelZh: "韩语", nativeName: "한국어" },
  { id: "ar", labelZh: "阿拉伯语", nativeName: "العربية" },
  { id: "hi", labelZh: "印地语", nativeName: "हिन्दी" },
  { id: "uk", labelZh: "乌克兰语", nativeName: "Українська" },
] as const;

export function getTranslationLanguageById(
  id: string,
): TranslationLanguage | undefined {
  for (const lang of TRANSLATION_LANGUAGES) {
    if (lang.id === id) {
      return lang;
    }
  }
  return undefined;
}
