export async function dataUrlToFile(
  dataUrl: string,
  name: string,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  // 确保文件扩展名是 PNG
  const pngName = name.replace(/\.[^.]+$/, ".png");

  // 确保 MIME 类型是 image/png
  return new File([blob], pngName, { type: "image/png" });
}
