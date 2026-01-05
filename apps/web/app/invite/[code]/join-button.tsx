"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { useRouter } from "next/navigation";

export function JoinButton({ code }: { code: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/invite/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        const workspace = await res.json();
        router.push(`/${workspace.slug}/chat`);
        router.refresh();
      } else {
        console.error("Failed to join workspace");
      }
    } catch (error) {
      console.error("Failed to join workspace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleJoin} disabled={isLoading} size="lg">
      {isLoading ? "加入中..." : "加入工作区"}
    </Button>
  );
}
