import fs from "fs/promises";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { embeddings } from "../config/google-ai.js";
import { pineconeIndex } from "../config/pinecone.js";
import supabase from "../config/supabase.js";
import { processImageFile, processPdfForOcr } from "./ocr/index.js";

const THIN_TEXT_THRESHOLD = 50;

// ── Helpers ──────────────────────────────────────────────────────────────

const removeTempFile = (file) => file?.path ? fs.unlink(file.path).catch(() => {}) : Promise.resolve();

async function updateDocument(documentId, update) {
  const { error } = await supabase
    .from("org-documents")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) console.error("[ocr] Document update failed:", error.message);
}

async function upsertChunks(documentId, organizationId, fileName, chunks, source, engine) {
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const rawChunks = await textSplitter.splitText(chunks.join("\n\n---\n\n"));
  const filtered = rawChunks.filter((c) => c.trim().length > 0);

  for (let i = 0; i < filtered.length; i++) {
    const vector = await embeddings.embedQuery(filtered[i]);
    await pineconeIndex.upsert([{
      id: `${documentId}-${i}`,
      values: vector,
      metadata: {
        documentId,
        organizationId,
        fileName,
        text: filtered[i],
        source,
        engine: engine || "auto",
      },
    }]);
    await new Promise((r) => setTimeout(r, 150));
  }

  return filtered.length;
}

// ── PDF pipeline ─────────────────────────────────────────────────────────

export async function processPdfUpload(file, documentId, organizationId) {
  try {
    // 1. Text extraction via PDFLoader
    const loader = new PDFLoader(file.path);
    const rawDocs = await loader.load();
    const textPages = rawDocs.map((d) => d.pageContent || "");

    // 2. Auto-detect scanned pages → run OCR
    const needsOcr = textPages.some((t) => t.trim().length < THIN_TEXT_THRESHOLD);
    let ocrPages = [];
    if (needsOcr) {
      console.log("[index] Thin text detected – running OCR");
      try {
        const result = await processPdfForOcr(file.path);
        ocrPages = result.pages || [];
      } catch (err) {
        console.warn("[index] OCR failed, continuing with text only:", err.message);
      }
    }

    // 3. Merge: prefer the richer source per page
    const merged = mergePages(textPages, ocrPages);

    // 4. Chunk → embed → upsert
    const chunkCount = await upsertChunks(
      documentId, organizationId, file.originalname, merged,
      needsOcr ? "pdf+ocr" : "pdf-text",
    );

    await updateDocument(documentId, {
      status: "ready",
      pages: rawDocs.length,
      chunk_count: chunkCount,
      fail_reason: null,
    });
  } catch (err) {
    await failDocument(documentId, err);
  } finally {
    await removeTempFile(file);
  }
}

// ── Image pipeline ───────────────────────────────────────────────────────

export async function processImageUpload(file, documentId, organizationId) {
  try {
    const { text, engine } = await processImageFile(file.path);

    if (!text || text.trim().length === 0) {
      await updateDocument(documentId, {
        status: "failed",
        fail_reason: "No text could be extracted from the image.",
      });
      return;
    }

    const chunkCount = await upsertChunks(
      documentId, organizationId, file.originalname, [text], "image-ocr", engine,
    );

    await updateDocument(documentId, {
      status: "ready",
      pages: 1,
      chunk_count: chunkCount,
      fail_reason: null,
    });
  } catch (err) {
    await failDocument(documentId, err);
  } finally {
    await removeTempFile(file);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────

function mergePages(textPages, ocrPages) {
  const max = Math.max(textPages.length, ocrPages.length);
  const merged = [];
  for (let i = 0; i < max; i++) {
    const text = (textPages[i] || "").trim();
    const ocr = (ocrPages.find((o) => o.pageIndex === i)?.text || "").trim();
    if (ocr.length > text.length * 1.3 || text.length < THIN_TEXT_THRESHOLD) {
      if (ocr) merged.push(ocr);
      else if (text) merged.push(text);
    } else if (text) {
      merged.push(text);
    }
  }
  return merged;
}

async function failDocument(documentId, err) {
  const reason = err?.message || String(err);
  console.error("[ocr] Pipeline error:", reason);
  await updateDocument(documentId, { status: "failed", fail_reason: reason });
}
