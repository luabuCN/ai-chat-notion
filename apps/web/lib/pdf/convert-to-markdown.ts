import type { PageContent, PageElement, TextElement, ImageElement } from "./types";

const ROW_Y_THRESHOLD = 8;
const TABLE_GAP_THRESHOLD = 15;
const HEADING_SIZE_RATIO = 1.3;
const H1_SIZE_RATIO = 1.6;

function groupElementsIntoRows(elements: PageElement[]): PageElement[][] {
  const rows: PageElement[][] = [];
  let currentRow: PageElement[] = [];
  let lastY = -1;

  for (const el of elements) {
    if (lastY !== -1 && Math.abs(el.y - lastY) > ROW_Y_THRESHOLD) {
      rows.push(currentRow);
      currentRow = [];
    }
    currentRow.push(el);
    lastY = el.y;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows;
}

function isTableRow(textParts: TextElement[]): boolean {
  if (textParts.length < 2) return false;
  for (let k = 1; k < textParts.length; k++) {
    const gap = textParts[k].x - (textParts[k - 1].x + textParts[k - 1].width);
    if (gap > TABLE_GAP_THRESHOLD) return true;
  }
  return false;
}

function renderTableRows(tableRows: PageElement[][]): string {
  if (tableRows.length < 2) {
    return tableRows
      .map((row) =>
        row
          .map((e) =>
            e.type === "image" ? `\n![${e.name}](${e.url})\n` : e.content
          )
          .join(" ")
      )
      .join("\n");
  }

  const maxCols = Math.max(...tableRows.map((r) => r.length));
  let out = "\n";
  tableRows.forEach((row, idx) => {
    const cells = row
      .map((e) => (e.type === "text" ? e.content.trim() : ""))
      .join(" | ");
    out += `| ${cells} |\n`;
    if (idx === 0) {
      out += `| ${Array(maxCols).fill("---").join(" | ")} |\n`;
    }
  });
  return `${out}\n`;
}

function renderTextRow(
  rowText: string,
  firstEl: TextElement,
  avgSize: number
): string {
  if (firstEl.fontSize > avgSize * HEADING_SIZE_RATIO && firstEl.isBold) {
    const prefix = firstEl.fontSize > avgSize * H1_SIZE_RATIO ? "# " : "## ";
    return `\n${prefix}${rowText}\n\n`;
  }
  if (/^[•·\-*]/.test(rowText) || /^\d+[.)]/u.test(rowText)) {
    return `- ${rowText.replace(/^[•·\-*]\s*/, "")}\n`;
  }
  return `${rowText}\n`;
}

export function convertToMarkdown(pageContents: PageContent[]): string {
  let md = "";

  for (const page of pageContents) {
    const { elements } = page;
    const textElements = elements.filter((e): e is TextElement => e.type === "text");
    const avgSize =
      textElements.length > 0
        ? textElements.reduce((s, e) => s + e.fontSize, 0) / textElements.length
        : 12;

    const rows = groupElementsIntoRows(elements);

    let inTable = false;
    let tableRows: PageElement[][] = [];

    const flushTable = () => {
      md += renderTableRows(tableRows);
      tableRows = [];
      inTable = false;
    };

    for (const row of rows) {
      const textParts = row.filter((e): e is TextElement => e.type === "text");
      const imageParts = row.filter((e): e is ImageElement => e.type === "image");
      const rowText = textParts.map((e) => e.content).join("").trim();

      if (isTableRow(textParts)) {
        inTable = true;
        tableRows.push(textParts);
        continue;
      }

      if (inTable) flushTable();

      for (const img of imageParts) {
        md += `\n![${img.name}](${img.url})\n\n`;
      }

      if (rowText && textParts[0]) {
        md += renderTextRow(rowText, textParts[0], avgSize);
      }
    }

    if (inTable) flushTable();
  }

  return md
    .replace(/([^\n])\n([^\n|#\-![])/g, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
