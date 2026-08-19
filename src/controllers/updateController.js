import { embeddings } from "../config/google-ai.js";
import { pineconeIndex } from "../config/pinecone.js";
import * as geminiService from "../services/geminiService.js";

// Step 1: Search for chunks to update
export const searchToUpdate = async (req, res) => {
    const { instruction } = req.body;
    try {
        const vector = await embeddings.embedQuery(instruction);
        const result = await pineconeIndex.query({ vector, topK: 3, includeMetadata: true });
        res.json(result.matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Step 2: Apply the update
export const executeUpdate = async (req, res) => {
    const { id, originalText, instruction, metadata } = req.body;
    try {
        const updatedText = await geminiService.generateUpdatedChunk(originalText, instruction);
        const newVector = await embeddings.embedQuery(updatedText);

        await pineconeIndex.upsert([{
            id,
            values: newVector,
            metadata: { ...metadata, text: updatedText, lastUpdated: new Date().toISOString() }
        }]);

        res.json({ message: "Update successful", updatedText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};