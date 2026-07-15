import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchSimilarChunks } from "./vectorService.js";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * RAG workflow to answer user questions using only the meeting transcript chunks.
 */
export const answerMeetingQuestion = async (meetingCode, question) => {
  try {
    const relevantChunks = await searchSimilarChunks(meetingCode, question, 6);
    
    if (relevantChunks.length === 0) {
      return "No transcript records found for this meeting. Please record or talk first.";
    }

    const context = relevantChunks
      .map((c) => `[${c.speaker}]: ${c.text}`)
      .join("\n");

    if (!genAI) {
      console.warn("GEMINI_API_KEY is not set. Answering with fallback mockup.");
      return `[Mock Answer] Since GEMINI_API_KEY is not set, I matched these transcript parts:\n\n${context}\n\nAsk your developer to add a Gemini key to backend/.env!`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a helpful meeting assistant. Answer the user's question about the meeting using ONLY the context transcript provided below.
If the answer is not mentioned in the transcript context, reply: "I cannot find this information in the transcript."

Transcript Context:
${context}

User's Question:
${question}

Answer:
`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Error in meeting assistant:", error);
    return `Error processing meeting assistant request: ${error.message}`;
  }
};
