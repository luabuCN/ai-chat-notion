import { toast } from "sonner";
import { CodeEditor } from "@/components/code-editor";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/icons";
import { generateUUID } from "@/lib/utils";

type Metadata = {
  outputs: ConsoleOutput[];
};

function formatConsoleArg(arg: unknown): string {
  if (arg === null) {
    return "null";
  }
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function captureConsoleOutput(outputContent: ConsoleOutputContent[]) {
  const createHandler =
    (prefix?: string) =>
    (...args: unknown[]) => {
      const message = args.map(formatConsoleArg).join(" ");
      outputContent.push({
        type: "text",
        value: prefix ? `${prefix}${message}` : message,
      });
    };

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = createHandler();
  console.error = createHandler("Error: ");
  console.warn = createHandler("Warning: ");

  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
}

export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",
  description:
    "Useful for code generation; Code execution is available for JavaScript code.",
  initialize: ({ setMetadata }) => {
    setMetadata({
      outputs: [],
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-codeDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible:
          draftArtifact.status === "streaming" &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: "streaming",
      }));
    }
  },
  content: ({ metadata, setMetadata, ...props }) => {
    return (
      <>
        <div className="px-1">
          <CodeEditor {...props} language="javascript" />
        </div>

        {metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: "Run",
      description: "Execute JavaScript code",
      onClick: async ({ content, setMetadata }) => {
        const runId = generateUUID();
        const outputContent: ConsoleOutputContent[] = [];

        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs,
            {
              id: runId,
              contents: [],
              status: "in_progress",
            },
          ],
        }));

        try {
          const restoreConsole = captureConsoleOutput(outputContent);

          try {
            const result = eval(content);

            if (result !== undefined && outputContent.length === 0) {
              outputContent.push({
                type: "text",
                value: formatConsoleArg(result),
              });
            }

            setMetadata((metadata) => ({
              ...metadata,
              outputs: [
                ...metadata.outputs.filter((output) => output.id !== runId),
                {
                  id: runId,
                  contents:
                    outputContent.length > 0
                      ? outputContent
                      : [
                          {
                            type: "text",
                            value: "Code executed successfully (no output)",
                          },
                        ],
                  status: "completed",
                },
              ],
            }));
          } finally {
            restoreConsole();
          }
        } catch (error: any) {
          setMetadata((metadata) => ({
            ...metadata,
            outputs: [
              ...metadata.outputs.filter((output) => output.id !== runId),
              {
                id: runId,
                contents: [{ type: "text", value: error.message }],
                status: "failed",
              },
            ],
          }));
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: "Add comments",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add comments to the code snippet for understanding",
            },
          ],
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: "Add logs",
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add logs to the code snippet for debugging",
            },
          ],
        });
      },
    },
  ],
});
