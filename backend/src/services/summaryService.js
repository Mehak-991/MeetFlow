import { GoogleGenerativeAI } from "@google/generative-ai";
import { Summary } from "../models/summary.model.js";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generate a meeting summary using Gemini AI.
 */
export const generateSummary = async (meetingCode, transcriptText) => {
  if (!transcriptText || transcriptText.trim() === "") {
    return null;
  }

  let summaryData = {
    meetingCode,
    executiveSummary: "No transcript content available to summarize.",
    keyDiscussionPoints: [],
    decisionsTaken: [],
    risks: [],
    actionItems: [],
    deadlines: [],
    nextSteps: []
  };

  if (!genAI) {
    console.warn("GEMINI_API_KEY is not set. Generating mock summary.");
    summaryData.executiveSummary = "This is a mock summary of the meeting since GEMINI_API_KEY was not configured. The transcript was: " + transcriptText.slice(0, 100) + "...";
    summaryData.keyDiscussionPoints = ["Discussed progress on React dashboard", "Reviewed database schemas"];
    summaryData.decisionsTaken = ["Migrate codebase to production structure"];
    summaryData.risks = ["Limited time for full end-to-end testing"];
    summaryData.actionItems = ["Create new database models", "Integrate front-end charts"];
    summaryData.deadlines = ["Friday: complete frontend integration"];
    summaryData.nextSteps = ["Conduct testing", "Finalize deployment checks"];

    await Summary.findOneAndUpdate({ meetingCode }, summaryData, { upsert: true, new: true });
    return summaryData;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a meeting assistant. Analyze the following meeting transcript and generate a structured summary.
Return your output ONLY as a valid JSON object matching the following structure:
{
  "executiveSummary": "A concise paragraph summarizing the meeting.",
  "keyDiscussionPoints": ["point 1", "point 2"],
  "decisionsTaken": ["decision 1", "decision 2"],
  "risks": ["risk 1"],
  "actionItems": ["action item 1", "action item 2"],
  "deadlines": ["deadline 1", "deadline 2"],
  "nextSteps": ["step 1", "step 2"]
}

Do not include any markdown format tags like \`\`\`json or surrounding text. Return ONLY the raw JSON string.

Transcript:
${transcriptText}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    // Clean up markdown block formatting if present
    if (text.startsWith("```")) {
      text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(text);
    summaryData = {
      meetingCode,
      ...parsed
    };
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    summaryData.executiveSummary = "Error generating summary: " + error.message;
  }

  await Summary.findOneAndUpdate({ meetingCode }, summaryData, { upsert: true, new: true });
  return summaryData;
};
