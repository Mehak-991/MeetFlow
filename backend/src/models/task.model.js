import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema({
  meetingCode: { type: String, required: true },
  task: { type: String, required: true },
  assignedTo: { type: String, required: true },
  deadline: { type: String, required: true },
  completed: { type: Boolean, default: false }
});

taskSchema.index({ meetingCode: 1 });

const Task = mongoose.model("Task", taskSchema);

export { Task };
