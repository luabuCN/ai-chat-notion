"use client";

import { Button } from "@repo/ui";
import { Languages } from "lucide-react";
import { setUserLocale } from "@/i18n/service";
import { useRouter } from "next/navigation";

interface LanguageSwitcherProps {
  currentLocale: string;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();

  const handleLanguageSwitch = async () => {
    const newLocale = currentLocale === "zh" ? "en" : "zh";
    await setUserLocale(newLocale);
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-muted-foreground gap-1"
      onClick={handleLanguageSwitch}
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs">{currentLocale === "zh" ? "中文" : "EN"}</span>
    </Button>
  );
}
