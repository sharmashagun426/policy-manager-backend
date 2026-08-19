import 'dotenv/config';
import * as gemini from '../src/services/geminiService.js';
import { embeddings } from '../src/config/google-ai.js';
import { pineconeIndex } from '../src/config/pinecone.js';

const q = 'What is a lionked tree please short answer only';
console.log('INPUT:', q);

(async () => {
  try {
    const rewritten = await gemini.rewriteQuery(q, []);
    console.log('REWRITTEN:', rewritten);
    const candidates = rewritten.split('|||').map(s=>s.trim()).filter(Boolean);
    for (const c of candidates) {
      console.log('\n--- Candidate:', c);
      const emb = await embeddings.embedQuery(c);
      console.log('embedding length', emb.length);
      const res = await pineconeIndex.query({ vector: emb, topK: 5, includeMetadata: true });
      const matches = res.matches || [];
      const topScore = matches.reduce((max, m) => Math.max(max, m.score ?? 0), 0);
      console.log('matches:', matches.length, 'topScore:', topScore);
      console.log(JSON.stringify(matches.map(m=>({id:m.id,score:m.score, text: (m.metadata && m.metadata.text)? m.metadata.text.slice(0,120):null})), null, 2));
    }
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
