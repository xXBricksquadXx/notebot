<img width="1536" height="1024" alt="notebot" src="https://github.com/user-attachments/assets/0635ad9f-3c15-439c-8360-caf54dcc4cf9" />

---
Vanilla HTML/CSS/JS notes app with Markdown, tags, pin/archive, export, and an AI chatbot powered by a Vercel serverless proxy to Groq.

<img width="1919" height="1199" alt="Screenshot 2025-12-13 134212" src="https://github.com/user-attachments/assets/2d09936c-4d00-450b-86f8-4d785e11679d" />
<br>
<img width="1918" height="1199" alt="Screenshot 2025-12-13 133115" src="https://github.com/user-attachments/assets/4a24735c-9f8c-4486-9b1b-5041512ffd51" />

## Live Demo

https://notebot-ten.vercel.app/

## Features

- Notes CRUD (stored in localStorage)
- Markdown editor + preview (Marked + highlight.js)
- Pin / archive workflow
- Tags + search
- Export note to `.md` or `.txt`
- AI Chatbot
  - Simulated mode (works anywhere)
  - Serverless mode (`/api/chat`) using Groq
- Save AI replies (or full chat) into Notes

## Tech

- Static frontend: `index.html`, `styles.css`, `app.js`
- Serverless: `api/chat.js` (Groq OpenAI-compatible endpoint)
- Deployed on Vercel

## Local Development

```bash
git clone https://github.com/xXBricksquadXx/notebot
cd notebot
npm i -D vercel
vercel dev
```

> Open: http://localhost:3000

# Environment Variables

Set these in Vercel Project Settings (and locally in `.env.local` for `vercel dev`):

- `GROQ_API_KEY` (required)
- `GROQ_MODEL` (optional) default: `llama-3.1-8b-instant`

Example `.env.local`:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant

```

> Do not commit `.env*` files. Keep them in `.gitignore`.

# Deployment

- Import the GitHub repo in Vercel, or:

```bash
vercel --prod

```

## License
MIT

# Roadmap

- Better chat-to-note UX (select text → save)
- “Save transcript” formatting options
- Note sync/storage beyond localStorage
