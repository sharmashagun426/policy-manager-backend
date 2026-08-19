import express from "express";
import multer from "multer";
import * as indexCtrl from "../controllers/uploadDocumentController.js";
import * as chatCtrl from "../controllers/chatController.js";
import * as updateCtrl from "../controllers/updateController.js";
import * as documentsCtrl from "../controllers/documentsController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/", limits: { fileSize: 20 * 1024 * 1024 } });

router.use((req, res, next) => {
    next();
});

router.post("/upload-document", upload.single("pdf"), indexCtrl.uploadDocument);
router.get("/documents", documentsCtrl.getDocument);
router.get("/documents/:id", documentsCtrl.getDocumentById);
router.post("/chat", chatCtrl.chat);
router.post("/update/search", updateCtrl.searchToUpdate);
router.post("/update/execute", updateCtrl.executeUpdate);

export default router;
