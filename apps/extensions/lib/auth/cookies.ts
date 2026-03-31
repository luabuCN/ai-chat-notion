export async function getCookieHeaderForUrl(url: string): Promise<string> {
  const cookies = await browser.cookies.getAll({ url });
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
