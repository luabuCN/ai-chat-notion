import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("Home");
  return <div className="h-screen w-full">{t("hellow")}</div>;
}
