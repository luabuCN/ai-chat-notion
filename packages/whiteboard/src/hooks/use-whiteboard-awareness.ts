import { useEffect, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import type { WhiteboardAwarenessState } from "../types";

export type RemoteWhiteboardPointer = {
  clientId: number;
  x: number;
  y: number;
  color: string;
  username: string;
};

export function useWhiteboardAwareness(
  awareness: Awareness | null,
  scope: string
): RemoteWhiteboardPointer[] {
  const [pointers, setPointers] = useState<RemoteWhiteboardPointer[]>([]);

  useEffect(() => {
    if (!awareness) {
      setPointers([]);
      return;
    }

    const refresh = () => {
      const next: RemoteWhiteboardPointer[] = [];
      awareness.getStates().forEach((state: Record<string, unknown>, clientId: number) => {
        if (clientId === awareness.clientID) {
          return;
        }
        const wb = state.whiteboard as WhiteboardAwarenessState | undefined;
        if (!wb || wb.scope !== scope || !wb.pointer) {
          return;
        }
        next.push({
          clientId,
          x: wb.pointer.x,
          y: wb.pointer.y,
          color: wb.color ?? "#6366f1",
          username: wb.username ?? "协作者",
        });
      });
      setPointers(next);
    };

    refresh();
    awareness.on("change", refresh);
    return () => {
      awareness.off("change", refresh);
    };
  }, [awareness, scope]);

  return pointers;
}
