const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const deploymentCounter = new client.Counter({
  name: 'deployments_total',
  help: 'Total number of deployment events recorded',
  registers: [register]
});

// Health check - liveness and readiness probe
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'metrics-service' });
});

// Prometheus scrape endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Record a deployment event
app.post('/deployments', async (req, res) => {
  const { service_name, status, version } = req.body;

  try {
    await pool.query(
      'INSERT INTO deployments (service_name, status, version, created_at) VALUES ($1, $2, $3, NOW())',
      [service_name, status, version]
    );

    deploymentCounter.inc();
    httpRequestCounter.inc({ method: 'POST', route: '/deployments', status: 201 });

    res.status(201).json({ message: 'Deployment recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record deployment' });
  }
});

// Get all deployment events
app.get('/deployments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM deployments ORDER BY created_at DESC LIMIT 50'
    );

    httpRequestCounter.inc({ method: 'GET', route: '/deployments', status: 200 });

    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

app.listen(PORT, () => {
  console.log(`Metrics Service running on port ${PORT}`);
});