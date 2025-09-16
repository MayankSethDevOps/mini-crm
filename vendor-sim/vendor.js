// vendor.js
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();
app.use(bodyParser.json());

app.post('/vendor/send', async (req,res) => {
  const { campaign_id, customer_id, message } = req.body;
  // simulate random
  const rnd = Math.random();
  const status = (rnd < 0.9) ? 'SENT' : 'FAILED';
  const vendorMessageId = 'vm-' + Math.random().toString(36).slice(2,9);

  // respond quickly
  res.json({ vendor_message_id: vendorMessageId, status });

  // simulate delivery receipt callback after small delay
  setTimeout(async () => {
    try {
      await fetch(`${process.env.BACKEND_BASE_URL || 'http://localhost:8000'}/api/delivery-receipt`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ vendor_message_id: vendorMessageId, status, campaign_id, customer_id })
      });
    } catch (e) {
      console.error('vendor -> backend callback failed', e);
    }
  }, 500 + Math.random() * 2000);
});

const PORT = process.env.VENDOR_PORT || 9000;
app.listen(PORT, ()=> console.log('Vendor sim on', PORT));
