import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
  name:     { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email:    { type: String, default: null },   // optional email field
  token:    { type: String }
});

const User = mongoose.model("User", userSchema);

export { User };
