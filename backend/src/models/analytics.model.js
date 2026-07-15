import mongoose, { Schema } from "mongoose";

const analyticsSchema = new Schema({
  meetingCode: { type: String, required: true, unique: true },
  duration: { type: Number, default: 0 }, // in seconds
  attendanceRate: { type: Number, default: 100 }, // percentage
  meetingScore: { type: Number, default: 0 },
  participationScore: { type: Number, default: 0 },
  sentimentTrend: { type: [String], default: [] }, // array of sentiment values e.g., ["Positive", "Neutral"]
  frequentlyDiscussed: { type: [String], default: [] },
  participants: [
    {
      username: { type: String, required: true },
      speakingTime: { type: Number, default: 0 }, // in seconds
      speakingTurns: { type: Number, default: 0 },
      questionsAsked: { type: Number, default: 0 }
    }
  ]
});

const Analytics = mongoose.model("Analytics", analyticsSchema);

export { Analytics };
