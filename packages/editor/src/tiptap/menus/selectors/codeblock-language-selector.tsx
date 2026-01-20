import { Button } from "@repo/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { CheckIcon, ChevronDownIcon, CodeIcon } from "lucide-react";
import { common } from "lowlight";
import { useMemo } from "react";

export const CodeBlockLanguageSelector = ({ editor }: { editor: Editor }) => {
  // 获取语言列表
  const languages = useMemo(() => {
    const list: string[] = [];
    for (const l in common) {
      list.push(l);
    }
    return list.sort();
  }, []);

  // 获取当前代码块的语言
  const currentLanguage = useEditorState({
    editor,
    selector: (instance) => {
      const attrs = instance.editor.getAttributes("codeBlock");
      return attrs?.language || "plaintext";
    },
  });

  const setLanguage = (language: string) => {
    editor.chain().focus().updateAttributes("codeBlock", { language }).run();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-none h-9 px-3">
          <CodeIcon className="size-3.5 me-2" />
          <span className="whitespace-nowrap text-sm me-2">
            {currentLanguage}
          </span>
          <ChevronDownIcon className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1 shadow-xl" align="start" noPortal>
        <ScrollArea className="h-64">
          {languages.map((lang) => {
            const isActive = currentLanguage === lang;
            return (
              <div
                key={lang}
                onClick={() => setLanguage(lang)}
                className="flex items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer"
              >
                <span>{lang}</span>
                <div className="flex-1"></div>
                {isActive && <CheckIcon className="size-3.5 ms-4" />}
              </div>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
