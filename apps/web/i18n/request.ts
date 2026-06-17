import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./service";
import { locales } from "./config";

const FALLBACK_LOCALE = "zh";

export default getRequestConfig(async () => {
  const userLocale = await getUserLocale();
  const locale = locales.includes(userLocale) ? userLocale : FALLBACK_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
