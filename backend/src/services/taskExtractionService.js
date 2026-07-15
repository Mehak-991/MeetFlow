import { GoogleGenerativeAI } from "@google/generative-ai";
import { Task } from "../models/task.model.js";

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Extract tasks/deadlines and save them.
 */
export const extractTasks = async (meetingCode, transcriptText) => {
  if (!transcriptText || transcriptText.trim() === "") {
    return [];
  }

  let tasksList = [];

  if (!genAI) {
    console.warn("GEMINI_API_KEY is not set. Generating mock tasks.");
    tasksList = [
      {
        meetingCode,
        task: "Deploy backend service",
        assignedTo: "Mehak",
        deadline: "Friday",
        completed: false
      },
      {
        meetingCode,
        task: "Integrate vector database",
        assignedTo: "Developer",
        deadline: "Wednesday",
        completed: false
      }
    ];

    await Task.deleteMany({ meetingCode });
    await Task.insertMany(tasksList);
    return tasksList;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
You are a task extractor. Review this transcript and identify all action items, tasks, who they are assigned to, and their deadlines.
Return your output ONLY as a valid JSON array of objects, where each object has the format:
[
  {
    "task": "Task description",
    "assignedTo": "Name of owner or 'Unassigned'",
    "deadline": "Deadline description or 'Not specified'"
  }
]

Do not include any markdown format tags like \`\`\`json or surrounding text. Return ONLY the raw JSON string.

Transcript:
${transcriptText}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    if (text.startsWith("```")) {
      text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsedArray = JSON.parse(text);
    if (Array.isArray(parsedArray)) {
      tasksList = parsedArray.map((t) => ({
        meetingCode,
        task: t.task || "Unnamed Task",
        assignedTo: t.assignedTo || "Unassigned",
        deadline: t.deadline || "Not specified",
        completed: false
      }));

      // Refresh database records for this meeting
      await Task.deleteMany({ meetingCode });
      if (tasksList.length > 0) {
        await Task.insertMany(tasksList);
      }
    }
  } catch (error) {
    console.error("Task extraction failed:", error);
  }

  return tasksList;
};
