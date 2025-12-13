export default async function handler(req, res) {
  // Optional: enable CORS if you plan to call this from CodePen (different origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY on server' });
  }

  // Vercel may give req.body already parsed; handle both
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  const incoming = body?.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }

  // IMPORTANT: strip extras like `ts`
  const messages = incoming
    .map((m) => ({ role: m?.role, content: m?.content }))
    .filter(
      (m) =>
        typeof m.role === 'string' &&
        typeof m.content === 'string' &&
        m.content.trim()
    );

  const model = body?.model || 'llama3-70b-8192';

  const upstream = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
      }),
    }
  );

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return res.status(upstream.status).json({
      error: data?.error?.message || 'Groq request failed',
    });
  }

  const content = data?.choices?.[0]?.message?.content || '';
  return res.status(200).json({ content });
}
