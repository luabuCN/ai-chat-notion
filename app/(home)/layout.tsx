import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LocaleSwitcher />
      {children}
    </>
  );
}
