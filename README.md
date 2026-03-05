# ◆ STAGECRAFT

**Real-time collaborative theater production script manager.**

Stagecraft is a web application that gives theater production teams a shared, live-editing environment for script annotation, cue management, and department-specific views — all in one place.

---

## Features

### Role-Based Views
Each team member sees only what's relevant to their department:

| Role | What They See |
|------|---------------|
| **Stage Manager** | Full script with ALL cue types — the master view |
| **Director** | Full script with blocking, lighting, sound, props, and set cues |
| **Actor** | Clean script with blocking notes only |
| **Lighting Operator** | Script + dedicated LX cue sheet sidebar |
| **Sound Operator** | Script + dedicated SND cue sheet sidebar |
| **Set Designer** | Stage directions + set change cue sidebar |
| **Props Master** | Stage directions + props cue sidebar |

### Cue System
- Color-coded cue badges inline with script text (LX, SND, PROP, SET, BLK, PROJ, FLY, SPOT)
- Cue status workflow: **Draft → Review → Approved → Locked**
- Cue timing fields: duration, pre-wait, auto-follow
- Fractional cue numbering (insert cue 1.5 between 1 and 2)
- Role-based permissions (lighting designers can only create LX cues, etc.)

### Operator Cue Panels
For operator roles (Lighting, Sound, Props, Set Design):
- Dedicated **cue sheet sidebar** showing only their cues in order
- **Scroll-linked highlighting**: as you scroll the script, cues in the sidebar light up when their associated line is visible
- **Click-to-navigate**: click any cue in the sidebar to jump to that moment in the script
- Live status indicators (green dot = cue's section is currently on screen)

### Real-Time Collaboration
- **Live cursors and presence** — see who else is editing
- **Instant sync** — changes propagate to all connected clients via WebSocket
- Built on [Yjs](https://yjs.dev/) CRDT for conflict-free concurrent editing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) |
| Real-time | [Yjs](https://yjs.dev/) + [y-websocket](https://github.com/yjs/y-websocket) |
| Auth | [NextAuth.js](https://next-auth.js.org/) (Google, GitHub, demo credentials) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + custom design system |
| Fonts | Playfair Display, Libre Baskerville, DM Mono |

---

## Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** database (local or hosted)
- **npm** or **yarn**

### 1. Clone and Install

```bash
git clone <your-repo-url> stagecraft
cd stagecraft
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/stagecraft"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret"
```

Generate a secret: `openssl rand -base64 32`

### 3. Set Up Database

```bash
# Push schema to your database
npx prisma db push

# (Optional) Seed demo data
node prisma/seed.js
```

### 4. Run Development Servers

```bash
# Start both Next.js and WebSocket server concurrently
npm run dev
```

Or run them separately:

```bash
# Terminal 1 — Next.js
npm run dev:next

# Terminal 2 — WebSocket server for real-time collaboration
npm run dev:ws
```

### 5. Open in Browser

Navigate to **http://localhost:3000**

To try the demo, click **"Demo Login (Stage Manager)"** and then visit the seeded project.

---

## Project Structure

```
stagecraft/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js                # Demo data seeder
├── server/
│   └── ws-server.js           # Yjs WebSocket server
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── projects/route.ts
│   │   │   ├── projects/[id]/route.ts
│   │   │   └── cues/route.ts
│   │   ├── project/[id]/page.tsx    # Main editor page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                 # Dashboard
│   ├── components/
│   │   ├── CueBadge.tsx             # Inline cue indicator
│   │   ├── CueEditor.tsx            # Create/edit cue modal
│   │   ├── CueSidePanel.tsx         # Operator cue sheet sidebar
│   │   ├── Header.tsx               # Top bar with presence
│   │   ├── Providers.tsx            # Auth session provider
│   │   ├── RoleSwitcher.tsx         # Role view tabs
│   │   ├── ScriptLine.tsx           # Individual script line
│   │   └── ScriptView.tsx           # Main script scroll area
│   ├── hooks/
│   │   └── useYjs.ts               # Real-time sync hook
│   ├── lib/
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── cue-types.ts            # Cue type definitions
│   │   ├── prisma.ts               # DB client singleton
│   │   ├── roles.ts                # Role configurations
│   │   └── store.ts                # Zustand global state
│   └── types/
│       └── index.ts                # TypeScript types
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Database Schema

The core entities:

- **Project** — A production (e.g., "The Evening Hour")
- **ProjectMember** — Links users to projects with a role
- **Scene** — Act + scene with sort order
- **ScriptLine** — Individual lines (dialogue, stage directions, etc.)
- **Cue** — Attached to a script line, typed (LX, SND, PROP...), with status workflow
- **Comment** — Threaded notes on cues or pages

Run `npx prisma studio` to browse your data visually.

---

## Authentication

Stagecraft supports three auth methods:

1. **Google OAuth** — Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. **GitHub OAuth** — Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
3. **Demo Credentials** — Auto-creates users, good for development

To add OAuth providers, create credentials at:
- Google: https://console.cloud.google.com/apis/credentials
- GitHub: https://github.com/settings/developers

---

## Deployment

### Vercel + Railway/Supabase

1. Deploy the Next.js app to **Vercel**
2. Host PostgreSQL on **Railway**, **Supabase**, or **Neon**
3. Deploy the WebSocket server to **Railway** or **Fly.io** (needs persistent connections)

```bash
# Build for production
npm run build
npm start

# WebSocket server (separate process)
npm run start:ws
```

### Environment Variables for Production

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="production-secret"
NEXT_PUBLIC_WS_URL="wss://your-ws-server.fly.dev"
```

---

## Extending Stagecraft

### Adding New Cue Types

1. Add the type to the `CueType` enum in `prisma/schema.prisma`
2. Add configuration in `src/lib/cue-types.ts`
3. Map it to the appropriate role in `src/lib/roles.ts`
4. Run `npx prisma db push`

### Adding New Roles

1. Add to the `ProjectRole` enum in `prisma/schema.prisma`
2. Add configuration in `src/lib/roles.ts` with visible cue types
3. Run `npx prisma db push`

### Future Enhancements

- **PDF export** per role (actors get clean scripts, operators get annotated versions)
- **GO button mode** for live performance cue calling
- **Version history** with rollback
- **Script import** from Final Draft (.fdx) and PDF
- **Mobile companion app** for backstage reference
- **Rehearsal notes** per scene with photo attachments
- **Conflict detection** for overlapping cues

---

## License

MIT — use freely for your productions.
