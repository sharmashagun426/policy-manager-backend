import { genAI } from "../config/google-ai.js";

const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

export const rewriteQuery = async (question, history) => {

  const contents = [];

  if (history && history.length > 0) {
    contents.push(...history);
  }

  contents.push({
    role: "user",
    parts: [
      {
        text: `Rewrite the following user input into up to 3 concise, standalone search queries. Correct any typos or misspellings and normalize punctuation. Output ONLY the rewritten queries separated by the token ||| (three pipe characters), for example: linked list ||| linked tree. Do not include any explanation. Input: "${question}"`,
      },
    ],
  });

  const result = await model.generateContent({
    contents,
    systemInstruction: `You are a query rewriter. Output ONLY the rewritten question text. Do not explain anything.`,
    generationConfig: {
      temperature: 0,
    },
  });

  const rewritten = result.response.text().trim();
  return rewritten;
};

export const generateAnswer = async (question, context) => {
  if (!context || !context.trim()) {
    return "I could not find relevant information in the document. Please contact to HR team.";
  }

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `CONTEXT:\n${context}\n\nQUESTION:\n${question}`,
          },
        ],
      },
    ],
    systemInstruction: `You are a Data Structure and Algorithm (DSA) Expert.

  RULES:
  1. Use ONLY the provided CONTEXT to answer the user's question.
  2. If the question contains typos or punctuation issues, correct them for understanding but do not add new facts.
  3. If the requested answer is not supported by the CONTEXT, reply exactly: I could not find relevant information in the document. Please contact to HR team.
  4. Do not invent details that are not present in the CONTEXT.
  5. If the CONTEXT contains enough information to answer, produce a short, direct response.
  6. If the CONTEXT describes the concept without an explicit definition, summarize the concept based only on the text provided.
  `,
    generationConfig: {
      temperature: 0,
      topP: 1,
    },
  });

  return result.response.text().trim();
};

export const generateUpdatedChunk = async (originalText, instruction) => {
  const prompt = `Original document chunk:\n"""${originalText}"""\n\nUpdate instruction: "${instruction}"\n\nRewrite the chunk applying this update. Keep everything else same. Output ONLY the updated text.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
};
