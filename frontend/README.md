# Relay — WhatsApp Chat Summarizer Dashboard

Premium, sleek React + TypeScript + Tailwind dashboard for the WhatsApp Chat Summarizer backend.

- **Stack:** Vite 5, React 18, TypeScript, Tailwind CSS 3, shadcn-style UI (Radix + CVA), Lucide icons
- **Design:** warm paper neutrals + ink, solid colors only (no neon, no gradients), `rounded-2xl` cards, soft shadows, Inter + Sora type
- **Responsive:** mobile (bottom tab bar) → tablet → laptop/desktop (sidebar + multi-column)

## Run

```bash
# backend (terminal 1) — http://localhost:3000
npm run dev

# frontend (terminal 2) — http://localhost:5173 (proxies /api → :3000)
npm run dev --prefix frontend
# or from repo root:
npm run dev:frontend
```

Production: the backend serves `frontend/dist` automatically when built.

```bash
npm run build:all
npm start
# open http://localhost:3000/
```

## Configure

Copy `.env.example` → `.env`:

```ini
VITE_API_URL=        # empty = same-origin (recommended)
# VITE_API_KEY=      # only if backend sets API_KEY
```

## Views

- **Overview** — unread hero, stats, attention list, recent briefs, how-it-works
- **Chats** — search + All/Unread/Groups/Direct, detail pane with Summary/Messages tabs, adjustable message limit
- **Connect** — live QR pairing with auto-refresh, connection facts
- **System** — health, model, memory, API reference with copy buttons
