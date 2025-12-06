"use client";

import { useTransition } from "react";

import { setUserLocale } from "@/i18n/service";
import { defaultLocale } from "@/i18n/config";

export default function LocaleSwitcher({ defaultValue = defaultLocale }) {
  const [isPending, startTransition] = useTransition();
  function onChange(locale: any) {
    startTransition(() => {
      setUserLocale(locale);
    });
  }

  return (
    <select
      className="bg-transparent"
      disabled={isPending}
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    >
      <option className="bg-gray-600" value="en">
        English
      </option>
      <option className="bg-gray-600" value="zh">
        中文
      </option>
    </select>
  );
}
