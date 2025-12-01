import LocaleSwitcher from "@/components/LocaleSwitcher";
import { getUserLocale } from "@/i18n/service";

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getUserLocale();
  return (
    <>
      <LocaleSwitcher defaultValue={locale} />
      {children}
    </>
  );
}
