const jwt = require("jsonwebtoken");

// Protects routes: the login token is stored in an httpOnly cookie,
// so JavaScript in the browser cannot read or steal it.
module.exports = function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id };
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
};
