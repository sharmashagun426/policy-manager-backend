import path from "path";
import fs from "fs/promises";
import supabase from "../config/supabase.js";
import { processPdfUpload, processImageUpload } from "../services/ocrPipeline.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".tiff", ".tif", ".bmp"]);

const isImage = (f) => {
  if (!f) return false;
  if (f.mimetype?.startsWith("image/")) return true;
  return IMAGE_EXTS.has(path.extname(f.originalname).toLowerCase());
};

const isPdf = (f) => {
  if (!f) return false;
  return f.mimetype === "application/pdf" || path.extname(f.originalname).toLowerCase() === ".pdf";
};

const removeTemp = (f) => f?.path ? fs.unlink(f.path).catch(() => {}) : Promise.resolve();

// ── Upload handler ───────────────────────────────────────────────────────

export const uploadDocument = async (req, res) => {
  const file = req.file;
  const organizationId = req.body?.organizationId || req.body?.organization_id;
  const uploadedBy = req.body?.uploadedBy || req.body?.uploaded_by;

  // Validate file type (PDF or image)
  if (!file || (!isPdf(file) && !isImage(file))) {
    await removeTemp(file);
    return res.status(400).json({
      status: "failed",
      error: "A PDF or image file (png/jpg/webp) is required",
    });
  }

  // Validate required fields
  if (!organizationId || !uploadedBy) {
    await removeTemp(file);
    return res.status(400).json({
      status: "failed",
      error: "organizationId and uploadedBy are required",
    });
  }

  if (!UUID.test(organizationId)) {
    await removeTemp(file);
    return res.status(400).json({
      status: "failed",
      error: "organizationId must be the organization's UUID, not its display name",
    });
  }

  // Create document record in Supabase
  const now = new Date().toISOString();
  let document;
  let insertError;

  try {
    ({ data: document, error: insertError } = await supabase
      .from("org-documents")
      .insert({
        organization_id: organizationId,
        file_name: file.originalname,
        title: file.originalname,
        storage_path: null,
        status: "processing",
        uploaded_by: uploadedBy,
        uploaded_at: now,
        pages: 0,
        size_kb: Math.round(file.size / 1024),
        chunk_count: 0,
        fail_reason: null,
      })
      .select()
      .single());
  } catch (error) {
    insertError = error;
  }

  if (insertError) {
    await removeTemp(file);
    console.error("[index] Failed to create document", { error: insertError?.message });
    return res.status(500).json({ status: "failed", error: "Unable to create document record" });
  }

  // Respond immediately — process in background
  const route = isImage(file) ? "image-ocr" : "pdf";
  void (isImage(file)
    ? processImageUpload(file, document.id, organizationId)
    : processPdfUpload(file, document.id, organizationId));

  return res.json({
    status: "processing",
    fileId: document.id,
    documentId: document.id,
    fileName: file.originalname,
    route,
    message: "File accepted and processing has started.",
  });
};
