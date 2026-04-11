import * as tf from "@tensorflow/tfjs";
import * as nsfwjs from "nsfwjs";
import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";

const THRESHOLDS: Record<string, number> = {
  Porn: 0.4,
  Hentai: 0.4,
  Sexy: 0.4,
};

export type PredictionEntry = {
  className: string;
  probability: number;
};

export type NsfwResult = {
  isNsfw: boolean;
  category: string;
  confidence: number;
  all: PredictionEntry[];
};

let model: nsfwjs.NSFWJS | null = null;

export async function loadModel(): Promise<void> {
  if (model) return;
  console.log("Loading NSFW model...");
  model = await nsfwjs.load();
  console.log("NSFW model loaded.");
}

function decodeImage(buffer: Buffer): {
  data: Uint8Array;
  width: number;
  height: number;
} {
  // Detect format from magic bytes
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    // PNG
    const png = PNG.sync.read(buffer);
    return {
      data: new Uint8Array(png.data),
      width: png.width,
      height: png.height,
    };
  }

  // Default: try JPEG
  const img = jpeg.decode(buffer, { useTArray: true });
  return {
    data: new Uint8Array(img.data),
    width: img.width,
    height: img.height,
  };
}

export async function classifyImage(buffer: Buffer): Promise<NsfwResult> {
  if (!model) {
    await loadModel();
  }

  const imageData = decodeImage(buffer);

  // fromPixels expects 4-channel RGBA data or 3-channel RGB
  // jpeg-js and pngjs both return RGBA (4 channels), so we pass numChannels=3
  // to extract only RGB
  const tensor = tf.browser.fromPixels(
    {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    },
    3,
  );

  const predictions = await model!.classify(tensor as tf.Tensor3D);
  tensor.dispose();

  const all = predictions.map((p) => ({
    className: p.className,
    probability: p.probability,
  }));

  for (const pred of predictions) {
    const threshold = THRESHOLDS[pred.className];
    if (threshold !== undefined && pred.probability >= threshold) {
      return {
        isNsfw: true,
        category: pred.className,
        confidence: pred.probability,
        all,
      };
    }
  }

  return { isNsfw: false, category: "Neutral", confidence: 0, all };
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

export async function downloadTelegramFile(
  filePath: string,
): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to download file: ${res.status} ${res.statusText}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}
