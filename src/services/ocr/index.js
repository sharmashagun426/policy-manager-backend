import fs from "fs/promises";
import path from "path";
import { ocrWithGemini } from "./geminiVision.js";
import { ocrWithTesseract } from "./tesseractOcr.js";
import { extractImagesFromPdf } from "./pdfExtractor.js";

const MIME_MAP = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".tiff": "image/tiff",
  ".tif": "image/tiff", ".bmp": "image/bmp",
};

const mimeFromExt = (ext) => MIME_MAP[ext.toLowerCase()] || "image/png";

/**
 * OCR a raw image buffer. Tries Gemini first, falls back to Tesseract.
 * @param {Buffer} buf
 * @param {string} mimeType
 * @param {{engine?: "auto"|"gemini"|"tesseract"}} [opts]
 */
export async function processImageBuffer(buf, mimeType = "image/png", opts = {}) {
  const engine = opts.engine || "auto";

  if (engine === "gemini" || engine === "auto") {
    try {
      const { text } = await ocrWithGemini(buf, mimeType);
      if (text) return { text, engine: "gemini" };
    } catch (err) {
      if (engine === "gemini") throw err;
      console.warn("[ocr] Gemini failed, falling back to Tesseract:", err.message);
    }
  }

  const { text } = await ocrWithTesseract(buf);
  return { text, engine: "tesseract" };
}

/**
 * OCR a single image file on disk.
 * @param {string} filePath
 * @param {{engine?: "auto"|"gemini"|"tesseract"}} [opts]
 */
export async function processImageFile(filePath, opts = {}) {
  const mimeType = mimeFromExt(path.extname(filePath));
  const buf = await fs.readFile(filePath);
  return processImageBuffer(buf, mimeType, opts);
}

/**
 * OCR every image-bearing page of a PDF.
 * @param {string} pdfPath
 * @param {{engine?: "auto"|"gemini"|"tesseract"}} [opts]
 */
export async function processPdfForOcr(pdfPath, opts = {}) {
  const images = await extractImagesFromPdf(pdfPath);
  if (images.length === 0) return { pages: [], totalImages: 0 };

  const pages = [];
  for (const img of images) {
    try {
      const result = await processImageBuffer(img.buffer, img.mimeType, opts);
      pages.push({ pageIndex: img.pageIndex, ...result });
    } catch (err) {
      console.error(`[ocr] Failed page ${img.pageIndex}:`, err.message);
      pages.push({ pageIndex: img.pageIndex, text: "", engine: "failed" });
    }
  }
  return { pages, totalImages: images.length };
}

// Re-export individual engines for direct use
export { ocrWithGemini } from "./geminiVision.js";
export { ocrWithTesseract, terminateTesseract } from "./tesseractOcr.js";
export { extractImagesFromPdf } from "./pdfExtractor.js";
