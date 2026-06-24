export type ImportFileKind = "pdf" | "docx" | "markdown";

export type ImportPolishMode = "auto" | "always" | "never";

export type ImportContentFormat = "markdown" | "html";

export type ImportedAsset = {
  name: string;
  contentType: string;
  url: string;
};

export type ImportedDocument = {
  kind: ImportFileKind;
  title: string;
  contentFormat: ImportContentFormat;
  markdown: string;
  rawMarkdown?: string;
  html?: string;
  assets?: ImportedAsset[];
  warnings: string[];
  stats?: {
    pageCount?: number;
    imageCount?: number;
    wordCount?: number;
  };
};
