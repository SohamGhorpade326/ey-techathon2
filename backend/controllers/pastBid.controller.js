import PastBid from "../models/PastBid.js";

/**
 * GET /api/past-bids
 * Returns all past bids from the dummybid collection
 */
export const getAllPastBids = async (req, res) => {
  try {
    const bids = await PastBid.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: bids.length,
      data: bids,
    });
  } catch (error) {
    console.error("Error in getAllPastBids:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch past bids",
      error: error.message,
    });
  }
};

/**
 * POST /api/past-bids
 * Allows manual insertion of a new 'Won' bid
 */
export const createPastBid = async (req, res) => {
  try {
    const {
      bid_id,
      buyer,
      buyer_type,
      domain,
      bid_value_cr,
      status,
      pricing_strategy,
      delivery_duration_days,
      remarks,
    } = req.body;

    // Validate required fields
    if (!bid_id || !buyer || !buyer_type || !domain || !bid_value_cr || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: bid_id, buyer, buyer_type, domain, bid_value_cr, status",
      });
    }

    // Check if bid_id already exists
    const existingBid = await PastBid.findOne({ bid_id });
    if (existingBid) {
      return res.status(409).json({
        success: false,
        message: `Bid with ID ${bid_id} already exists`,
      });
    }

    const newBid = new PastBid({
      bid_id,
      buyer,
      buyer_type,
      domain,
      bid_value_cr,
      status,
      pricing_strategy,
      delivery_duration_days,
      remarks,
    });

    await newBid.save();

    res.status(201).json({
      success: true,
      message: "Past bid added successfully",
      data: newBid,
    });
  } catch (error) {
    console.error("Error in createPastBid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create past bid",
      error: error.message,
    });
  }
};

/**
 * GET /api/past-bids/stats
 * Returns statistics about past bids (win rate, domain breakdown, etc.)
 */
export const getPastBidStats = async (req, res) => {
  try {
    const stats = await PastBid.aggregate([
      {
        $facet: {
          totalBids: [{ $count: "count" }],
          wonBids: [
            { $match: { status: "Won" } },
            { $count: "count" },
          ],
          lostBids: [
            { $match: { status: "Lost" } },
            { $count: "count" },
          ],
          byDomain: [
            {
              $group: {
                _id: "$domain",
                total: { $sum: 1 },
                won: {
                  $sum: { $cond: [{ $eq: ["$status", "Won"] }, 1, 0] },
                },
                lost: {
                  $sum: { $cond: [{ $eq: ["$status", "Lost"] }, 1, 0] },
                },
                avgValue: { $avg: "$bid_value_cr" },
              },
            },
          ],
          byBuyerType: [
            {
              $group: {
                _id: "$buyer_type",
                total: { $sum: 1 },
                won: {
                  $sum: { $cond: [{ $eq: ["$status", "Won"] }, 1, 0] },
                },
                avgValue: { $avg: "$bid_value_cr" },
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0];
    const totalCount = result.totalBids[0]?.count || 0;
    const wonCount = result.wonBids[0]?.count || 0;
    const lostCount = result.lostBids[0]?.count || 0;

    res.json({
      success: true,
      data: {
        total_bids: totalCount,
        won_bids: wonCount,
        lost_bids: lostCount,
        win_rate: totalCount > 0 ? ((wonCount / totalCount) * 100).toFixed(2) : 0,
        by_domain: result.byDomain,
        by_buyer_type: result.byBuyerType,
      },
    });
  } catch (error) {
    console.error("Error in getPastBidStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch past bid statistics",
      error: error.message,
    });
  }
};
