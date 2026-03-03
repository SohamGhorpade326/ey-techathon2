import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// Public endpoint to fetch SKU list (lightweight fields)
router.get("/", async (req, res) => {
  try {
    // Project a wider set of possible SKU/name fields to be robust to different schemas
    const projection = {
      sku_code: 1,
      skuCode: 1,
      product_name: 1,
      productName: 1,
      name: 1,
      title: 1,
      code: 1,
    };
    const products = await Product.find({}, projection).limit(2000);
    console.log(`[publicSkus] returning ${products.length} docs`);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// alternate path for debugging
router.get("/list", async (req, res) => {
  try {
    const projection = { sku_code: 1, skuCode: 1, product_name: 1, productName: 1, name: 1, title: 1, code: 1 };
    const products = await Product.find({}, projection).limit(2000);
    console.log(`[publicSkus:list] returning ${products.length} docs`);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
