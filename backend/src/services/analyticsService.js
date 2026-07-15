import { GoogleGenerativeAI } from "@google/generative-ai";
import { Analytics } from "../models/analytics.model.js";
import { Transcript } from "../models/transcript.model.js";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Generates meeting analytics and speaker statistics.
 */
export const generateAnalytics = async (meetingCode) => {
  try {
    const transcripts = await Transcript.find({ meetingCode });
    if (transcripts.length === 0) return null;

    // 1. Calculate duration based on first and last transcript timestamp
    const firstTime = transcripts[0].timestamp;
    const lastTime = transcripts[transcripts.length - 1].timestamp;
    const duration = Math.max(10, Math.round((lastTime - firstTime) / 1000));

    // 2. Speaker aggregation
    const speakerMap = {};
    let totalWords = 0;

    transcripts.forEach((t) => {
      const speaker = t.speaker || "Unknown";
      if (!speakerMap[speaker]) {
        speakerMap[speaker] = {
          username: speaker,
          speakingTime: 0,
          speakingTurns: 0,
          questionsAsked: 0,
          words: 0
        };
      }

      speakerMap[speaker].speakingTurns += 1;

      // Estimate questions asked
      if (t.text.includes("?")) {
        speakerMap[speaker].questionsAsked += 1;
      }

      // Word count calculation
      const words = t.text.split(/\s+/).filter(Boolean).length;
      speakerMap[speaker].words += words;
      totalWords += words;
    });

    // Speak time estimation: average speaking speed is ~2.5 words per second (150 WPM)
    const participants = Object.values(speakerMap).map((p) => {
      // speakingTime = words / 2.5
      p.speakingTime = Math.round(Math.max(1, p.words / 2.5));
      delete p.words; // clean up internal field
      return p;
    });

    // 3. Overall scores
    // Participation score based on speaker distribution (entropy/variance)
    const activeCount = participants.length;
    let participationScore = 70; // baseline
    if (activeCount > 1) {
      const turns = participants.map((p) => p.speakingTurns);
      const maxTurns = Math.max(...turns);
      const minTurns = Math.min(...turns);
      const variance = maxTurns - minTurns;
      participationScore = Math.max(40, Math.min(98, Math.round(100 - (variance * 5))));
    }

    let meetingScore = Math.round((participationScore + 80) / 2);

    // 4. Sentiment and Topics extraction using Gemini if possible
    let sentimentTrend = ["Neutral"];
    let frequentlyDiscussed = ["General Standup"];

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const compiledText = transcripts.slice(0, 100).map((t) => `[${t.speaker}]: ${t.text}`).join("\n");
        const prompt = `
Analyze this transcript from a meeting and extract:
1. Sentiment Trend (array of up to 3 values: e.g. ["Positive", "Optimistic", "Neutral"])
2. Top 3 frequently discussed keywords/topics (e.g. ["React", "Authentication", "MongoDB"])

Return your output ONLY as a valid JSON object matching this structure:
{
  "sentimentTrend": ["sentiment1", "sentiment2"],
  "frequentlyDiscussed": ["topic1", "topic2"]
}

Do not include any markdown format tags like \`\`\`json or surrounding text. Return ONLY the raw JSON string.

Transcript:
${compiledText}
`;
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        if (responseText.startsWith("```")) {
          responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }
        const parsed = JSON.parse(responseText);
        sentimentTrend = parsed.sentimentTrend || sentimentTrend;
        frequentlyDiscussed = parsed.frequentlyDiscussed || frequentlyDiscussed;
      } catch (err) {
        console.error("AI Analytics parsing failed:", err);
      }
    } else {
      // Mocked topics from simple transcript checks
      const text = transcripts.map((t) => t.text.toLowerCase()).join(" ");
      const keywords = ["react", "mongodb", "authentication", "api", "deadline", "design", "css", "state"];
      const found = keywords.filter((kw) => text.includes(kw)).map((kw) => kw.charAt(0).toUpperCase() + kw.slice(1));
      if (found.length > 0) {
        frequentlyDiscussed = found.slice(0, 3);
      }
    }

    const analyticsData = {
      meetingCode,
      duration,
      attendanceRate: 100, // standard default
      meetingScore,
      participationScore,
      sentimentTrend,
      frequentlyDiscussed,
      participants
    };

    const finalAnalytics = await Analytics.findOneAndUpdate(
      { meetingCode },
      analyticsData,
      { upsert: true, new: true }
    );

    return finalAnalytics;
  } catch (error) {
    console.error("Error creating analytics:", error);
    return null;
  }
};
