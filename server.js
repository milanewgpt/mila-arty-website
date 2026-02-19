/**
 * Local development server for Mila Arty portfolio + AI chatbot
 * Usage: npm run dev
 *
 * Requires .env file with:
 *   MINIMAX_API_KEY=your_key_here
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const handler = require('./api/chat');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Mount the chat API handler (same logic as Vercel serverless)
app.post('/api/chat', (req, res) => handler(req, res));

// Fallback: serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`🤖 Chat API at http://localhost:${PORT}/api/chat`);
  console.log(`🔑 MINIMAX_API_KEY: ${process.env.MINIMAX_API_KEY ? '✅ set' : '❌ NOT SET — add to .env'}\n`);
});
