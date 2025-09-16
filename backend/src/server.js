// server.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { passport, ensureAuthenticated } = require('./auth');
const amqp = require('amqplib');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

let amqpConn;
async function connectAmqp() {
  amqpConn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
}
connectAmqp().catch(console.error);

/* --- Auth routes --- */
app.get('/auth/google', passport.authenticate('google', { scope: ['profile','email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // redirect to frontend app after login
    res.redirect(process.env.FRONTEND_BASE_URL || 'http://localhost:3000');
  }
);
app.get('/auth/failure', (req,res)=> res.send('Auth failed'));

/* --- Ingestion APIs: validate & publish to queue --- */
app.post('/api/customers', async (req, res) => {
  const body = req.body;
  if (!body.email || !body.name) return res.status(400).json({error: 'name and email required'});
  const channel = await amqpConn.createChannel();
  await channel.assertQueue('ingest_customers', { durable: true });
  channel.sendToQueue('ingest_customers', Buffer.from(JSON.stringify(body)), { persistent: true });
  await channel.close();
  res.json({ status: 'queued' });
});

app.post('/api/orders', async (req, res) => {
  const body = req.body;
  if (!body.customer_email || !body.amount) return res.status(400).json({error: 'customer_email and amount required'});
  const channel = await amqpConn.createChannel();
  await channel.assertQueue('ingest_orders', { durable: true });
  channel.sendToQueue('ingest_orders', Buffer.from(JSON.stringify(body)), { persistent: true });
  await channel.close();
  res.json({ status: 'queued' });
});

/* --- Segments preview --- */
function ruleToWhereClause(rule) {
  // VERY simple translator: rule = { op: "AND"|"OR", conditions: [ { field, comparator, value } ] }
  // For production you need a safer, parameterized builder. This is illustrative.
  const parts = [];
  const params = [];
  for (const c of rule.conditions) {
    if (c.comparator === '>') { parts.push(`${c.field} > ?`); params.push(c.value); }
    else if (c.comparator === '<') { parts.push(`${c.field} < ?`); params.push(c.value); }
    else if (c.comparator === '=') { parts.push(`${c.field} = ?`); params.push(c.value); }
    else if (c.comparator === 'INACTIVE_DAYS_GT') { parts.push(`last_order_at < DATE_SUB(NOW(), INTERVAL ? DAY)`); params.push(c.value); }
    else { parts.push(`${c.field} = ?`); params.push(c.value); }
  }
  return { clause: parts.join(` ${rule.op} `), params };
}

app.post('/api/segments/preview', ensureAuthenticated, async (req, res) => {
  const rule = req.body.rule;
  const { clause, params } = ruleToWhereClause(rule);
  const sql = `SELECT COUNT(*) AS c FROM customers WHERE ${clause}`;
  const [rows] = await pool.query(sql, params);
  res.json({ audience: rows[0].c });
});

/* --- Create campaign: save campaign + enqueue job --- */
app.post('/api/campaigns', ensureAuthenticated, async (req, res) => {
  const { name, segment_id, message_template } = req.body;
  const userId = req.user.id;
  const [r] = await pool.query('INSERT INTO campaigns (name,segment_id,message_template,created_by) VALUES (?,?,?,?)', [name, segment_id, message_template, userId]);
  const campaignId = r.insertId;
  const channel = await amqpConn.createChannel();
  await channel.assertQueue('campaign_jobs', { durable: true });
  channel.sendToQueue('campaign_jobs', Buffer.from(JSON.stringify({ campaignId })), { persistent: true });
  await channel.close();
  res.json({ campaignId });
});

/* --- Delivery receipt (vendor -> backend) --- */
app.post('/api/delivery-receipt', async (req, res) => {
  const { vendor_message_id, status, campaign_id, customer_id } = req.body;
  // update communication_log
  await pool.query('UPDATE communication_log SET status=?, vendor_message_id=?, updated_at=NOW() WHERE vendor_message_id=? OR (campaign_id=? AND customer_id=?)',
    [status, vendor_message_id, vendor_message_id, campaign_id, customer_id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, ()=> console.log(`Backend listening ${PORT}`));
