import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import productRoutes from "./routes/product.js";
import rfpRoutes from "./routes/rfps.js";
import testingMatrixRoutes from "./routes/testingMatrix.js";
import skuGapRoutes from "./routes/skuGap.routes.js";
import skuGapAIRoutes from "./routes/skuGapAI.routes.js";
import authRoutes from "./routes/auth.routes.js";
import pastBidRoutes from "./routes/pastBid.routes.js";
import { seedAdmin } from "./utils/seedAdmin.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI2;

if (!mongoUri) {
  console.error("❌ MONGO_URI is not set. Check backend/.env");
  process.exit(1);
}

const getDbNameFromMongoUri = (uri) => {
  // Matches:
  // mongodb+srv://user:pass@cluster.mongodb.net/<dbName>?...
  // mongodb://host:27017/<dbName>?...
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (!match) return null;
  const dbName = match[1]?.trim();
  return dbName ? dbName : null;
};

const mongoDbNameFromUri = getDbNameFromMongoUri(mongoUri);
const mongoDbName =
  process.env.MONGO_DB_NAME ||
  (mongoDbNameFromUri === null ? "agentic_rfp" : undefined);

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(mongoUri, mongoDbName ? { dbName: mongoDbName } : {})
  .then(() => {
    const connectedDbName = mongoose.connection?.db?.databaseName;
    const via = process.env.MONGO_URI ? "MONGO_URI" : "MONGO_URI2";
    console.log(`✅ MongoDB Connected (via ${via})${connectedDbName ? ` (db: ${connectedDbName})` : ""}`);
    seedAdmin(); // keep admin seeding
  })
  .catch((err) => console.error("Mongo Error:", err));

mongoose.connection.on("error", (err) => {
  console.error("Mongo Connection Error:", err);
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/rfps", rfpRoutes);
app.use("/api/testing-matrix", testingMatrixRoutes);
app.use("/api/sku-gap", skuGapRoutes);
app.use("/api/sku-gap/insights", skuGapAIRoutes);
app.use("/api/past-bids", pastBidRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
