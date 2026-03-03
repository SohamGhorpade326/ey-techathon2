import express from 'express';
import Product from '../models/Product.js';
import TestingMatrix from '../models/TestingMatrix.js';
import PastBid from '../models/PastBid.js';
import SkuGap from '../models/SkuGap.js';

const router = express.Router();

// GET /api/debug/db - return simple counts from main collections
router.get('/db', async (req, res) => {
  try {
    const [productCount, testingCount, pastBidCount, skuGapCount] = await Promise.all([
      Product.countDocuments().catch(() => 0),
      TestingMatrix.countDocuments().catch(() => 0),
      PastBid.countDocuments().catch(() => 0),
      SkuGap.countDocuments().catch(() => 0),
    ]);

    res.json({ productCount, testingCount, pastBidCount, skuGapCount });
  } catch (e) {
    console.error('/api/debug/db error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
