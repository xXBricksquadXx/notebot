export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages[]' });
    }

    const apiKey = process.env.GROQ_API_KEY; // or OPENAI_API_KEY etc
    if (!apiKey)
      return res.status(500).json({ error: 'Missing server API key env var' });

    const clean = messages
      .filter(
        (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
      )
      .slice(-30);

    const upstream = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are Notebot.ai. Be concise, structured, and helpful.',
            },
            ...clean,
          ],
        }),
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res
        .status(upstream.status)
        .json({ error: 'Upstream error', detail: detail.slice(0, 1500) });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
