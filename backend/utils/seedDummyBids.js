// Seed script for dummybid collection
// Run this with: node backend/utils/seedDummyBids.js

import mongoose from "mongoose";
import PastBid from "../models/PastBid.js";
import dotenv from "dotenv";

dotenv.config();

const sampleBids = [
  {
    bid_id: "BID-001",
    buyer: "HPCL",
    buyer_type: "PSU",
    domain: "Cables",
    bid_value_cr: 12.5,
    status: "Won",
    pricing_strategy: "Premium",
    delivery_duration_days: 120,
    remarks: "Successfully delivered on time with quality certifications",
  },
  {
    bid_id: "BID-002",
    buyer: "BHEL",
    buyer_type: "PSU",
    domain: "Transformers",
    bid_value_cr: 25.3,
    status: "Won",
    pricing_strategy: "Competitive",
    delivery_duration_days: 180,
    remarks: "Long-term partnership outcome",
  },
  {
    bid_id: "BID-003",
    buyer: "Reliance",
    buyer_type: "Private",
    domain: "Cables",
    bid_value_cr: 8.7,
    status: "Won",
    pricing_strategy: "Value",
    delivery_duration_days: 90,
    remarks: "Fast delivery execution",
  },
  {
    bid_id: "BID-004",
    buyer: "PGCIL",
    buyer_type: "PSU",
    domain: "Switchgear",
    bid_value_cr: 18.2,
    status: "Won",
    pricing_strategy: "Premium",
    delivery_duration_days: 150,
    remarks: "Technical excellence recognized",
  },
  {
    bid_id: "BID-005",
    buyer: "MSEDCL",
    buyer_type: "PSU",
    domain: "Cables",
    bid_value_cr: 15.8,
    status: "Lost",
    pricing_strategy: "Competitive",
    delivery_duration_days: 200,
    remarks: "Price was higher than competitors",
  },
  {
    bid_id: "BID-006",
    buyer: "Tata Power",
    buyer_type: "Private",
    domain: "Transformers",
    bid_value_cr: 22.1,
    status: "Won",
    pricing_strategy: "Premium",
    delivery_duration_days: 160,
    remarks: "Strong technical proposal",
  },
  {
    bid_id: "BID-007",
    buyer: "NTPC",
    buyer_type: "PSU",
    domain: "Cables",
    bid_value_cr: 30.5,
    status: "Lost",
    pricing_strategy: "Premium",
    delivery_duration_days: 250,
    remarks: "Timeline too long, lost to faster competitor",
  },
  {
    bid_id: "BID-008",
    buyer: "BPCL",
    buyer_type: "PSU",
    domain: "Switchgear",
    bid_value_cr: 14.3,
    status: "Won",
    pricing_strategy: "Competitive",
    delivery_duration_days: 130,
    remarks: "Good balance of price and quality",
  },
  {
    bid_id: "BID-009",
    buyer: "Adani Power",
    buyer_type: "Private",
    domain: "Transformers",
    bid_value_cr: 19.7,
    status: "Won",
    pricing_strategy: "Value",
    delivery_duration_days: 140,
    remarks: "Excellent relationship building",
  },
  {
    bid_id: "BID-010",
    buyer: "IOCL",
    buyer_type: "PSU",
    domain: "Cables",
    bid_value_cr: 11.2,
    status: "Won",
    pricing_strategy: "Competitive",
    delivery_duration_days: 110,
    remarks: "Met all technical specifications",
  },
];

async function seedDummyBids() {
  try {
    // Connect to MongoDB
    const mongoDbName = process.env.MONGO_DB_NAME;
    await mongoose.connect(
      process.env.MONGO_URI,
      mongoDbName ? { dbName: mongoDbName } : {}
    );
    console.log("✅ MongoDB Connected");

    // Clear existing data (optional)
    const existingCount = await PastBid.countDocuments();
    console.log(`Found ${existingCount} existing bids`);

    if (existingCount > 0) {
      console.log("⚠️  Collection already has data. Skipping to avoid duplicates.");
      console.log("To reset, delete the collection manually and run again.");
      process.exit(0);
    }

    // Insert sample data
    await PastBid.insertMany(sampleBids);
    console.log(`✅ Successfully seeded ${sampleBids.length} dummy bids`);

    // Show statistics
    const wonCount = sampleBids.filter((b) => b.status === "Won").length;
    const lostCount = sampleBids.filter((b) => b.status === "Lost").length;
    console.log(`   - Won: ${wonCount}`);
    console.log(`   - Lost: ${lostCount}`);
    console.log(`   - Win Rate: ${((wonCount / sampleBids.length) * 100).toFixed(1)}%`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding dummy bids:", error);
    process.exit(1);
  }
}

seedDummyBids();
