import express from "express";
import * as pastBidController from "../controllers/pastBid.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();

/**
 * Public: GET /api/past-bids - return list of past bids (read-only)
 */
router.get("/", pastBidController.getAllPastBids);

// Protect mutating or stats routes
router.post("/", verifyToken, pastBidController.createPastBid);
router.get("/stats", verifyToken, pastBidController.getPastBidStats);

export default router;
