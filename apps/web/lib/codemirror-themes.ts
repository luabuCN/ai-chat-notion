import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const lightTheme = EditorView.theme(
  {
    "&": {
      color: "rgba(0, 0, 0, 0.9)",
      backgroundColor: "#ffffff",
    },
    ".cm-content": {
      caretColor: "rgba(0, 0, 0, 0.9)",
      fontFamily:
        'var(--font-notion-mono), "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      lineHeight: "1.6",
    },
    ".cm-gutters": {
      backgroundColor: "#fafafa",
      color: "#a1a1aa",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#f4f4f5",
    },
    ".cm-activeLine": {
      backgroundColor: "#f4f4f5",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "rgba(0, 0, 0, 0.9)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(9, 127, 232, 0.2)",
      },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 0.75rem 0 0.5rem",
      minWidth: "2.5rem",
    },
  },
  { dark: false }
);

const lightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#cf222e", fontWeight: "600" },
  {
    tag: [t.name, t.deleted, t.character, t.macroName],
    color: "rgba(0, 0, 0, 0.9)",
  },
  { tag: [t.propertyName], color: "#0550ae" },
  { tag: [t.function(t.variableName), t.labelName], color: "#8250df" },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: "#0550ae",
  },
  { tag: [t.definition(t.name), t.separator], color: "rgba(0, 0, 0, 0.9)" },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: "#0550ae",
  },
  {
    tag: [
      t.operator,
      t.operatorKeyword,
      t.url,
      t.escape,
      t.regexp,
      t.link,
      t.special(t.string),
    ],
    color: "#cf222e",
  },
  { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
  { tag: t.meta, color: "#6e7781" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#0550ae", textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: "#cf222e" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#0550ae" },
  { tag: t.invalid, color: "#ff6b6b" },
  { tag: t.string, color: "#0a3069" },
]);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#191817",
    },
    ".cm-content": {
      fontFamily:
        'var(--font-notion-mono), "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
      lineHeight: "1.6",
    },
    ".cm-gutters": {
      backgroundColor: "#232220",
      color: "#71717a",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#2a2927",
    },
    ".cm-activeLine": {
      backgroundColor: "#2a2927",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(98, 174, 240, 0.25)",
      },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 0.75rem 0 0.5rem",
      minWidth: "2.5rem",
    },
  },
  { dark: true }
);

export function getCodeMirrorTheme(isDark: boolean) {
  if (isDark) {
    return [darkTheme, oneDark];
  }

  return [lightTheme, syntaxHighlighting(lightHighlightStyle)];
}
