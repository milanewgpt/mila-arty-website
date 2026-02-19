/**
 * Vercel Serverless Function — /api/chat
 * AI Chatbot for Mila Arty portfolio site
 *
 * ENV variables required:
 *   MINIMAX_API_KEY  — MiniMax API key (set in Vercel dashboard)
 *   KNOWLEDGE        — optional override for knowledge base
 */

const KNOWLEDGE_BASE = `
# Mila Arty — Web3 Ambassador

## About
Mila Arty is a Web3 Ambassador dedicated to promoting blockchain technology and decentralized solutions.
She has a deep understanding of cryptocurrency, NFTs, DeFi, and DAOs, and helps bridge the knowledge gap
between complex Web3 concepts and everyday users.

## Mission
Educate and empower communities about the transformative potential of blockchain technology.
She organizes workshops, creates educational content, and collaborates with innovative Web3 projects
to drive mainstream adoption and understanding.

## Skills & Expertise
- Blockchain Technology: Deep understanding of blockchain fundamentals, consensus mechanisms, and distributed ledger technology
- NFTs & Digital Assets: Expertise in NFT ecosystems, marketplaces, and the future of digital ownership
- DeFi Protocols: Knowledge of decentralized finance, yield farming, liquidity pools, and DeFi governance
- Community Building: Building and nurturing engaged Web3 communities through education, events, and authentic connections
- Web3 Education: Creating accessible content and workshops to onboard newcomers into the decentralized web ecosystem
- Project Collaboration: Partnering with innovative Web3 projects to drive adoption, growth, and community engagement

## Contact
- Email: mila.arty@example.com
- GitHub: https://github.com/milaarty
- LinkedIn: https://linkedin.com/in/milaarty
- Telegram: https://t.me/milaarty
- Twitter: https://twitter.com/milaarty

## Languages
English (primary), open to international collaboration
`;

const SYSTEM_PROMPT = `You are Mila's AI Assistant — a helpful assistant on Mila Arty's personal Web3 portfolio website.

RULES:
1. Answer ONLY based on the information provided below about Mila Arty
2. Do NOT invent prices, services, or facts not mentioned
3. If you don't know something — say "I don't have that information, but you can contact Mila directly at mila.arty@example.com"
4. Be friendly, concise, and professional
5. Respond in the same language the user writes in (English or Russian)
6. Keep answers under 150 words unless more detail is specifically requested

Knowledge base:
${process.env.KNOWLEDGE || KNOWLEDGE_BASE}`;

function log(level, message, data) {
  const ts = new Date().toISOString();
  const entry = { ts, level, message, ...(data || {}) };
  if (level === 'ERROR') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

async function callMiniMax(message, apiKey) {
  log('INFO', 'Calling MiniMax API', { messageLength: message.length });

  // Use OpenAI-compatible format (MiniMax standard)
  const requestBody = {
    model: 'MiniMax-Text-01',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ],
    max_tokens: 500,
    temperature: 0.7
  };

  log('DEBUG', 'Request body', { model: requestBody.model, max_tokens: requestBody.max_tokens });

  // Trim key to remove any accidental newlines
  const cleanKey = apiKey.trim();

  const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  log('INFO', 'MiniMax API response received', {
    status: response.status,
    statusText: response.statusText
  });

  const data = await response.json();

  if (!response.ok) {
    log('ERROR', 'MiniMax API error', { status: response.status, data });
    throw new Error(`MiniMax API error ${response.status}: ${JSON.stringify(data)}`);
  }

  log('DEBUG', 'MiniMax response data', {
    finishReason: data.choices?.[0]?.finish_reason,
    totalTokens: data.usage?.total_tokens
  });

  // OpenAI-compatible response format
  // MiniMax returns base_resp.status_code 1008 = insufficient balance
  if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
    log('ERROR', 'MiniMax base_resp error', { status_code: data.base_resp.status_code, status_msg: data.base_resp.status_msg });
    throw new Error(`MiniMax error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    log('ERROR', 'Empty content in MiniMax response', { data });
    throw new Error('Empty response from MiniMax API');
  }

  log('INFO', 'MiniMax API call successful', { responseLength: content.length });
  return content;
}

module.exports = async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 9);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    log('WARN', 'Method not allowed', { requestId, method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  log('INFO', 'Chat request received', { requestId });

  // Check API key
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    log('ERROR', 'MINIMAX_API_KEY not set', { requestId });
    return res.status(500).json({
      error: 'Server configuration error: MINIMAX_API_KEY is not set'
    });
  }

  // Validate request body
  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    log('WARN', 'Invalid request: missing message', { requestId });
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.length > 1000) {
    log('WARN', 'Message too long', { requestId, length: message.length });
    return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
  }

  log('INFO', 'Processing message', { requestId, messageLength: message.trim().length });

  try {
    const startTime = Date.now();
    const response = await callMiniMax(message.trim(), apiKey);
    const duration = Date.now() - startTime;

    log('INFO', 'Request completed successfully', { requestId, duration });
    return res.status(200).json({ response });

  } catch (err) {
    log('ERROR', 'Request failed', { requestId, error: err.message, stack: err.stack });
    return res.status(500).json({
      error: 'Failed to get AI response',
      details: err.message
    });
  }
};
