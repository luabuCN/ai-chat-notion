import { Editor } from "@tiptap/react";
import { Button } from "@repo/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { cn } from "../../../lib/utils";
import {
  WandSparkles,
  ChevronDown,
  HelpCircle,
  MenuSquare,
  MoreHorizontal,
  BugOff,
  Languages,
  MicVocal,
} from "lucide-react";
import { useAIPanelStore } from "../../../components/ai-panel/ai-panel-store";
import { BUBBLE_MENU_PORTAL_POPOVER_Z_CLASS } from "../bubble-menu-z";
import { useState } from "react";

interface AiSelectorProps {
  editor: Editor | null;
}

// 预设选项
const presets = [
  { id: "explain", label: "Explain", icon: HelpCircle },
  { id: "make_longer", label: "Make longer", icon: MenuSquare },
  { id: "make_shorter", label: "Make shorter", icon: MoreHorizontal },
  { id: "fix_syntax", label: "Fix syntax", icon: BugOff },
];

const languages = [
  "English",
  "Chinese",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Korean",
];
const tones = [
  "Professional",
  "Casual",
  "Straightforward",
  "Confident",
  "Friendly",
];

export const AiSelector = ({ editor }: AiSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [showTones, setShowTones] = useState(false);

  const setVisible = useAIPanelStore((state) => state.setVisible);
  const setMode = useAIPanelStore((state) => state.setMode);
  const setHasSelection = useAIPanelStore((state) => state.setHasSelection);
  const submitPresetPrompt = useAIPanelStore(
    (state) => state.submitPresetPrompt
  );

  if (!editor) return null;

  const handlePresetClick = (presetId: string, options?: any) => {
    setOpen(false);
    setShowLanguages(false);
    setShowTones(false);
    // 设置为 bubble 模式（直接执行）
    setMode("bubble");
    setHasSelection(true);
    setVisible(true);
    // 直接提交预设
    submitPresetPrompt(presetId as any, options);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          tabIndex={-1}
          className="gap-1 rounded-none text-muted-foreground hover:text-primary h-full px-3"
        >
          <WandSparkles className="w-4 h-4 text-primary" />
          <span className="text-sm">Ask AI</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[200px] p-1", BUBBLE_MENU_PORTAL_POPOVER_Z_CLASS)}
        onMouseLeave={() => {
          setShowLanguages(false);
          setShowTones(false);
        }}
      >
        {/* 预设选项 */}
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal"
            onClick={() => handlePresetClick(preset.id)}
          >
            <preset.icon className="w-4 h-4" />
            {preset.label}
          </Button>
        ))}

        {/* 翻译子菜单 */}
        <div
          className="relative"
          onMouseEnter={() => {
            setShowLanguages(true);
            setShowTones(false);
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal"
          >
            <Languages className="w-4 h-4" />
            Translate to
            <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
          </Button>
          {showLanguages && (
            <div className="absolute left-full top-0 z-10 ml-1 w-[150px] rounded-md border bg-popover p-1 shadow-md">
              {languages.map((lang) => (
                <Button
                  key={lang}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm font-normal"
                  onClick={() =>
                    handlePresetClick("translate", { language: lang })
                  }
                >
                  {lang}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* 语气子菜单 */}
        <div
          className="relative"
          onMouseEnter={() => {
            setShowTones(true);
            setShowLanguages(false);
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sm font-normal"
          >
            <MicVocal className="w-4 h-4" />
            Change tone
            <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
          </Button>
          {showTones && (
            <div className="absolute left-full top-0 z-10 ml-1 w-[150px] rounded-md border bg-popover p-1 shadow-md">
              {tones.map((tone) => (
                <Button
                  key={tone}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm font-normal"
                  onClick={() => handlePresetClick("change_tone", { tone })}
                >
                  {tone}
                </Button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
