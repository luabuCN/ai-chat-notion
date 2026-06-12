import { type Dispatch, memo, type SetStateAction, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { artifactDefinitions, type UIArtifact } from "./artifact";
import type { ArtifactActionContext } from "./create-artifact";
import { Button } from "@repo/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { DocumentSelectorDialog } from "./editor/document-selector-dialog";
import { useGenerateTiptapDocument } from "@/hooks/use-generate-tiptap-document";

type ArtifactActionsProps = {
  artifact: UIArtifact;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: "edit" | "diff";
  metadata: any;
  setMetadata: Dispatch<SetStateAction<any>>;
};

function PureArtifactActions({
  artifact,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
}: ArtifactActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {
    isDialogOpen,
    setIsDialogOpen,
    isGenerating,
    openGenerateDialog,
    handleGenerate,
  } = useGenerateTiptapDocument();

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const actionContext: ArtifactActionContext = {
    content: artifact.content,
    title: artifact.title,
    handleVersionChange,
    currentVersionIndex,
    isCurrentVersion,
    mode,
    metadata,
    setMetadata,
    openGenerateDocument:
      artifact.kind === "text" ? openGenerateDialog : undefined,
  };

  return (
    <>
    <div className="flex flex-row gap-1">
      {artifactDefinition.actions.map((action) => (
        <Tooltip key={action.description}>
          <TooltipTrigger asChild>
            <Button
              className={cn("h-fit dark:hover:bg-zinc-700", {
                "p-2": !action.label,
                "px-2 py-1.5": action.label,
              })}
              disabled={
                isLoading || artifact.status === "streaming"
                  ? true
                  : action.isDisabled
                  ? action.isDisabled(actionContext)
                  : false
              }
              onClick={async () => {
                setIsLoading(true);

                try {
                  await Promise.resolve(action.onClick(actionContext));
                } catch (_error) {
                  toast.error("Failed to execute action");
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
            >
              {action.icon}
              {action.label}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>

    {artifact.kind === "text" ? (
      <DocumentSelectorDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSelect={handleGenerate}
        isLoading={isGenerating}
        title="生成文档"
        placeholder="选择保存位置..."
      />
    ) : null}
    </>
  );
}

export const ArtifactActions = memo(
  PureArtifactActions,
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) {
      return false;
    }
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
      return false;
    }
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
      return false;
    }
    if (prevProps.artifact.content !== nextProps.artifact.content) {
      return false;
    }
    if (prevProps.artifact.title !== nextProps.artifact.title) {
      return false;
    }

    return true;
  }
);
