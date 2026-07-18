import { Editor } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import { DOCUMENT_TITLE_ID, MAX_CONTEXT_LENGTH } from "../../tiptap/constants";
import { ChatMessage } from "./types";

/** 协同文档 AI：始终只产出可插入正文，禁止对话腔 */
const DOCUMENT_OUTPUT_RULES = [
  "You are a document co-author inside a collaborative Notion-like editor.",
  "Your entire reply must be ready-to-insert document body (Markdown when useful).",
  "Never use level-1 headings (# or H1). The page title is already shown separately in the editor—start with paragraphs, or use ## / ### for sections when structure is needed.",
  "Never greet, never apologize, never explain your process, never ask follow-up questions, never mention that you are an AI.",
  "Never wrap the answer in quotes or code fences unless the user explicitly asks for code.",
  "Do not prefix with labels like 'Here is', '以下是', '答案：', or similar meta text.",
].join(" ");

export const PRESET_CONFIGS = {
  // without selected content
  continue_writing: {
    titleContext: true,
    contextBefore: true,
    contextAfter: false,
    contextLength: MAX_CONTEXT_LENGTH, // characters of surrounding context
    maxOutputTokens: MAX_CONTEXT_LENGTH, // tokens for AI response
    systemPrompt:
      "You excel at continuing document prose naturally and coherently. Match the existing style, tone, voice, and formatting.",
    instruction:
      "Continue the document from the given context. Output only the next paragraphs that belong in the document.",
  },
  write_outline: {
    titleContext: true,
    contextBefore: true,
    contextAfter: true,
    contextLength: MAX_CONTEXT_LENGTH,
    maxOutputTokens: MAX_CONTEXT_LENGTH,
    systemPrompt:
      "You create clear hierarchical outlines for documents. Use ## for top-level sections and ### for subsections—never # (H1).",
    instruction:
      "Write a document outline based on the provided context. Output only the outline body.",
  },
  write_summary: {
    titleContext: true,
    contextBefore: true,
    contextAfter: true,
    contextLength: MAX_CONTEXT_LENGTH,
    maxOutputTokens: 2000, // summaries are shorter than originals
    systemPrompt:
      "You write concise document summaries that keep key facts and structure without conversational filler.",
    instruction:
      "Write a summary suitable as document content. Output only the summary body.",
  },
  brainstorm: {
    titleContext: true,
    contextBefore: false,
    contextAfter: false,
    contextLength: 200, // minimal context needed
    maxOutputTokens: MAX_CONTEXT_LENGTH, // ideas can be lengthy
    systemPrompt:
      "You generate concrete writing ideas as document-ready bullet lists or short sections, not chat suggestions.",
    instruction:
      "Brainstorm related points as insertable document content (bullets or short paragraphs). Output only that content.",
  },
  // with selected content
  explain: {
    titleContext: true,
    contextBefore: true,
    contextAfter: true,
    contextLength: 500, // some context for understanding
    maxOutputTokens: MAX_CONTEXT_LENGTH, // explanations can be detailed
    systemPrompt:
      "You rewrite selected content into clearer explanatory prose for a document reader, not as a tutor chatting with the user.",
    instruction:
      "Rewrite the selection into clearer explanatory document text. Output only the rewritten body that can replace or follow the selection.",
  },
  make_longer: {
    titleContext: true,
    contextBefore: true,
    contextAfter: false,
    contextLength: 500,
    maxOutputTokens: MAX_CONTEXT_LENGTH * 2, // output will be longer than input
    systemPrompt:
      "You expand document passages with relevant detail while preserving voice and structure.",
    instruction:
      "Expand the selected content into a longer document passage. Output only the expanded body.",
  },
  make_shorter: {
    titleContext: true,
    contextBefore: true,
    contextAfter: true,
    contextLength: 500,
    maxOutputTokens: 2000, // output will be shorter than input
    systemPrompt:
      "You condense document passages while keeping the core meaning and a natural written tone.",
    instruction:
      "Condense the selected content. Output only the shortened document body.",
  },
  fix_syntax: {
    titleContext: false,
    contextBefore: true,
    contextAfter: true,
    contextLength: 200, // minimal context for grammar fixes
    maxOutputTokens: MAX_CONTEXT_LENGTH, // output similar to input length
    systemPrompt:
      "You correct grammar, spelling, and syntax while preserving meaning and document style.",
    instruction:
      "Fix grammar and syntax in the selected content. Output only the corrected document body.",
  },
  translate: {
    titleContext: false,
    contextBefore: true,
    contextAfter: true,
    contextLength: 200, // minimal context for translation
    maxOutputTokens: MAX_CONTEXT_LENGTH * 2, // translations can be longer (esp. CJK <-> Latin)
    systemPrompt:
      "You translate document text accurately while preserving tone, nuance, and formatting cues.",
    instruction:
      "Translate the selected content as specified. Output only the translated document body.",
  },
  change_tone: {
    titleContext: true,
    contextBefore: true,
    contextAfter: true,
    contextLength: MAX_CONTEXT_LENGTH,
    maxOutputTokens: MAX_CONTEXT_LENGTH, // similar length to input
    systemPrompt:
      "You adapt writing tone for documents while keeping facts and structure intact.",
    instruction:
      "Rewrite the selected content in the requested tone. Output only the rewritten document body.",
  },
} as const;

