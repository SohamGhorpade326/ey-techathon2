export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const normalize = (r) => String(r || '').toLowerCase().replace(/[_\s]/g, '');
    const allowedNorm = allowedRoles.map(normalize);
    const userRoleNorm = normalize(req.user.role);

    if (!allowedNorm.includes(userRoleNorm)) {
      return res.status(403).json({ 
        message: "Access denied. Insufficient permissions.",
        requiredRoles: allowedRoles,
        userRole: req.user.role 
      });
    }

    next();
  };
};
