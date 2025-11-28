export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-full w-full">
      <div className="flex w-[150px] h-full">123</div>
      <div className="flex flex-col flex-1">{children}</div>
    </main>
  );
}
