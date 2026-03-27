<h1 align="center">🐧 Nexus Wiki</h1>

<p align="center">
  <strong>The most advanced self-hosted wiki for enterprise teams.</strong><br>
  AI-powered search · Real-time collaboration · Meeting transcription · Zero licensing costs
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-BSL--1.1-blue" alt="License" />
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AI-OpenAI-412991?logo=openai&logoColor=white" alt="AI" />
  <img src="https://img.shields.io/badge/search-pgvector-336791?logo=postgresql&logoColor=white" alt="pgvector" />
</p>

---

**Nexus** replaces Confluence, competes with Notion, and runs entirely on your infrastructure. Your data never leaves your servers. Deploy in 3 commands, import your existing wiki in minutes.

## Why Nexus?

| | Nexus | Confluence | Notion | Wiki.js | Outline |
|---|:---:|:---:|:---:|:---:|:---:|
| Self-hosted | ✅ | $$$ | ❌ | ✅ | ✅ |
| AI semantic search | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI writing + translation | ✅ | ❌ | ~ | ❌ | ❌ |
| Meeting audio → notes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Real-time collaboration | ✅ | ✅ | ✅ | ❌ | ~ |
| Knowledge graph | ✅ | ❌ | ❌ | ❌ | ❌ |
| Import Confluence/Notion | ✅ | — | — | ❌ | ~ |
| Rich editor (30+ blocks) | ✅ | ✅ | ✅ | ~ | ~ |
| AI cost monitoring | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cost per user | **€0** | €5-10/mo | €8-10/mo | €0 | €0 |

---

## Quick Start

```bash
git clone https://github.com/Natsume911/nexus-wiki.git
cd nexus
cp .env.example .env    # edit with your values
docker compose up --build -d
```

Open `http://localhost:3000/wiki/` — done. Database migrations and initialization run automatically on first boot.

> Add `OPENAI_API_KEY` to `.env` to enable semantic search, AI writing, translation, and meeting transcription.

---

## Features

### 🧠 AI-Powered

**Semantic Search** — Not just keyword matching. Nexus understands questions. Ask "how do I configure the VPN?" and get the right page, not just pages containing those words. Powered by pgvector embeddings, HyDE (Hypothetical Document Embedding), query expansion, and cross-encoder reranking. Three fallback modes ensure you always find something: semantic → full-text → fuzzy.

**Writing Assistant** — Select text, click AI, choose an action: improve, fix grammar, summarize, translate, change tone, expand, shorten, simplify, explain. Powered by GPT-4o.

**Page Translation** — Translate any page to 7 languages with a live preview modal. Review the translation, then apply with one click. A version snapshot is saved before translating so you can always revert.

**Meeting Notes** — Record a meeting directly from the browser (tab audio + microphone). Works with any duration — even 21-hour calls. Whisper transcribes the audio, GPT-4o generates structured notes with participants, summary, decisions, action items, and next steps. Inserted directly into your page.

**Cost Dashboard** — Every AI API call is tracked. See total cost, tokens used, cost per service (search, translate, writing), cost per model, daily trends. All in the admin panel.

### ✏️ Rich Editor

30+ TipTap extensions in a single editor:

- **Text** — Headings, paragraphs, bold/italic/underline/strikethrough/highlight, text color, text alignment
- **Blocks** — Code blocks (53 languages with syntax highlighting), tables, blockquotes, callouts, horizontal rules, task lists
- **Advanced** — Mermaid diagrams, KaTeX math equations, expandable sections, multi-column layouts, tabs, status badges, table of contents, emoji picker
- **Media** — Image upload (paste/drag/resize), video embed (YouTube/Vimeo/Loom), file attachments
- **Navigation** — `[[` page links with search, `@` mentions with user search, `/` slash commands with 5 categories
- **Editing** — Drag handle for block reorder, custom bubble menu (theme-aware), find & replace (`Ctrl+H`), markdown paste auto-conversion
- **Collaboration** — Per-user undo/redo via Yjs UndoManager, page locking (one editor at a time)

### 🔍 Search

The search engine combines three strategies with intelligent fallback:

1. **Semantic** (primary) — pgvector HNSW index, 1536-dim embeddings, RRF fusion with full-text
2. **Full-text** (fallback) — PostgreSQL tsvector with Italian stemming
3. **Fuzzy** (last resort) — Trigram similarity for typos

Advanced features: search operators (`"phrase"`, `-exclude`, `OR`, `space:name`, `author:name`, `tag:name`, `title:word`), filter UI (space/author/tag/date dropdowns), personalized ranking (boosts favorites, watched pages, view history), attachment content search (extracts text from PDF/DOCX), "did you mean?" suggestions, autocomplete.

### 📦 Import & Export

**Import from:**
- Confluence — ZIP export with HTML→TipTap conversion, images, page hierarchy
- Notion — ZIP export (Markdown & CSV), nested pages, images
- Google Docs — HTML file
- Microsoft Word — DOCX via mammoth
- Markdown — Single files or bulk

**Export to:**
- PDF (native, via Puppeteer)
- DOCX (branded, with cover page and header/footer)
- Markdown
- HTML
- Space ZIP (all pages as Markdown with front matter)

**Confluence Auto-Sync** — Daily automated check (configurable cron) detects pages modified on Confluence and syncs attachments to Nexus. Runs at 20:30 by default.

### 🔒 Security

