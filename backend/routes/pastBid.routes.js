import express from "express";
import * as pastBidController from "../controllers/pastBid.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(authorizeRoles("super_admin", "product", "technical", "pricing"));

/**
 * @route   GET /api/past-bids
 * @desc    Get all past bids from dummybid collection
 * @access  Authenticated users with appropriate roles
 */
router.get("/", pastBidController.getAllPastBids);

/**
 * @route   POST /api/past-bids
 * @desc    Manually insert a new past bid (typically 'Won' bids)
 * @access  Authenticated users with appropriate roles
 */
router.post("/", pastBidController.createPastBid);

/**
 * @route   GET /api/past-bids/stats
 * @desc    Get statistics and analytics about past bids
 * @access  Authenticated users with appropriate roles
 */
router.get("/stats", pastBidController.getPastBidStats);

export default router;
