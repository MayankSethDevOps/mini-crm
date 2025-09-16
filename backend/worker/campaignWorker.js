// campaignWorker.js
const amqp = require('amqplib');
const pool = require('../src/db');
const fetch = require('node-fetch');
require('dotenv').config();

async function start() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const ch = await conn.createChannel();
  await ch.assertQueue('campaign_jobs', { durable: true });

  ch.consume('campaign_jobs', async (msg) => {
    const { campaignId } = JSON.parse(msg.content.toString());
    try {
      // fetch campaign and segment
      const [crows] = await pool.query('SELECT * FROM campaigns WHERE id=?', [campaignId]);
      if (!crows.length) { ch.ack(msg); return; }
      const campaign = crows[0];
      const [srows] = await pool.query('SELECT * FROM segments WHERE id=?', [campaign.segment_id]);
      const segment = srows[0];
      const rule = JSON.parse(segment.rule_json);

      // translate rule to SQL (reuse same translator used in server)
      function ruleToWhere(rule) {
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

      const { clause, params } = ruleToWhere(rule);
      const [custs] = await pool.query(`SELECT * FROM customers WHERE ${clause}`, params);

      // update campaign audience_size
      await pool.query('UPDATE campaigns SET audience_size=?, status=? WHERE id=?', [custs.length, 'SENT', campaignId]);

      for (const customer of custs) {
        // personalize message
        const message = campaign.message_template.replace('{{name}}', customer.name || '');
        // call vendor
        const resp = await fetch(`${process.env.VENDOR_BASE_URL || 'http://localhost:9000'}/vendor/send`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({campaign_id: campaignId, customer_id: customer.id, message})
        });
        const vendorRes = await resp.json();
        // insert communication_log
        await pool.query('INSERT INTO communication_log (campaign_id, customer_id, destination, message, status, vendor_message_id) VALUES (?,?,?,?,?,?)',
          [campaignId, customer.id, customer.phone || customer.email, message, vendorRes.status || 'PENDING', vendorRes.vendor_message_id || null]);
      }

      ch.ack(msg);
    } catch (err) {
      console.error('Campaign worker error', err);
      ch.nack(msg, false, false);
    }
  }, { noAck: false });
}

start().catch(console.error);

