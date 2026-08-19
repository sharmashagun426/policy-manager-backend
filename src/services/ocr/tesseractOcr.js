import { createWorker } from "tesseract.js";

let _worker = null;

async function getWorker() {
  if (!_worker) {
    _worker = await createWorker("eng");
  }
  return _worker;
}

/**
 * Run local Tesseract OCR on an image buffer.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function ocrWithTesseract(imageBuffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageBuffer);

  return {
    text: data.text || "",
    confidence: data.confidence ?? 0,
  };
}

/** Shut down the cached worker on process exit. */
export async function terminateTesseract() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}