export type PresetType = keyof typeof PRESET_CONFIGS;

export function getStreamOptions(preset?: PresetType) {
  return {
    temperature: 0.7,
    max_tokens: preset
      ? PRESET_CONFIGS[preset].maxOutputTokens
      : MAX_CONTEXT_LENGTH,
  };
}

export function getEditorSelectedContent(
  editor: Editor | null,
  selection?: Selection
) {
  if (!editor) return "";

  const currentSelection = selection ?? editor.state.selection;
  const { from, to } = currentSelection;

  return currentSelection.empty ? "" : editor.state.doc.textBetween(from, to);
}

function getBeforeContext(
  editor: Editor,
  selection: Selection,
  contextLength: number
) {
  const { from } = selection;
  return editor.state.doc.textBetween(Math.max(0, from - contextLength), from);
}

function getAfterContext(
  editor: Editor,
  selection: Selection,
  contextLength: number
) {
  const { to } = selection;
  return editor.state.doc.textBetween(
    to,
    Math.min(editor.state.doc.content.size, to + contextLength)
  );
}

export function getDocumentTitle() {
  const el = document.getElementById(DOCUMENT_TITLE_ID);
  const title =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.value
      : el?.textContent;

  return title?.trim() || null;
}

export function getDefaultSystemPrompt() {
  return `${DOCUMENT_OUTPUT_RULES} Language rules: 1) If there is selected content, write in the same language as the selection. 2) Otherwise detect language from document title, previous context, then following context (in that order). Use provided context only to stay on-topic and consistent with the document.`;
}

export function buildUserPromptMessage(
  editor: Editor,
  instruction: string
): ChatMessage[] {
  const content = getEditorSelectedContent(editor);
  const title = getDocumentTitle();

  const contextParts = [
    title ? `Document title: ${title}` : null,
    content ? `Selected content:\n${content}` : null,
  ].filter(Boolean);

  return [
    {
      role: "system",
      content: getDefaultSystemPrompt(),
    },
    ...(contextParts.length > 0
      ? [
          {
            role: "user" as const,
            content: `Document context:\n\n${contextParts.join("\n\n")}`,
          },
        ]
      : []),
    {
      role: "user",
      content: [
        "Write document content for this request.",
        "Output only the insertable body—no chat replies, no explanations, no questions.",
        `Request:\n${instruction}`,
      ].join("\n\n"),
    },
  ];
}

export function buildContinueWritingPromptMessage(editor: Editor): ChatMessage[] {
  const selection = editor.state.selection;
  const content = getEditorSelectedContent(editor);
  const title = getDocumentTitle();
  const beforeContext = getBeforeContext(editor, selection, MAX_CONTEXT_LENGTH);
  const afterContext = getAfterContext(editor, selection, MAX_CONTEXT_LENGTH / 2);

  const contextParts = [
    title ? `Document title: ${title}` : null,
    beforeContext ? `Previous context:\n${beforeContext}` : null,
    content ? `Selected content to continue from:\n${content}` : null,
    afterContext ? `Following context after the selection:\n${afterContext}` : null,
  ].filter(Boolean);

  return [
    {
      role: "system",
      content: [
        getDefaultSystemPrompt(),
        "Continue the selected text naturally in the same language, style, tone, and formatting.",
        "Write only the continuation that should be inserted after the selected text.",
        "Do not repeat the selected text.",
      ].join(" "),
    },
    ...(contextParts.length > 0
      ? [
          {
            role: "user" as const,
            content: `Document context:\n\n${contextParts.join("\n\n")}`,
          },
        ]
      : []),
    {
      role: "user",
      content:
        "Continue writing. Output only the next document body that follows the selection.",
    },
  ];
}

export function buildPresetPromptMessage(
  editor: Editor,
  preset: PresetType,
  options?: any
): ChatMessage[] {
  const config = PRESET_CONFIGS[preset];
  const content = getEditorSelectedContent(editor);
  const title = config.titleContext ? getDocumentTitle() : null;
  const contextLength =
    config.contextBefore && config.contextAfter
      ? MAX_CONTEXT_LENGTH / 2
      : MAX_CONTEXT_LENGTH;
  const beforeContext = config.contextBefore
    ? getBeforeContext(editor, editor.state.selection, contextLength)
    : null;
  const afterContext = config.contextAfter
    ? getAfterContext(editor, editor.state.selection, contextLength)
    : null;

  const contextParts = [
    title && config.titleContext ? `Document title: ${title}` : null,
    beforeContext && config.contextBefore
      ? `Previous context:\n${beforeContext}`
      : null,
    afterContext && config.contextAfter
      ? `Following context:\n${afterContext}`
      : null,
    content ? `Selected content:\n${content}` : "Selected content: (empty)",
  ].filter(Boolean);

  const allOptions = Object.entries(options ?? {}).map(
    ([key, value]) => `${key}: ${value}`
  );

  return [
    {
      role: "system",
      content: `${config.systemPrompt} ${getDefaultSystemPrompt()}`,
    },
    {
      role: "user",
      content: [
        `Document context:\n\n${contextParts.join("\n\n")}`,
        allOptions.length ? `Options:\n${allOptions.join("\n")}` : null,
        `${config.instruction}`,
        "Output only the insertable document body.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
