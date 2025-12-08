import { Toaster } from "sonner";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorClient } from "@/components/editor/editor-client";
import { getUserLocale } from "@/i18n/service";

export default async function Page() {
  const locale = await getUserLocale();

  return (
    <div className="relative h-screen flex-1 flex flex-col bg-background">
      <EditorHeader locale={locale} />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto h-full">
          <EditorClient locale={locale} apiUrl="/api/blocknote-ai" />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
