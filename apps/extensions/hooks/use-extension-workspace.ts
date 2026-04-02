import { useCallback, useEffect, useRef, useState } from "react";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import {
  fetchExtensionWorkspaces,
  type ExtensionWorkspace,
} from "@/lib/sidepanel-workspaces-api";
import { extensionWorkspaceSlugStorage } from "@/lib/storage/extension-workspace";

function pickWorkspaceSlug(
  list: ExtensionWorkspace[],
  current: string,
  stored: string | null | undefined,
): string {
  if (current && list.some((w) => w.slug === current)) {
    return current;
  }
  if (stored && list.some((w) => w.slug === stored)) {
    return stored;
  }
  return list[0]?.slug ?? "";
}

export function useExtensionWorkspace(auth: MainSiteAuthState) {
  const [workspaces, setWorkspaces] = useState<ExtensionWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlugState] = useState("");
  const selectedSlugRef = useRef("");

  const authenticated = auth.data?.authenticated === true;

  selectedSlugRef.current = selectedSlug;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!authenticated) {
        setWorkspaces([]);
        setSelectedSlugState("");
        return;
      }

      setLoading(true);
      try {
        const list = await fetchExtensionWorkspaces();
        if (cancelled) {
          return;
        }
        setWorkspaces(list);
        const stored = await extensionWorkspaceSlugStorage.getValue();
        const pick = pickWorkspaceSlug(list, "", stored);
        setSelectedSlugState(pick);
        if (pick) {
          await extensionWorkspaceSlugStorage.setValue(pick);
        }
      } catch {
        if (!cancelled) {
          setWorkspaces([]);
          setSelectedSlugState("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const refreshWorkspaces = useCallback(async () => {
    if (!authenticated) {
      return;
    }
    setLoading(true);
    try {
      const list = await fetchExtensionWorkspaces();
      setWorkspaces(list);
      const stored = await extensionWorkspaceSlugStorage.getValue();
      const pick = pickWorkspaceSlug(
        list,
        selectedSlugRef.current,
        stored,
      );
      setSelectedSlugState(pick);
      if (pick) {
        await extensionWorkspaceSlugStorage.setValue(pick);
      }
    } catch {
      setWorkspaces([]);
      setSelectedSlugState("");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  const setSelectedSlug = useCallback(async (slug: string) => {
    setSelectedSlugState(slug);
    await extensionWorkspaceSlugStorage.setValue(slug);
  }, []);

  return {
    workspaces,
    loading,
    selectedSlug,
    setSelectedSlug,
    refreshWorkspaces,
  };
}
