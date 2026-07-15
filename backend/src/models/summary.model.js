import mongoose, { Schema } from "mongoose";

const summarySchema = new Schema({
  meetingCode: { type: String, required: true, unique: true },
  executiveSummary: { type: String, required: true },
  keyDiscussionPoints: { type: [String], default: [] },
  decisionsTaken: { type: [String], default: [] },
  risks: { type: [String], default: [] },
  actionItems: { type: [String], default: [] },
  deadlines: { type: [String], default: [] },
  nextSteps: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const Summary = mongoose.model("Summary", summarySchema);

export { Summary };
