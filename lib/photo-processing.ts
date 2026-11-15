import { createPersonMasks, type PersonMasks } from "@/lib/person-segmentation";

export type PhotoFilterId = "original" | "y2k" | "flash" | "disposable" | "rio" | "mono";

export type PhotoProcessingOptions = {
  filterId: PhotoFilterId;
  seed: number;
  dateStamp?: boolean;
  dateStampOrientation?: "horizontal" | "vertical";
  dateStampYear?: "photo" | "2006";
  maxDimension?: number;
  maxPixels?: number;
  maxBytes?: number;
  quality?: number;
};

type DisposableVariation = { exposure: number; temperature: number };
type SceneExposure = { y2kLift: number };

export const PHOTO_FILTER_VERSION = 39;

const SEVEN_SEGMENT_DIGITS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

const clamp = (value: number) => Math.max(0, Math.min(255, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
};
const RIO_GRADIENT_STOPS: Array<[number, number, number, number]> = [
  [0, 78, 66, 146],
  [0.4, 111, 51, 132],
  [0.72, 199, 45, 122],
  [1, 243, 83, 112],
];

function rioGradientColor(position: number): [number, number, number] {
  const nextIndex = RIO_GRADIENT_STOPS.findIndex(([stop]) => stop >= position);
  const lower = RIO_GRADIENT_STOPS[Math.max(0, nextIndex - 1)];
  const upper = RIO_GRADIENT_STOPS[nextIndex < 0 ? RIO_GRADIENT_STOPS.length - 1 : nextIndex];
  const amount = upper[0] === lower[0] ? 0 : (position - lower[0]) / (upper[0] - lower[0]);
  return [
    lower[1] + (upper[1] - lower[1]) * amount,
    lower[2] + (upper[2] - lower[2]) * amount,
    lower[3] + (upper[3] - lower[3]) * amount,
  ];
}

const disposableCurve = (value: number) => {
  let result = value / 255;
  result += 0.045 * (1 - result);
  result = (result - 0.42) * 1.12 + 0.44;
  result -= smoothstep(0.68, 1, result) * Math.max(0, result - 0.68) * 0.16;
  return result * 255;
};

function randomGenerator(seed: number) {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export async function getPhotoSeed(file: File, variation = 0) {
  const hashBytes = new Uint8Array(await file.slice(0, 96 * 1024).arrayBuffer());
  const tailBytes = file.size > 96 * 1024
    ? new Uint8Array(await file.slice(Math.max(0, file.size - 96 * 1024)).arrayBuffer())
    : new Uint8Array();
  let hash = 0x811c9dc5;
  const identity = `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${variation}`;
  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193);
  }
  for (const byte of hashBytes) hash = Math.imul(hash ^ byte, 0x01000193);
  for (const byte of tailBytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return hash >>> 0 || 1;
}

function exifCaptureDate(bytes: Uint8Array) {
  const limit = Math.min(bytes.length - 18, 2_000_000);
  for (let index = 0; index < limit; index += 1) {
    if (bytes[index] !== 50 || bytes[index + 1] !== 48 || bytes[index + 2] < 48 || bytes[index + 2] > 57 || bytes[index + 3] < 48 || bytes[index + 3] > 57) continue;
    if (bytes[index + 4] !== 58 || bytes[index + 7] !== 58 || bytes[index + 10] !== 32 || bytes[index + 13] !== 58 || bytes[index + 16] !== 58) continue;
    const read = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
    const year = Number(read(index, 4));
    const month = Number(read(index + 5, 2));
    const day = Number(read(index + 8, 2));
    const hour = Number(read(index + 11, 2));
    const minute = Number(read(index + 14, 2));
    const second = Number(read(index + 17, 2));
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return date;
  }
  return null;
}

async function getCaptureDate(file: File) {
  try {
    const bytes = new Uint8Array(await file.slice(0, 2_000_000).arrayBuffer());
    const date = exifCaptureDate(bytes);
    if (date) return date;
  } catch { /* Use the file timestamp when EXIF is unavailable. */ }
  const fallback = file.lastModified ? new Date(file.lastModified) : new Date();
  return Number.isFinite(fallback.getTime()) ? fallback : new Date();
}

async function decodePhoto(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Fall through to the browser's image decoder. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That image could not be opened. Try another photo."));
      element.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function processPixelRows(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  filterId: PhotoFilterId,
  random: () => number,
  variation: DisposableVariation,
  sceneExposure: SceneExposure,
  personMasks: PersonMasks | null,
) {
  const blockRows = Math.max(24, Math.min(112, Math.floor(180_000 / width)));
  for (let startY = 0; startY < height; startY += blockRows) {
    const endY = Math.min(height, startY + blockRows);
    for (let y = startY; y < endY; y += 1) {
      const rioTint = filterId === "rio" ? rioGradientColor(height > 1 ? y / (height - 1) : 0) : null;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

        if (filterId === "disposable") {
          const normalized = luminance / 255;
          const highlight = smoothstep(0.35, 0.92, normalized);
          const shadow = 1 - smoothstep(0.08, 0.52, normalized);
          const tone = disposableCurve(luminance);
          const saturation = 1.02;
          const flashLift = (1 - smoothstep(0.06, 0.65, normalized)) * 4.5;
          const target = tone + flashLift;
          const baseRed = target + (red - luminance) * saturation;
          const baseGreen = target + (green - luminance) * saturation;
          const baseBlue = target + (blue - luminance) * saturation;
          const grainAmount = 1.8 + shadow * 1.15;
          const grain = ((random() + random() + random()) - 1.5) * 2.35 * grainAmount;
          const chromaGrain = (random() - 0.5) * 1.35;
          const redGrain = grain + chromaGrain;
          const greenGrain = grain * 0.7 - chromaGrain * 0.35;
          const blueGrain = grain * 0.82 + chromaGrain * 0.4;
          const warmHighlight = highlight * 10;
          const coolShadow = shadow * 5.5;
          data[index] = clamp(baseRed + warmHighlight - shadow * 1.2 + variation.exposure + variation.temperature + redGrain);
          data[index + 1] = clamp(baseGreen + warmHighlight * 0.36 + shadow * 1.2 + variation.exposure + greenGrain);
          data[index + 2] = clamp(baseBlue - warmHighlight * 0.68 + coolShadow + variation.exposure - variation.temperature + blueGrain);
        } else if (filterId === "flash") {
          const chromaBlue = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
          const chromaRed = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
          const skinHue = smoothstep(76, 88, chromaBlue)
            * (1 - smoothstep(123, 133, chromaBlue))
            * smoothstep(132, 143, chromaRed)
            * (1 - smoothstep(167, 180, chromaRed));
          const skinColor = smoothstep(7, 22, red - green) * smoothstep(10, 28, red - blue);
          const skin = skinHue * skinColor;
          const foreground = personMasks ? sampleSegmentation(personMasks.person, personMasks, x, y, width, height) : 1;
          const segmentedSkin = personMasks ? sampleSegmentation(personMasks.skin, personMasks, x, y, width, height) : skin;
          const flashSkin = personMasks ? Math.max(segmentedSkin, skin * foreground * 0.45) : skin;
          const contrast = (luminance - 112) * 1.28 + 112;
          const shadow = 1 - smoothstep(42, 168, luminance);
          const highlights = smoothstep(185, 245, luminance);
          // A compact-camera flash brightens skin and midtones while black fabric
          // and deep room shadows stay dense. Avoid lifting every near-black pixel.
          const flashCoverage = smoothstep(25, 78, luminance) * (1 - smoothstep(220, 248, luminance));
          const flashStrength = personMasks ? 3 + foreground * 7 + flashSkin * 3 : 6 + skin * 6;
          const frontalLift = flashCoverage * flashStrength;
          const directSubjectFlash = personMasks ? foreground * flashCoverage * (24 + flashSkin * 7) : skin * flashCoverage * 9;
          const subjectContrast = personMasks ? foreground * (luminance - 112) * 0.12 : 0;
          const roomFalloff = personMasks ? (1 - foreground) * (2 + shadow * 2) : 0;
          const target = contrast + frontalLift + subjectContrast - roomFalloff - 4;
          const shoulder = (value: number) => value <= 238 ? value : 238 + 17 * (1 - Math.exp(-(value - 238) / 17));
          const saturation = 1.26 - shadow * 0.1;
          const chromaR = (red - luminance) * saturation;
          const chromaG = (green - luminance) * saturation;
          const chromaB = (blue - luminance) * saturation;
          const grain = (random() + random() + random() - 1.5) * (4.2 + shadow * 2.8);
          const colorGrain = (random() - 0.5) * (2.7 + shadow * 1.3);
          const warmFlash = flashSkin * (1 - highlights * 0.65);
          data[index] = clamp(shoulder(target + directSubjectFlash + chromaR + warmFlash * 8 - shadow * 1.4 + grain + colorGrain));
          data[index + 1] = clamp(shoulder(target + directSubjectFlash + chromaG + warmFlash * 2.5 + grain * 0.45));
          data[index + 2] = clamp(shoulder(target + directSubjectFlash + chromaB + shadow * 4 - warmFlash * 3.5 + grain - colorGrain));
        } else if (filterId === "y2k") {
          const chromaBlue = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
          const chromaRed = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;
          const skinHue = smoothstep(76, 88, chromaBlue)
            * (1 - smoothstep(123, 133, chromaBlue))
            * smoothstep(132, 143, chromaRed)
            * (1 - smoothstep(167, 180, chromaRed));
          const skinColor = smoothstep(7, 22, red - green) * smoothstep(10, 28, red - blue);
          const skin = skinHue * skinColor;
          const contrast = (luminance - 112) * 1.23 + 109;
          const shadow = 1 - smoothstep(38, 170, luminance);
          const highlights = smoothstep(178, 240, luminance);
          const flashLift = (1 - smoothstep(42, 218, luminance)) * (5 + sceneExposure.y2kLift * 0.55);
          const shadowLift = shadow * 1.5;
          const warmSkin = skin * (1 - highlights * 0.8);
          const coolRoom = (1 - warmSkin) * (1 - highlights * 0.88);
          const skinLift = warmSkin * 5.5;
          const target = contrast + flashLift + shadowLift + skinLift;
          const shoulder = (value: number) => value <= 235 ? value : 235 + 20 * (1 - Math.exp(-(value - 235) / 20));
          const grain = (random() + random() - 1) * (3 + shadow * 1.7);
          const chromaNoise = (random() - 0.5) * (1 + shadow * 0.7);
          const warmFlash = warmSkin * 17;
          const coolTint = shadow * 10 + coolRoom * 12;
          data[index] = clamp(shoulder(target + (red - luminance) * 1.3 + shadow * 1.8 + coolRoom * 1.5 + warmFlash + grain + chromaNoise));
          data[index + 1] = clamp(shoulder(target + (green - luminance) * 1.3 - shadow * 2 - coolRoom * 1.5 + warmSkin * 3 + grain * 0.35));
          data[index + 2] = clamp(shoulder(target + (blue - luminance) * 1.3 + coolTint - warmFlash * 0.72 + grain - chromaNoise));
        } else if (filterId === "rio") {
          const rioLuma = 0.299 * red + 0.587 * green + 0.114 * blue;
          const contrast = (rioLuma - 128) * 1.27 + 128;
          const tint = rioTint!;
          const saturation = 1.12;
          const gradientMix = 0.32;
          data[index] = clamp((contrast + (red - rioLuma) * saturation) * (1 - gradientMix) + tint[0] * gradientMix);
          data[index + 1] = clamp((contrast + (green - rioLuma) * saturation) * (1 - gradientMix) + tint[1] * gradientMix);
          data[index + 2] = clamp((contrast + (blue - rioLuma) * saturation) * (1 - gradientMix) + tint[2] * gradientMix);
        } else if (filterId === "mono") {
          const gray = clamp((luminance - 128) * 1.2 + 128);
          data[index] = clamp(gray + 2);
          data[index + 1] = gray;
          data[index + 2] = clamp(gray - 2);
        }
      }
    }
    if (endY < height) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
}

function sampleSegmentation(data: Float32Array, mask: PersonMasks, x: number, y: number, width: number, height: number) {
  const maskX = Math.max(0, Math.min(mask.width - 1, ((x + 0.5) * mask.width) / width - 0.5));
  const maskY = Math.max(0, Math.min(mask.height - 1, ((y + 0.5) * mask.height) / height - 0.5));
  const x0 = Math.floor(maskX);
  const y0 = Math.floor(maskY);
  const x1 = Math.min(mask.width - 1, x0 + 1);
  const y1 = Math.min(mask.height - 1, y0 + 1);
  const fx = maskX - x0;
  const fy = maskY - y0;
  const upper = data[y0 * mask.width + x0] * (1 - fx) + data[y0 * mask.width + x1] * fx;
  const lower = data[y1 * mask.width + x0] * (1 - fx) + data[y1 * mask.width + x1] * fx;
  const probability = upper * (1 - fy) + lower * fy;
  return smoothstep(0.05, 0.95, probability);
}

async function addY2KColorFringe(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(image.data);
  const pixels = image.data;
  const maxShift = Math.min(10, Math.max(2, Math.round(Math.min(width, height) * 0.0042)));
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const halfWidth = Math.max(1, width / 2);
  const halfHeight = Math.max(1, height / 2);
  const blockRows = Math.max(24, Math.min(112, Math.floor(180_000 / width)));

  for (let startY = 0; startY < height; startY += blockRows) {
    const endY = Math.min(height, startY + blockRows);
    for (let y = startY; y < endY; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offsetX = Math.round(((x - centerX) / halfWidth) * maxShift);
        const offsetY = Math.round(((y - centerY) / halfHeight) * maxShift);
        const redX = Math.max(0, Math.min(width - 1, x - offsetX));
        const redY = Math.max(0, Math.min(height - 1, y - offsetY));
        const blueX = Math.max(0, Math.min(width - 1, x + offsetX));
        const blueY = Math.max(0, Math.min(height - 1, y + offsetY));
        const index = (y * width + x) * 4;
        pixels[index] = source[(redY * width + redX) * 4];
        pixels[index + 2] = source[(blueY * width + blueX) * 4 + 2];
      }
    }
    if (endY < height) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  context.putImageData(image, 0, 0);
}

async function addFlashEdgeFringe(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(image.data);
  const pixels = image.data;
  const blockRows = Math.max(24, Math.min(112, Math.floor(180_000 / width)));
  const lumaAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return 0.299 * source[index] + 0.587 * source[index + 1] + 0.114 * source[index + 2];
  };

  for (let startY = 0; startY < height; startY += blockRows) {
    const endY = Math.min(height, startY + blockRows);
    for (let y = startY; y < endY; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const left = lumaAt(Math.max(0, x - 1), y);
        const right = lumaAt(Math.min(width - 1, x + 1), y);
        const top = lumaAt(x, Math.max(0, y - 1));
        const bottom = lumaAt(x, Math.min(height - 1, y + 1));
        const gradientX = right - left;
        const gradientY = bottom - top;
        const edgeStrength = Math.hypot(gradientX, gradientY);
        if (edgeStrength < 22) continue;

        const mix = smoothstep(22, 82, edgeStrength) * 0.58;
        const normalX = gradientX / edgeStrength;
        const normalY = gradientY / edgeStrength;
        const redX = Math.max(0, Math.min(width - 1, Math.round(x - normalX)));
        const redY = Math.max(0, Math.min(height - 1, Math.round(y - normalY)));
        const blueX = Math.max(0, Math.min(width - 1, Math.round(x + normalX)));
        const blueY = Math.max(0, Math.min(height - 1, Math.round(y + normalY)));
        const index = (y * width + x) * 4;
        const redSample = source[(redY * width + redX) * 4];
        const blueSample = source[(blueY * width + blueX) * 4 + 2];
        pixels[index] = source[index] + (redSample - source[index]) * mix;
        pixels[index + 2] = source[index + 2] + (blueSample - source[index + 2]) * mix;
      }
    }
    if (endY < height) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  context.putImageData(image, 0, 0);
}

async function addDisposableFilmGrain(context: CanvasRenderingContext2D, width: number, height: number, random: () => number) {
  const grain = document.createElement("canvas");
  grain.width = Math.max(1, Math.round(width * 0.48));
  grain.height = Math.max(1, Math.round(height * 0.48));
  const grainContext = grain.getContext("2d");
  if (!grainContext) return;

  const image = grainContext.createImageData(grain.width, grain.height);
  for (let y = 0; y < grain.height; y += 1) {
    for (let x = 0; x < grain.width; x += 1) {
      const index = (y * grain.width + x) * 4;
      const value = clamp(128 + (random() + random() + random() - 1.5) * 76);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
    if ((y + 1) % 72 === 0 && y + 1 < grain.height) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  grainContext.putImageData(image, 0, 0);

  context.save();
  context.globalCompositeOperation = "overlay";
  context.globalAlpha = 0.2;
  context.imageSmoothingEnabled = true;
  context.drawImage(grain, 0, 0, width, height);
  context.restore();
}

function addLightLeaks(context: CanvasRenderingContext2D, width: number, height: number, random: () => number) {
  const chance = random();
  if (chance < 0.24) return;
  const count = chance > 0.84 ? 2 : 1;
  const shortSide = Math.min(width, height);
  const palette = [
    [255, 74, 27], [255, 112, 36], [255, 150, 50], [255, 186, 70], [227, 42, 23],
  ];
  context.save();
  context.globalCompositeOperation = "screen";
  for (let index = 0; index < count; index += 1) {
    const edge = Math.floor(random() * 4);
    const along = random() * 0.92 + 0.04;
    const centerX = edge === 0 ? width * (random() * 0.09 - 0.035) : edge === 1 ? width * (0.945 + random() * 0.09) : width * along;
    const centerY = edge === 2 ? height * (random() * 0.09 - 0.035) : edge === 3 ? height * (0.945 + random() * 0.09) : height * along;
    const radiusX = shortSide * (0.34 + random() * 0.34);
    const radiusY = shortSide * (0.1 + random() * 0.23);
    const angle = (random() - 0.5) * 1.2 + (edge < 2 ? Math.PI / 2 : 0);
    const color = palette[Math.floor(random() * palette.length)];
    const intensity = 0.11 + random() * 0.13;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(angle);
    context.scale(radiusX, radiusY);
    context.globalAlpha = intensity;
    const gradient = context.createRadialGradient(0, 0, 0.02, 0, 0, 1);
    gradient.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},0.88)`);
    gradient.addColorStop(0.38, `rgba(${color[0]},${color[1]},${color[2]},0.42)`);
    gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    context.fillStyle = gradient;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  }
  context.restore();
}

function addHalation(context: CanvasRenderingContext2D, width: number, height: number) {
  const scale = Math.min(1, 720 / Math.max(width, height));
  const glow = document.createElement("canvas");
  glow.width = Math.max(1, Math.round(width * scale));
  glow.height = Math.max(1, Math.round(height * scale));
  const glowContext = glow.getContext("2d", { willReadFrequently: true });
  if (!glowContext) return;
  glowContext.drawImage(context.canvas, 0, 0, glow.width, glow.height);
  const mask = glowContext.getImageData(0, 0, glow.width, glow.height);
  for (let index = 0; index < mask.data.length; index += 4) {
    const luminance = 0.299 * mask.data[index] + 0.587 * mask.data[index + 1] + 0.114 * mask.data[index + 2];
    const alpha = smoothstep(211, 255, luminance) * 0.42;
    mask.data[index] = 255;
    mask.data[index + 1] = 174;
    mask.data[index + 2] = 116;
    mask.data[index + 3] = alpha * 255;
  }
  glowContext.putImageData(mask, 0, 0);
  const blurred = document.createElement("canvas");
  blurred.width = glow.width;
  blurred.height = glow.height;
  const blurredContext = blurred.getContext("2d");
  if (!blurredContext) return;
  blurredContext.filter = `blur(${Math.max(2, glow.width * 0.009)}px)`;
  blurredContext.drawImage(glow, 0, 0);
  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.12;
  context.drawImage(blurred, 0, 0, width, height);
  context.restore();
}

function addVignette(context: CanvasRenderingContext2D, width: number, height: number, random: () => number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height) * 0.72;
  const strength = 0.13 + random() * 0.1;
  const gradient = context.createRadialGradient(centerX, centerY, radius * 0.22, centerX, centerY, radius);
  gradient.addColorStop(0, "rgba(28,18,12,0)");
  gradient.addColorStop(0.68, "rgba(28,18,12,0)");
  gradient.addColorStop(1, `rgba(28,18,12,${strength})`);
  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function addY2KVignette(context: CanvasRenderingContext2D, width: number, height: number) {
  const radius = Math.max(width, height) * 0.76;
  const gradient = context.createRadialGradient(width / 2, height / 2, radius * 0.2, width / 2, height / 2, radius);
  gradient.addColorStop(0, "rgba(8, 10, 23, 0)");
  gradient.addColorStop(0.62, "rgba(8, 10, 23, 0)");
  gradient.addColorStop(1, "rgba(8, 10, 23, 0.18)");
  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function addFlashVignette(context: CanvasRenderingContext2D, width: number, height: number) {
  const centerX = width * 0.5;
  const centerY = height * 0.46;
  const radius = Math.max(width, height) * 0.78;
  const gradient = context.createRadialGradient(centerX, centerY, radius * 0.22, centerX, centerY, radius);
  gradient.addColorStop(0, "rgba(15, 17, 23, 0)");
  gradient.addColorStop(0.5, "rgba(15, 17, 23, 0)");
  gradient.addColorStop(1, "rgba(15, 17, 23, 0.36)");
  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

async function addFlashFilmGrain(context: CanvasRenderingContext2D, width: number, height: number, random: () => number) {
  // Use grain larger than single source pixels so it survives thumbnail resizing.
  const grain = document.createElement("canvas");
  grain.width = Math.max(1, Math.round(width * 0.22));
  grain.height = Math.max(1, Math.round(height * 0.22));
  const grainContext = grain.getContext("2d");
  if (!grainContext) return;

  const image = grainContext.createImageData(grain.width, grain.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const shared = (random() + random() + random() - 1.5) * 72;
    const colorGrain = (random() - 0.5) * 38;
    image.data[index] = clamp(128 + shared + colorGrain);
    image.data[index + 1] = clamp(128 + shared);
    image.data[index + 2] = clamp(128 + shared - colorGrain);
    image.data[index + 3] = 255;
  }
  grainContext.putImageData(image, 0, 0);

  context.save();
  context.globalCompositeOperation = "overlay";
  context.globalAlpha = 0.2;
  context.imageSmoothingEnabled = true;
  context.drawImage(grain, 0, 0, width, height);
  context.restore();
}

function sceneLuminance(canvas: HTMLCanvasElement) {
  const sample = document.createElement("canvas");
  sample.width = sample.height = 24;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return 128;
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4) total += 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
  return total / (pixels.length / 4);
}

function addDateImprint(context: CanvasRenderingContext2D, width: number, height: number, date: Date, orientation: "horizontal" | "vertical", yearMode: "photo" | "2006") {
  const size = orientation === "vertical"
    ? Math.max(21, Math.min(54, width * 0.046))
    : Math.max(18, Math.min(44, width * 0.038));
  const marginX = Math.max(12, width * 0.042);
  const marginY = Math.max(10, height * 0.036);
  const groups = [
    String(yearMode === "2006" ? 2006 : date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const unit = size / 5;
  const digitAdvance = unit * 4;
  const groupGap = unit * 2;
  const stampWidth = unit * 30;
  const stampHeight = unit * 5;
  let top = 0;
  let left = 0;
  context.save();
  if (orientation === "vertical") {
    context.translate(marginX + stampHeight, height - marginY - stampWidth);
    context.rotate(Math.PI / 2);
    top = 0;
  } else {
    context.translate(width - marginX - stampWidth, height - marginY - stampHeight);
  }
  context.fillStyle = "rgba(255, 182, 77, 0.94)";
  context.shadowColor = "rgba(255, 157, 48, 0.68)";
  context.shadowBlur = unit * 0.65;
  const segmentThickness = unit * 0.62;
  const horizontal = (x: number, y: number) => {
    context.beginPath();
    context.moveTo(x + segmentThickness * 0.42, y);
    context.lineTo(x + unit * 3 - segmentThickness * 0.42, y);
    context.lineTo(x + unit * 3, y + segmentThickness / 2);
    context.lineTo(x + unit * 3 - segmentThickness * 0.42, y + segmentThickness);
    context.lineTo(x + segmentThickness * 0.42, y + segmentThickness);
    context.lineTo(x, y + segmentThickness / 2);
    context.closePath();
    context.fill();
  };
  const vertical = (x: number, y: number) => {
    context.beginPath();
    context.moveTo(x, y + segmentThickness * 0.42);
    context.lineTo(x + segmentThickness / 2, y);
    context.lineTo(x + segmentThickness, y + segmentThickness * 0.42);
    context.lineTo(x + segmentThickness, y + unit * 2 - segmentThickness * 0.42);
    context.lineTo(x + segmentThickness / 2, y + unit * 2);
    context.lineTo(x, y + unit * 2 - segmentThickness * 0.42);
    context.closePath();
    context.fill();
  };
  const apostrophe = (x: number, y: number) => {
    context.beginPath();
    context.moveTo(x + unit * 0.18, y + unit * 0.12);
    context.lineTo(x + unit * 0.9, y + unit * 0.02);
    context.lineTo(x + unit * 0.58, y + unit * 1.28);
    context.lineTo(x + unit * 0.02, y + unit * 1.38);
    context.closePath();
    context.fill();
  };
  for (const [groupIndex, group] of groups.entries()) {
    if (groupIndex === 0) {
      apostrophe(left, top);
      left += unit * 1.5;
    }
    for (const digit of group) {
      const segments = SEVEN_SEGMENT_DIGITS[digit];
      if (segments.includes("a")) horizontal(left, top);
      if (segments.includes("g")) horizontal(left, top + unit * 2.5 - segmentThickness / 2);
      if (segments.includes("d")) horizontal(left, top + unit * 5 - segmentThickness);
      if (segments.includes("f")) vertical(left, top);
      if (segments.includes("b")) vertical(left + unit * 3 - segmentThickness, top);
      if (segments.includes("e")) vertical(left, top + unit * 3);
      if (segments.includes("c")) vertical(left + unit * 3 - segmentThickness, top + unit * 3);
      left += digitAdvance;
    }
    left += groupGap;
  }
  context.restore();
}

async function encodeJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("This browser could not save the processed photo.")), "image/jpeg", quality);
  });
}

async function encodeWithinLimit(canvas: HTMLCanvasElement, quality: number, maxBytes?: number) {
  let outputQuality = quality;
  let blob = await encodeJpeg(canvas, outputQuality);
  if (!maxBytes) return blob;
  const qualityFloor = maxBytes < 1_000_000 ? 0.7 : Math.max(0.82, quality - 0.1);
  while (blob.size > maxBytes && outputQuality > qualityFloor) {
    outputQuality = Math.max(qualityFloor, outputQuality - 0.03);
    blob = await encodeJpeg(canvas, outputQuality);
  }
  if (blob.size <= maxBytes) return blob;

  let current = canvas;
  while (blob.size > maxBytes && Math.max(current.width, current.height) > 1100) {
    const scale = Math.max(0.72, Math.sqrt(maxBytes / blob.size) * 0.92);
    const resized = document.createElement("canvas");
    resized.width = Math.max(1, Math.round(current.width * scale));
    resized.height = Math.max(1, Math.round(current.height * scale));
    const resizedContext = resized.getContext("2d");
    if (!resizedContext) break;
    resizedContext.imageSmoothingEnabled = true;
    resizedContext.imageSmoothingQuality = "high";
    resizedContext.drawImage(current, 0, 0, resized.width, resized.height);
    current = resized;
    outputQuality = maxBytes < 1_000_000 ? Math.min(0.84, quality) : Math.max(0.84, quality - 0.06);
    blob = await encodeJpeg(current, outputQuality);
  }
  if (blob.size > maxBytes) throw new Error("This photo could not be compressed enough for this roll. Try a smaller image.");
  return blob;
}

export async function processPhotoFile(file: File, options: PhotoProcessingOptions) {
  const decoded = await decodePhoto(file);
  try {
    if (!decoded.width || !decoded.height) throw new Error("That image has no usable dimensions.");
    const maxDimension = options.maxDimension ?? 3200;
    const maxPixels = options.maxPixels ?? 8_000_000;
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height), Math.sqrt(maxPixels / (decoded.width * decoded.height)));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser could not prepare the image.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.image, 0, 0, width, height);
    // Segment a small copy of the orientation-corrected image. The model runs
    // at low resolution, so full-size input wastes mobile memory and can crash
    // the browser while saving a Flash photo.
    let personMasks: PersonMasks | null = null;
    if (options.filterId === "flash") {
      const maskScale = Math.min(1, 512 / Math.max(width, height));
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = Math.max(1, Math.round(width * maskScale));
      maskCanvas.height = Math.max(1, Math.round(height * maskScale));
      const maskContext = maskCanvas.getContext("2d");
      if (maskContext) {
        maskContext.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);
        personMasks = await createPersonMasks(maskCanvas);
      }
    }

    const random = randomGenerator(options.seed);
    const variation = options.filterId === "disposable"
      ? { exposure: (random() - 0.5) * 4.2, temperature: (random() - 0.5) * 3 }
      : { exposure: 0, temperature: 0 };
    const averageLuminance = options.filterId === "y2k" ? sceneLuminance(canvas) : 128;
    const sceneExposure = { y2kLift: options.filterId === "y2k" ? Math.max(0, Math.min(10, (122 - averageLuminance) * 0.12)) : 0 };
    if (options.filterId !== "original") {
      const image = context.getImageData(0, 0, width, height);
      await processPixelRows(image.data, width, height, options.filterId, random, variation, sceneExposure, personMasks);
      context.putImageData(image, 0, 0);
    }
    if (options.filterId === "y2k") {
      await addY2KColorFringe(context, width, height);
      addY2KVignette(context, width, height);
    }
    if (options.filterId === "flash") {
      addFlashVignette(context, width, height);
      await addFlashFilmGrain(context, width, height, random);
      await addFlashEdgeFringe(context, width, height);
    }
    if (options.filterId === "disposable") {
      addLightLeaks(context, width, height, random);
      addHalation(context, width, height);
      addVignette(context, width, height, random);
    }
    if (options.dateStamp && (options.filterId === "y2k" || options.filterId === "disposable" || options.filterId === "flash")) {
      addDateImprint(context, width, height, await getCaptureDate(file), options.dateStampOrientation ?? "horizontal", options.dateStampYear ?? "photo");
    }
    if (options.filterId === "disposable") await addDisposableFilmGrain(context, width, height, random);
    return await encodeWithinLimit(canvas, options.quality ?? 0.9, options.maxBytes);
  } finally {
    decoded.close?.();
  }
}

export async function createPhotoThumbnail(blob: Blob) {
  const decoded = await decodePhoto(new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
  try {
    const scale = Math.min(1, 560 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return new Blob();
    context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
    return await encodeJpeg(canvas, 0.76);
  } finally {
    decoded.close?.();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not prepare the photo for this device."));
    reader.onerror = () => reject(new Error("Could not prepare the photo for this device."));
    reader.readAsDataURL(blob);
  });
}
