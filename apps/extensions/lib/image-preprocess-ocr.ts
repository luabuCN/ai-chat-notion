/** 长边上限，避免超大图阻塞主线程 */
const MAX_SIDE_PX = 2048;

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error("无法解码图片"));
    };
    img.src = dataUrl;
  });
}

function rgbToGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  let gi = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    gray[gi] = g;
    gi += 1;
  }
  return gray;
}

function contrastStretchGray(gray: Uint8Array): void {
  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i];
    if (v < min) {
      min = v;
    }
    if (v > max) {
      max = v;
    }
  }
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(((gray[i] - min) / range) * 255);
  }
}

/** 3×3 中值滤波，边界用最近像素填充 */
function medianFilter3x3(src: Uint8Array, width: number, height: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  const win = new Uint8Array(9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = Math.min(width - 1, Math.max(0, x + dx));
          const py = Math.min(height - 1, Math.max(0, y + dy));
          win[k] = src[py * width + px];
          k += 1;
        }
      }
      win.sort((a, b) => a - b);
      dst[y * width + x] = win[4];
    }
  }
  return dst;
}

function buildHistogram256(gray: Uint8Array): number[] {
  const h = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    h[gray[i]] += 1;
  }
  return h;
}

/** Otsu 全局阈值 */
function otsuThreshold(histogram: number[], total: number): number {
  let sumAll = 0;
  for (let t = 0; t < 256; t++) {
    sumAll += t * histogram[t];
  }
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) {
      continue;
    }
    const wF = total - wB;
    if (wF === 0) {
      break;
    }
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

function binarizeToImageData(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4);
  let j = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = gray[i] > threshold ? 255 : 0;
    rgba[j] = v;
    rgba[j + 1] = v;
    rgba[j + 2] = v;
    rgba[j + 3] = 255;
    j += 4;
  }
  return new ImageData(rgba, width, height);
}

/**
 * 浏览器端 Canvas 预处理：缩放 → 灰度 → 对比度拉伸 → 中值去噪 → Otsu 二值化。
 * 输出白底黑字，利于 Tesseract。
 */
export function preprocessImageElementForOcr(img: HTMLImageElement): HTMLCanvasElement {
  let nw = img.naturalWidth;
  let nh = img.naturalHeight;
  if (nw === 0 || nh === 0) {
    nw = img.width;
    nh = img.height;
  }
  if (nw === 0 || nh === 0) {
    throw new Error("图片尺寸无效");
  }

  let scale = 1;
  const maxDim = Math.max(nw, nh);
  if (maxDim > MAX_SIDE_PX) {
    scale = MAX_SIDE_PX / maxDim;
  }
  const cw = Math.max(1, Math.round(nw * scale));
  const ch = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("无法创建画布上下文");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cw, ch);

  const imageData = ctx.getImageData(0, 0, cw, ch);
  const gray = rgbToGrayscale(imageData);
  contrastStretchGray(gray);
  const filtered = medianFilter3x3(gray, cw, ch);
  const histogram = buildHistogram256(filtered);
  const t = otsuThreshold(histogram, cw * ch);
  const binary = binarizeToImageData(filtered, cw, ch, t);
  ctx.putImageData(binary, 0, 0);
  return canvas;
}

export async function preprocessDataUrlForOcr(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await loadImageFromDataUrl(dataUrl);
  return preprocessImageElementForOcr(img);
}
