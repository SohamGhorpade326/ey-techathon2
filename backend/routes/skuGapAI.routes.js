import express from "express";
import * as skuGapAIController from "../controllers/skuGapAI.controller.js";

const router = express.Router();

// AI insights are read-only; do not require auth for GET

/**
 * @route   GET /api/sku-gap/insights
 * @desc    Generate AI-powered insights using Groq
 * @access  Public
 */
router.get("/", skuGapAIController.getAIInsights);

export default router;
