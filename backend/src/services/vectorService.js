import { Transcript } from "../models/transcript.model.js";
import { getEmbedding } from "./embeddingService.js";

const dotProduct = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);
const magnitude = (arr) => Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));

const cosineSimilarity = (vecA, vecB) => {
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(vecA, vecB) / (magA * magB);
};

/**
 * Perform vector search using cosine similarity over transcripts.
 */
export const searchSimilarChunks = async (meetingCode, query, limit = 5) => {
  try {
    const queryEmbedding = await getEmbedding(query);
    const transcripts = await Transcript.find({ meetingCode });

    // Calculate similarity
    const matches = transcripts
      .map((t) => {
        let similarity = 0;
        if (t.embedding && t.embedding.length > 0) {
          similarity = cosineSimilarity(queryEmbedding, t.embedding);
        }
        return { chunk: t, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return matches.map((m) => m.chunk);
  } catch (error) {
    console.error("Vector search failed:", error);
    // Fallback to text matching
    return await Transcript.find({
      meetingCode,
      text: { $regex: query, $options: "i" }
    }).limit(limit);
  }
};
