import mongoose from "mongoose";

const pastBidSchema = new mongoose.Schema(
  {
    bid_id: {
      type: String,
      required: true,
      unique: true,
    },
    buyer: {
      type: String,
      required: true,
    },
    buyer_type: {
      type: String,
      enum: ['PSU', 'Private'],
      required: true,
    },
    domain: {
      type: String,
      required: true,
    },
    bid_value_cr: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Won', 'Lost'],
      required: true,
    },
    pricing_strategy: {
      type: String,
    },
    delivery_duration_days: {
      type: Number,
    },
    remarks: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Point to existing 'dummybid' collection
export default mongoose.model("PastBid", pastBidSchema, "dummybid");
