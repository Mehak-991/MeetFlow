import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generates a vector embedding for the given text.
 * Falls back to dummy vectors if GEMINI_API_KEY is not defined.
 */
export const getEmbedding = async (text) => {
  if (!genAI) {
    console.warn("GEMINI_API_KEY is not set. Generating a mock embedding.");
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error calling Gemini Embedding API:", error);
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }
};
