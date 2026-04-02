const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check - to check for the liveness and readiness of the API Gateway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// JWT validation middleware
function validateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Login route - forwards to Auth Service (no token needed)
app.use('/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
}));

// Metrics route - protected, forwards to Metrics Service
app.use('/metrics', validateToken, createProxyMiddleware({
  target: process.env.METRICS_SERVICE_URL || 'http://localhost:3002',
  changeOrigin: true,
}));

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});