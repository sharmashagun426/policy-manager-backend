import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const VISION_MODEL = "gemini-2.0-flash";

const PROMPT = `You are an expert document OCR assistant. Analyse the provided image and extract ALL text content.

RULES:
1. Extract every piece of text visible in the image – headings, body text, labels, footnotes, watermarks, etc.
2. For TABLES: reproduce them as clean Markdown tables with proper alignment. Preserve all column headers and cell values exactly.
3. For HEADINGS / TITLES: prefix them with the appropriate Markdown heading level (#, ##, ###) based on their visual hierarchy.
4. For LISTS: use Markdown bullet or numbered list syntax.
5. Preserve the logical reading order of the document.
6. If text is partially obscured or low quality, include your best reading in [brackets].
7. Output ONLY the extracted content. Do not add commentary, descriptions, or labels like "Image shows:".`;

const toBase64 = (buf) =>
  Buffer.isBuffer(buf) ? buf.toString("base64") : Buffer.from(buf).toString("base64");

/**
 * Extract structured text from an image using Gemini Vision.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<{text: string}>}
 */
export async function ocrWithGemini(imageBuffer, mimeType = "image/png") {
  const model = genAI.getGenerativeModel({ model: VISION_MODEL });

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        mimeType,
        data: toBase64(imageBuffer),
      },
    },
  ]);

  const text =
    result?.response?.text?.() ||
    result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";

  return { text: text.trim() };
}
