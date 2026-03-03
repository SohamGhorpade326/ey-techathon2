import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    body: { type: String },
    message_id: { type: String },
    received_timestamp: { type: String },
    source: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
