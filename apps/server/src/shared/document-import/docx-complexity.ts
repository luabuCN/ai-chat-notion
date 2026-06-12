export function shouldPreferHtmlImport(
  html: string,
  imageCount: number
): boolean {
  if (imageCount > 0) {
    return true;
  }

  const tableCount = html.match(/<table\b/gi)?.length ?? 0;
  if (tableCount === 0) {
    return false;
  }

  if (/<table[\s\S]*<table/i.test(html)) {
    return true;
  }

  return /colspan|rowspan/i.test(html);
}
