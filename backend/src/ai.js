// ai.js
const OpenAI = require('openai');
require('dotenv').config();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1) Natural language -> rule JSON
async function nlToRule(nl) {
  const prompt = `
Convert the following natural language audience description into a JSON rule object.
Description: "${nl}"
Output JSON format: {"op":"AND"|"OR","conditions":[{"field":"total_spend"|"visits"|"last_order_at","comparator":">"|"="|"INACTIVE_DAYS_GT","value":number}, ...]}
Return only valid JSON.
`;
  const resp = await client.responses.create({
    model: "gpt-4o-mini", // pick available model or text-davinci-003
    input: prompt
  });
  const txt = resp.output[0].content[0].text || resp.output_text;
  // parse
  try { return JSON.parse(txt); } catch (e) { return null; }
}

// 2) Message suggestions
async function generateMessageVariants(objective, audienceSummary) {
  const prompt = `Generate 3 short personalized marketing message variants (1 line each) for objective: "${objective}" and audience: "${audienceSummary}". Output as JSON array: ["...", "...","..."]`;
  const resp = await client.responses.create({model:"gpt-4o-mini", input:prompt});
  const txt = resp.output[0].content[0].text || resp.output_text;
  try { return JSON.parse(txt); } catch (e) { return [txt]; }
}

// 3) Campaign summary
async function summarizeCampaign(stats) {
  const prompt = `Write a concise summary for campaign stats: ${JSON.stringify(stats)}. 2-3 sentences.`;
  const resp = await client.responses.create({model:"gpt-4o-mini", input:prompt});
  const txt = resp.output[0].content[0].text || resp.output_text;
  return txt;
}

module.exports = { nlToRule, generateMessageVariants, summarizeCampaign };
