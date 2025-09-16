// consumer.js
const amqp = require('amqplib');
const pool = require('../src/db');
require('dotenv').config();

async function start() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const ch = await conn.createChannel();
  await ch.assertQueue('ingest_customers', { durable: true });
  await ch.assertQueue('ingest_orders', { durable: true });

  const customerBuffer = [];

  // consume customers
  ch.consume('ingest_customers', msg => {
    const data = JSON.parse(msg.content.toString());
    customerBuffer.push(data);
    ch.ack(msg);
  });

  // consume orders separately and write immediately (or buffer similarly)
  ch.consume('ingest_orders', async msg => {
    const data = JSON.parse(msg.content.toString());
    try {
      // link customer by email or create if not exists
      const [rows] = await pool.query('SELECT id FROM customers WHERE email=?', [data.customer_email]);
      let customerId;
      if (rows.length) customerId = rows[0].id;
      else {
        const [r] = await pool.query('INSERT INTO customers (name,email,total_spend,visits) VALUES (?,?,?,?)', [data.customer_name||'', data.customer_email, data.amount, 1]);
        customerId = r.insertId;
      }
      await pool.query('INSERT INTO orders (customer_id,amount,created_at) VALUES (?,?,?)', [customerId, data.amount, new Date()]);
      await pool.query('UPDATE customers SET total_spend = total_spend + ?, visits = visits + 1, last_order_at = ? WHERE id=?', [data.amount, new Date(), customerId]);
      ch.ack(msg);
    } catch (e) {
      console.error('Order consume err', e);
      // optionally requeue
      ch.nack(msg, false, false);
    }
  });

  // every 5 seconds flush customerBuffer as a batch
  setInterval(async () => {
    if (customerBuffer.length === 0) return;
    const buffer = customerBuffer.splice(0);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const c of buffer) {
        // upsert by email
        await conn.query('INSERT INTO customers (name,email,phone,country,total_spend,visits,last_order_at) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), phone=VALUES(phone), country=VALUES(country), total_spend = total_spend + VALUES(total_spend)', [c.name,c.email,c.phone,c.country,c.total_spend||0,c.visits||0,c.last_order_at||null]);
      }
      await conn.commit();
      conn.release();
      console.log('Flushed', buffer.length, 'customers');
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error('Batch insert err', err);
    }
  }, 5000);
}
start().catch(console.error);