- **Encrypted Secrets** — SOPS + age encryption. API keys and passwords never stored in plain text
- **Security Headers** — Content-Security-Policy, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy via Helmet
- **Authentication** — OAuth2-Proxy (Azure AD, Google, Okta) or header-based auth. JWT for WebSocket
- **Authorization** — RBAC with Admin/Editor/Viewer roles. Per-space access control (open or restricted)
- **Input Sanitization** — HTML stripped from titles and comments. Parameterized SQL queries throughout
- **Path Traversal Protection** — Symlink-aware path validation on file uploads and exports
- **Audit Log** — Every mutation logged with user, IP, user-agent, action, resource, and metadata
- **Rate Limiting** — Global, per-endpoint, and per-operation limits

### 👥 Collaboration

- **Page Locking** — Automatic lock when editing. Other users see who has the lock. Lock expires after 5 minutes of inactivity
- **Presence** — See who is viewing the same page
- **Version History** — Every edit creates a version. Diff view (inline or side-by-side). Restore any version
- **Threaded Comments** — Nested replies, collapse/expand threads
- **Inline Comments** — Select text, comment on specific passages, resolve when done
- **Reactions** — 7 emoji reactions per page (🐧👍❤️🎉👀🚀💡)
- **Page Analytics** — See who viewed the page, how many times, when

### 🏢 Admin Panel

6 tabs for full control:

- **Dashboard** — Users, spaces, pages, storage stats
- **Users** — Role management, activate/deactivate, sync from external directory
- **Spaces** — Toggle open/restricted access per space
- **Audit Log** — Search, filter, paginate, export CSV
- **Backup** — Download DB dump or JSON export, restore with safety confirmation
- **AI Costs** — Token usage, cost per service/model/day, daily chart
- **Import** — Upload from Confluence/Notion/Google Docs/DOCX/Markdown with optional new space creation

### 🌍 Internationalization

3 complete locales: Italian (default), English, Albanian. 700+ translation keys covering every UI element. Architecture supports adding new languages by dropping a JSON file.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Nginx / Reverse Proxy                   │
└───────┬──────────────────┬──────────────────┬────────────────┘
        │                  │                  │
 ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
 │  Frontend   │   │   Backend   │   │ Hocuspocus  │
 │  React 18   │   │  Express    │   │  WebSocket  │
 │  Vite       │   │  Prisma 6   │   │  Collab     │
 │  :3000      │   │  :4000      │   │  :4001      │
 └─────────────┘   └──────┬──────┘   └─────────────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
      ┌──────▼──────┐ ┌──▼───┐ ┌─────▼──────┐
      │ PostgreSQL  │ │Redis │ │  Uploads   │
      │ 16 +        │ │  7   │ │  Volume    │
      │ pgvector    │ │ LRU  │ │            │
      └─────────────┘ └──────┘ └────────────┘
```

4 Docker containers · Auto-healing health checks · Zero external dependencies beyond Docker

---

## Requirements

- Docker & Docker Compose v2
- 4GB RAM minimum (8GB recommended with AI features)
- OpenAI API key (optional — all non-AI features work without it)

---

## Configuration

| Variable | Required | Description |
|----------|:--------:|-------------|
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `OPENAI_API_KEY` | | Enables AI search, writing, translation, meeting notes |
| `CORS_ORIGIN` | Production | Your domain (e.g., `https://wiki.example.com`) |
| `COLLAB_JWT_SECRET` | Production | `openssl rand -hex 32` |
| `DEV_USER_EMAIL` | Dev only | Auth bypass for local development |

### Encrypted Secrets (Production)

```bash
age-keygen > .age-key.txt
bash scripts/encrypt-env.sh     # encrypt secrets → .env.enc (committable)
bash scripts/decrypt-env.sh     # decrypt → .env.runtime (gitignored)
docker compose up --build -d
```

---

## Nginx Production Config

```nginx
location /wiki/ {
    proxy_pass http://nexus-frontend:3000/;
}
location /wiki/api/ {
    proxy_pass http://nexus-backend:4000/api/;
    client_max_body_size 2G;
}
location /wiki/collaboration {
    proxy_pass http://nexus-backend:4001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite · TailwindCSS 4 · TipTap 2.11 · Zustand · Radix UI · Framer Motion |
| Backend | Node.js 22 · Express · TypeScript · Prisma 6 · Zod validation |
| Database | PostgreSQL 16 + pgvector extension |
| Cache | Redis 7 (cache-aside, allkeys-lru, 256MB) |
| Search | Hybrid: tsvector + pgvector + pg_trgm · HyDE · RRF fusion · Cross-encoder reranking |
| AI | GPT-4o · GPT-4o-mini · Whisper · text-embedding-3-small |
| Collaboration | Hocuspocus + Yjs (CRDT) |
| Export | Puppeteer (PDF) · docx (DOCX) · archiver (ZIP) · marked (Markdown) |
| Security | Helmet · SOPS + age · JWT · express-rate-limit |
| CI | GitHub Actions — 4 parallel jobs (tests, e2e, typecheck, security) |

---

## Commands

```bash
docker compose up --build -d          # start everything
docker compose logs -f nexus-backend  # watch logs

# Reindex search after bulk import
curl -X POST http://localhost:4000/api/admin/search/reindex \
  -H 'X-Auth-Request-Email: admin@example.com'

# Manual Confluence sync
python3 scripts/confluence-sync.py

# Flush cache
docker exec nexus-redis redis-cli FLUSHALL

# Backup database
curl http://localhost:4000/api/admin/backup/db \
  -H 'X-Auth-Request-Email: admin@example.com' -o backup.dump
```

---

## License

[BSL 1.1](LICENSE) — Free to use and self-host for your own organization. If you want to offer Nexus as a commercial service to third parties, you need a commercial license. On March 28, 2030, all code converts to Apache 2.0 (fully open source).

---

<p align="center">
  Built with 🐧
</p>
