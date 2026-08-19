import PDFParser from "pdf2json";
import sharp from "sharp";

/**
 * Extract page images from a PDF.
 *
 * Strategy:
 *   1. sharp rasterisation (single-page PDFs).
 *   2. pdf2json embedded image extraction (multi-page).
 *
 * @param {string} pdfPath
 * @returns {Promise<Array<{buffer: Buffer, pageIndex: number, mimeType: string}>>}
 */
export async function extractImagesFromPdf(pdfPath) {
  const images = [];

  // --- Strategy 1: sharp rasterisation (single-page) ---
  try {
    const meta = await sharp(pdfPath, { density: 300 }).metadata();
    if (meta.pages && meta.pages > 1) throw new Error("multi-page");
    const buf = await sharp(pdfPath, { density: 300 }).png().toBuffer();
    images.push({ buffer: buf, pageIndex: 0, mimeType: "image/png" });
    return images;
  } catch {
    // sharp PDF support is limited – continue to pdf2json
  }

  // --- Strategy 2: pdf2json embedded images ---
  try {
    const parser = new PDFParser();
    const data = await new Promise((resolve, reject) => {
      parser.on("pdfParser_dataError", reject);
      parser.on("pdfParser_dataReady", resolve);
      parser.loadPDF(pdfPath);
    });

    const pages = data?.Pages || [];
    for (let i = 0; i < pages.length; i++) {
      const objs = pages[i]?.ImageObjects || [];
      for (const img of objs) {
        if (!img.r || img.r.length === 0) continue;
        try {
          const w = img.w || img.Width || 1;
          const h = img.h || img.Height || 1;
          const raw = img.r.flat ? img.r.flat() : [].concat(...img.r);
          const buf = await sharp(Buffer.from(raw), {
            raw: { width: w, height: h, channels: 3 },
          }).png().toBuffer();
          images.push({ buffer: buf, pageIndex: i, mimeType: "image/png" });
        } catch {
          // skip undecodable images
        }
      }
    }
  } catch (err) {
    console.error("[ocr] pdf2json extraction failed:", err.message || err);
  }

  return images;
}
