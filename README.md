# mini-crm
# Mini CRM — Xeno SDE Internship

## Overview
Mini CRM platform with: ingestion APIs (async), a campaign builder UI (dynamic rule builder), campaign delivery & logging, Google OAuth, and AI-powered features (NL->rules and message suggestions).

## Quickstart (local)
1. Copy .env.example to .env and fill variables.
2. Start infra: `docker-compose up --build`
3. Run DB migrations: `mysql -u root -p < sql/schema.sql`
4. Optional seed: `node backend/seed.js`
5. Start workers:
   - `node backend/worker/consumer.js`
   - `node backend/worker/campaignWorker.js`
6. Visit frontend http://localhost:3000 and backend http://localhost:8000
