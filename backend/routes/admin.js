import express from "express";
import Notification from "../models/Notification.js";
import axios from "axios";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// POST /request-access - public
router.post("/request-access", async (req, res) => {
  try {
    const { clerk_user_id, email } = req.body || {};
    if (!clerk_user_id) return res.status(400).json({ message: "clerk_user_id required" });

    const notif = new Notification({
      id: clerk_user_id + "-" + Date.now(),
      type: "pending_approval",
      title: "New access request",
      description: email || clerk_user_id,
      body: `User ${clerk_user_id} requested access (email: ${email})`,
      message_id: clerk_user_id,
      received_timestamp: new Date().toISOString(),
      source: "request_access",
      read: false,
    });

    await notif.save();
    return res.json({ status: "ok", stored: "mongodb" });
  } catch (e) {
    console.error("/request-access error", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /notifications - return newest first
router.get("/notifications", async (req, res) => {
  try {
    const docs = await Notification.find({}).sort({ received_timestamp: -1 }).limit(200).lean();
    res.json(docs);
  } catch (e) {
    console.error("/notifications error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /admin/pending-users - returns pending request_access notifications
router.get("/admin/pending-users", async (req, res) => {
  try {
    const docs = await Notification.find({ type: "pending_approval" }).sort({ received_timestamp: -1 }).lean();
    res.json(docs.map(d => ({ clerk_user_id: d.message_id, email: d.description, received_at: d.received_timestamp })));
  } catch (e) {
    console.error("/admin/pending-users error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /notifications/:id - remove a notification (authenticated)
router.delete('/notifications/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'id required' });
    const r = await Notification.deleteOne({ id });
    if (r.deletedCount === 0) return res.status(404).json({ message: 'Not found' });
    return res.json({ status: 'deleted' });
  } catch (e) {
    console.error('/notifications delete error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /admin/approve-user - body { clerk_user_id, role }
router.post("/admin/approve-user", async (req, res) => {
  try {
    const { clerk_user_id, role } = req.body || {};
    if (!clerk_user_id || !role) return res.status(400).json({ message: "clerk_user_id and role required" });

    const clerkApiKey = process.env.CLERK_API_KEY || process.env.CLERK_SERVER_KEY;
    if (!clerkApiKey) return res.status(500).json({ message: "CLERK_API_KEY not configured" });

    // Normalize incoming role to canonical enum values used by local User model
    const mapRole = (r) => {
      if (!r) return r;
      const v = String(r).toLowerCase().trim();
      if (["super_admin","superadmin","super admin","super-admin"].includes(v.replace(/[_\-\s]/g, ''))) return 'super_admin';
      if (v.includes('product')) return 'product';
      if (v.includes('pricing')) return 'pricing';
      if (v.includes('technical')) return 'technical';
      if (v.includes('sales')) return 'sales';
      return v;
    };

    const canonicalRole = mapRole(role);

    const url = `https://api.clerk.dev/v1/users/${clerk_user_id}`;
    const payload = { public_metadata: { role: canonicalRole } };
    const headers = { Authorization: `Bearer ${clerkApiKey}`, "Content-Type": "application/json" };

    const r = await axios.patch(url, payload, { headers, timeout: 10000 });
    if (r.status >= 400) return res.status(502).json({ message: "Clerk API error", detail: r.data });

    // Add a notification for the approved user
    try {
      const notif = new Notification({
        id: clerk_user_id + "-approved-" + Date.now(),
        type: "success",
        title: "Your account was approved",
        description: `Role assigned: ${canonicalRole}`,
        body: `Your account has been approved and assigned role ${canonicalRole}.`,
        message_id: clerk_user_id,
        received_timestamp: new Date().toISOString(),
        source: "system",
        read: false,
      });
      await notif.save();
    } catch (e) {
      console.warn("Failed to insert approval notification", e);
    }

    // Also update (or create) local User record with the approved role using Clerk user email
    try {
      // r.data should contain the updated Clerk user object
      const clerkUser = r.data;
      const email = clerkUser.primary_email_address?.email || (clerkUser.email_addresses && clerkUser.email_addresses[0]?.email) || clerkUser.email;
      if (email) {
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
          existing.role = canonicalRole;
          await existing.save();
        } else {
          // create a minimal local user so verifyToken will work for them
          const randomPassword = Math.random().toString(36).slice(2);
          const newUser = new User({ name: clerkUser.full_name || email, email: email.toLowerCase(), password: randomPassword, role: canonicalRole, isActive: true });
          await newUser.save();
        }
      }
    } catch (e) {
      console.warn('Failed to update local User after approval', e);
    }

    res.json({ status: "ok" });
  } catch (e) {
    console.error("/admin/approve-user error", e.response ? e.response.data : e);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

