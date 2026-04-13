/** 将 Blob 转为 data URL（浏览器端通用） */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("读取失败"));
    };
    reader.onerror = () => reject(new Error("读取失败"));
    reader.readAsDataURL(blob);
  });
}
