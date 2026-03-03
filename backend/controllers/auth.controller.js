import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create user (super_admin only)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const validRoles = ["super_admin", "sales", "technical", "pricing", "product"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = new User({
      name,
      email,
      password,
      role,
      isActive: true,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Sync/upsert a Clerk user into local Users collection and return app JWT
export const syncClerkUser = async (req, res) => {
  try {
    const { clerk_user_id, email } = req.body || {};
    if (!clerk_user_id) return res.status(400).json({ message: 'clerk_user_id required' });

    const clerkApiKey = process.env.CLERK_API_KEY;
    if (!clerkApiKey) return res.status(500).json({ message: 'CLERK_API_KEY not configured' });

    // Fetch user info from Clerk server to verify
    const userResp = await fetch(`https://api.clerk.dev/v1/users/${clerk_user_id}`, {
      headers: { Authorization: `Bearer ${clerkApiKey}` }
    });
    if (!userResp.ok) return res.status(502).json({ message: 'Failed to fetch user from Clerk', detail: await userResp.text() });
    const clerkUser = await userResp.json();

    // Derive email and name from Clerk response. If Clerk returns no email (rare),
    // fallback to a synthetic email using the clerk id to avoid Mongoose validation errors.
    const derivedEmail = (clerkUser.primary_email_address && clerkUser.primary_email_address.email)
      || (clerkUser.email_addresses && clerkUser.email_addresses[0] && clerkUser.email_addresses[0].email)
      || clerkUser.email || '';
    const userEmail = (email || derivedEmail || `${clerk_user_id}@clerk.local`).toLowerCase();
    const name = clerkUser.full_name || clerkUser.first_name || userEmail;

    // Upsert user in local DB. Use default 'pending' role if none.
    const randomPassword = Math.random().toString(36).slice(2);
    let user = await User.findOne({ email: userEmail });
    if (!user) {
      user = new User({ name, email: userEmail, password: randomPassword, role: 'pending', isActive: true });
      await user.save();
    } else {
      // update name if missing
      if (!user.name && name) { user.name = name; await user.save(); }
    }

    const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error('syncClerkUser error', e);
    res.status(500).json({ message: 'Server error' });
  }
};
