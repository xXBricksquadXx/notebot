// api/chat.js (ESM)
export default async function handler(req, res) {
  // CORS (only matters if you call this cross-origin, e.g. CodePen)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: 'Missing GROQ_API_KEY on server' });

  // Normalize body (object|string|buffer)
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const incoming = body?.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }

  const messages = incoming.map((m) => ({ role: m.role, content: m.content }));
  const model = body?.model || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || 'Upstream (Groq) error',
        upstream: data,
      });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res
        .status(502)
        .json({ error: 'No content in Groq response', upstream: data });
    }

    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
