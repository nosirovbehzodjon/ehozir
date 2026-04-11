import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import * as jpeg from "jpeg-js";

const THRESHOLDS: Record<string, number> = {
  Porn: 0.7,
  Hentai: 0.7,
  Sexy: 0.85,
};

export type NsfwResult = {
  isNsfw: boolean;
  category: string;
  confidence: number;
};

let model: nsfwjs.NSFWJS | null = null;

export async function loadModel(): Promise<void> {
  if (model) return;
  console.log("Loading NSFW model...");
  model = await nsfwjs.load();
  console.log("NSFW model loaded.");
}

export async function classifyImage(buffer: Buffer): Promise<NsfwResult> {
  if (!model) {
    await loadModel();
  }

  const imageData = jpeg.decode(buffer, { useTArray: true });

  const tensor = tf.browser.fromPixels(
    {
      data: new Uint8Array(imageData.data),
      width: imageData.width,
      height: imageData.height,
    },
    3,
  );

  const predictions = await model!.classify(tensor as tf.Tensor3D);
  tensor.dispose();

  for (const pred of predictions) {
    const threshold = THRESHOLDS[pred.className];
    if (threshold !== undefined && pred.probability >= threshold) {
      return {
        isNsfw: true,
        category: pred.className,
        confidence: pred.probability,
      };
    }
  }

  return { isNsfw: false, category: "Neutral", confidence: 0 };
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

export async function downloadTelegramFile(
  filePath: string,
): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
