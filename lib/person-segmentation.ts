import type { ImageSegmenter } from "@mediapipe/tasks-vision";

export type PersonMasks = {
  person: Float32Array;
  skin: Float32Array;
  width: number;
  height: number;
};

const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";
let segmenterPromise: Promise<ImageSegmenter> | null = null;

function hasPersonSignal(mask: Float32Array) {
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] >= 0.15) return true;
  }
  return false;
}

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = {
        // Prefer WASM/CPU in the browser. Some mobile GPU delegates terminate
        // the page during inference even though model initialization succeeds.
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" as const },
        runningMode: "IMAGE" as const,
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      };
      return ImageSegmenter.createFromOptions(vision, options);
    })().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

export async function createPersonMasks(image: TexImageSource): Promise<PersonMasks | null> {
  try {
    const segmenter = await getSegmenter();
    const result = segmenter.segment(image);
    const labels = segmenter.getLabels().map((label) => label.toLowerCase());
    const confidenceMasks = result.confidenceMasks ?? [];
    if (confidenceMasks.length) {
      const width = confidenceMasks[0].width;
      const height = confidenceMasks[0].height;
      const categoryData = confidenceMasks.map((mask) => new Float32Array(mask.getAsFloat32Array()));
      const labeledSubjectIndexes = labels.flatMap((label, index) => /hair|skin|clothes|person|body|face/.test(label) ? [index] : []);
      const personIndexes = labeledSubjectIndexes.length
        ? labeledSubjectIndexes
        : labels.length
          ? labels.flatMap((label, index) => /background|bg/.test(label) ? [] : [index])
        : confidenceMasks.length > 1 ? Array.from({ length: confidenceMasks.length - 1 }, (_, index) => index + 1) : [0];
      const skinIndexes = labels.length
        ? labels.flatMap((label, index) => /skin/.test(label) ? [index] : [])
        : categoryData.length > 3 ? [2, 3] : [];
      const person = new Float32Array(categoryData[0].length);
      const skin = new Float32Array(categoryData[0].length);
      for (const classIndex of personIndexes) {
        const classMask = categoryData[classIndex];
        if (!classMask) continue;
        for (let index = 0; index < person.length; index += 1) person[index] += classMask[index];
      }
      for (const classIndex of skinIndexes) {
        const classMask = categoryData[classIndex];
        if (!classMask) continue;
        for (let index = 0; index < skin.length; index += 1) skin[index] += classMask[index];
      }
      for (let index = 0; index < person.length; index += 1) {
        person[index] = Math.min(1, person[index]);
        skin[index] = Math.min(person[index], skin[index]);
      }
      confidenceMasks.forEach((item) => item.close());
      result.categoryMask?.close();
      if (person.length && !hasPersonSignal(person)) return null;
      return { person, skin, width, height };
    }

    const categoryMask = result.categoryMask;
    if (!categoryMask) return null;
    const categories = new Uint8Array(categoryMask.getAsUint8Array());
    const labeledSubjectIndexes = labels.flatMap((label, index) => /hair|skin|clothes|person|body|face/.test(label) ? [index] : []);
    const personIndexes = labeledSubjectIndexes.length
      ? labeledSubjectIndexes
      : labels.length
        ? labels.flatMap((label, index) => /background|bg/.test(label) ? [] : [index])
      : Array.from({ length: 5 }, (_, index) => index + 1);
    const skinIndexes = labels.length
      ? labels.flatMap((label, index) => /skin/.test(label) ? [index] : [])
      : [2, 3];
    const person = new Float32Array(categories.length);
    const skin = new Float32Array(categories.length);
    for (let index = 0; index < categories.length; index += 1) {
      person[index] = personIndexes.includes(categories[index]) ? 1 : 0;
      skin[index] = skinIndexes.includes(categories[index]) ? 1 : 0;
    }
    const masks = { person, skin, width: categoryMask.width, height: categoryMask.height };
    categoryMask.close();
    confidenceMasks.forEach((item) => item.close());
    if (person.length && !hasPersonSignal(person)) return null;
    return masks;
  } catch {
    return null;
  }
}
