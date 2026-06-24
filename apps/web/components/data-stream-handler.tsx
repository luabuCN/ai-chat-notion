"use client";

import { useEffect, useRef } from "react";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import { artifactDefinitions } from "./artifact";
import type { ArtifactKind } from "./artifact";
import { useDataStream } from "./data-stream-provider";

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();

  const { artifact, setArtifact, setMetadata } = useArtifact();
  const artifactKindRef = useRef<ArtifactKind>(artifact.kind);

  useEffect(() => {
    artifactKindRef.current = artifact.kind;
  }, [artifact.kind]);

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice();
    setDataStream([]);

    let currentKind = artifactKindRef.current;

    for (const delta of newDeltas) {
      if (delta.type === "data-kind") {
        currentKind = delta.data;
      }

      const artifactDefinition = artifactDefinitions.find(
        (currentArtifactDefinition) =>
          currentArtifactDefinition.kind === currentKind
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: "streaming" };
        }

        switch (delta.type) {
          case "data-id":
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: "streaming",
            };

          case "data-title":
            return {
              ...draftArtifact,
              title: delta.data,
              status: "streaming",
            };

          case "data-kind":
            return {
              ...draftArtifact,
              kind: delta.data,
              status: "streaming",
            };

          case "data-clear":
            return {
              ...draftArtifact,
              content: "",
              status: "streaming",
            };

          case "data-finish":
            return {
              ...draftArtifact,
              status: "idle",
            };

          default:
            return draftArtifact;
        }
      });
    }
  }, [dataStream, setArtifact, setMetadata]);

  return null;
}
