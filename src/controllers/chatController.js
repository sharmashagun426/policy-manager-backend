import { embeddings } from "../config/google-ai.js";
import { pineconeIndex } from "../config/pinecone.js";
import * as geminiService from "../services/geminiService.js";

export const chat = async (req, res) => {
    const { question, history } = req.body; // history expected as [{role, parts: [{text}]}]

    try {
        // 1. Rewrite Query into up to 3 candidate queries (handles typos)
        const rewritten = await geminiService.rewriteQuery(question, history);
        const candidates = rewritten.split("|||").map((s) => s.trim()).filter(Boolean);

        // 2. Try each candidate against Pinecone until we find a good match
        let selectedContext = null;
        let selectedQuestion = null;
        for (const cand of candidates) {
            const queryEmbedding = await embeddings.embedQuery(cand);
            const queryResponse = await pineconeIndex.query({
                vector: queryEmbedding,
                topK: 5,
                includeMetadata: true
            });

            const matches = queryResponse.matches || [];
            const topScore = matches.reduce((max, match) => Math.max(max, match.score ?? 0), 0);
            const relevantMatches = matches.filter((match) => match.score == null || match.score >= 0.50);


            if (topScore >= 0.50 && relevantMatches.length > 0) {
                selectedContext = relevantMatches.map((m) => m.metadata.text).join("\n\n---\n\n");
                selectedQuestion = cand;
                break;
            }
        }

        if (!selectedContext) {
            // higher topK to increase recall for typo/term mismatches.
            const variations = new Set();
            for (const c of candidates) {
                variations.add(c);
                variations.add(c.replace(/\btree\b/gi, 'list'));
                variations.add((c + ' linked list').trim());
                variations.add(c.replace(/\blinked\b/gi, 'linked list'));
            }

            for (const c of Array.from(variations)) {
                if (!c) continue;
                const queryEmbedding = await embeddings.embedQuery(c);
                const queryResponse = await pineconeIndex.query({
                    vector: queryEmbedding,
                    topK: 10,
                    includeMetadata: true
                });
                const matches = queryResponse.matches || [];
                const topScore = matches.reduce((max, match) => Math.max(max, match.score ?? 0), 0);
                const relevantMatches = matches.filter((match) => match.score == null || match.score >= 0.51);

                if (topScore >= 0.51 && relevantMatches.length > 0) {
                    selectedContext = relevantMatches.map((m) => m.metadata.text).join("\n\n---\n\n");
                    selectedQuestion = c;
                    break;
                }
            }
        }

        // 3. Get Final Answer using the selected candidate + context
        const answer = await geminiService.generateAnswer(selectedQuestion, selectedContext);

        // context: queryResponse.matches
        res.json({ answer});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};