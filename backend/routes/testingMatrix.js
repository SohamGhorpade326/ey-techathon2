import express from "express";
import TestingMatrix from "../models/TestingMatrix.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();

// GET ALL (public read)
router.get("/", async (req, res) => {
  try {
    const data = await TestingMatrix.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// CREATE (protected)
router.post("/", verifyToken, async (req, res) => {
  const item = new TestingMatrix(req.body);
  await item.save();
  res.json(item);
});

// UPDATE (protected)
router.put("/:id", verifyToken, async (req, res) => {
  const updated = await TestingMatrix.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

// DELETE (protected)
router.delete("/:id", verifyToken, async (req, res) => {
  await TestingMatrix.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
