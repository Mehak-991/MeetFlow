import mongoose, { Schema } from "mongoose";

const transcriptSchema = new Schema({
  meetingCode: { type: String, required: true },
  speaker: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  embedding: { type: [Number], default: [] }
});

// Index meetingCode for faster lookups
transcriptSchema.index({ meetingCode: 1 });

const Transcript = mongoose.model("Transcript", transcriptSchema);

export { Transcript };
