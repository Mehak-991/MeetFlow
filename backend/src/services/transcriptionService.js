import { Transcript } from "../models/transcript.model.js";
import { getEmbedding } from "./embeddingService.js";

/**
 * Saves a transcript segment and initiates background embedding generation.
 */
export const saveTranscriptSegment = async (meetingCode, speaker, text) => {
  if (!text || text.trim() === "") return null;

  try {
    const segment = new Transcript({
      meetingCode,
      speaker,
      text
    });

    await segment.save();

    // Async embedding generation to not block socket / main thread
    getEmbedding(text)
      .then(async (embedding) => {
        segment.embedding = embedding;
        await segment.save();
      })
      .catch((err) => {
        console.error("Failed to generate embedding for segment:", err);
      });

    return segment;
  } catch (error) {
    console.error("Error saving transcript segment:", error);
    return null;
  }
};

/**
 * Compiles the entire transcript for a meeting as a single string.
 */
export const getFullTranscriptText = async (meetingCode) => {
  try {
    const segments = await Transcript.find({ meetingCode }).sort({ timestamp: 1 });
    return segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n");
  } catch (error) {
    console.error("Failed to get full transcript text:", error);
    return "";
  }
};
