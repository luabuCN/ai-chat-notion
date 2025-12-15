"use client";

import { marked } from "marked";
import { defaultMarkdownSerializer } from "prosemirror-markdown";
import { DOMParser, type Node } from "prosemirror-model";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import { documentSchema } from "./schema";
import { createSuggestionWidget, type UISuggestion } from "./suggestions";

// Configure marked for synchronous parsing
marked.use({
  async: false,
  gfm: true,
  breaks: true,
});

export const buildDocumentFromContent = (content: string) => {
  console.log("=== buildDocumentFromContent called ===");
  console.log("Input content (first 200 chars):", content?.substring(0, 200));

  // Check if we're in a browser environment
  if (typeof window === "undefined" || typeof document === "undefined") {
    console.warn("buildDocumentFromContent called in non-browser environment");
    return documentSchema.nodeFromJSON({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  }

  if (!content || content.trim() === "") {
    console.log("Empty content, returning empty doc");
    return documentSchema.nodeFromJSON({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  }

  // Use marked to render markdown to HTML
  try {
    const parser = DOMParser.fromSchema(documentSchema);

    // Remove escape characters that may have been added during storage/transmission
    // This handles cases like \# -> #, \* -> *, \` -> `, etc.
    const unescapedContent = content
      .replace(/\\#/g, "#")
      .replace(/\\\*/g, "*")
      .replace(/\\`/g, "`")
      .replace(/\\_/g, "_")
      .replace(/\\>/g, ">")
      .replace(/\\-/g, "-")
      .replace(/\\\[/g, "[")
      .replace(/\\\]/g, "]")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\|/g, "|")
      .replace(/\\\\/g, "\\");
    const html = marked.parse(unescapedContent, { async: false }) as string;

    if (!html || typeof html !== "string") {
      console.error("marked.parse did not return a string:", html);
      throw new Error("Invalid HTML output from marked");
    }

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = html;
    const doc = parser.parse(tempContainer);
    return doc;
  } catch (error) {
    console.error("HTML parsing failed:", error);
  }
  return documentSchema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: content }],
      },
    ],
  });
};

export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: UISuggestion[],
  view: EditorView
) => {
  const decorations: Decoration[] = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        }
      )
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (currentView) => {
          const { dom } = createSuggestionWidget(suggestion, currentView);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: "widget",
        }
      )
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};
