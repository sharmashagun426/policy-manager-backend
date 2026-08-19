import supabase from "../config/supabase.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getOrganizationId = (req, res) => {
    const organizationId = req.query.organizationId || req.query.organization_id;

    if (!organizationId) {
        res.status(400).json({ error: "organizationId is required" });
        return null;
    }

    if (!UUID_PATTERN.test(organizationId)) {
        res.status(400).json({
            error: "organizationId must be the organization's UUID, not its display name",
        });
        return null;
    }

    return organizationId;
};

const toOrgDocument = document => ({
    id: document.id,
    fileName: document.file_name,
    title: document.title,
    category: document.category ?? "",
    pages: document.pages ?? 0,
    sizeKb: document.size_kb ?? 0,
    status: document.status,
    uploadedBy: document.uploaded_by,
    uploadedAt: document.uploaded_at,
    failReason: document.fail_reason ?? null,
});

export const getDocument = async (req, res) => {
    const organizationId = getOrganizationId(req, res);
    if (!organizationId) return;

    const { data, error } = await supabase
        .from("org-documents")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[documents] Failed to fetch documents", { error: error.message });
        return res.status(500).json({ error: "Unable to fetch documents" });
    }

    return res.json(data.map(toOrgDocument));
};

export const getDocumentById = async (req, res) => {
    const organizationId = getOrganizationId(req, res);
    if (!organizationId) return;

    const { data, error } = await supabase
        .from("org-documents")
        .select("*")
        .eq("id", req.params.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (error) {
        console.error("[documents] Failed to fetch document", {
            documentId: req.params.id,
            error: error.message,
        });
        return res.status(500).json({ error: "Unable to fetch document" });
    }

    if (!data) {
        return res.status(404).json({ error: "Document not found" });
    }

    return res.json(toOrgDocument(data));
};
