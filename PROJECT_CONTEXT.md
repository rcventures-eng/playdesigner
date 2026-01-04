# Flag Football App Project Context Document

**Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Author:** Ray Carroll  
**Replit Project URL:** https://replit.com/@raycarroll/football-play-designer

---

## 1. Project Overview

### Purpose and Goals
The Football Play Designer is a free, web-based application designed for amateur coaches to create, visualize, and share offensive, defensive, and special teams plays. The tool aims to democratize play design for grassroots football by providing an accessible, efficient, and AI-enhanced experience.

### Current State
**Status:** Production-ready, actively deployed at rc-football.com

**What's Working:**
- Complete play designer with drag-and-drop canvas
- AI play generation from text descriptions and image uploads (Google Gemini 2.0 Flash)
- User authentication with session management
- Team playbooks with play assignment and ordering
- Team roster management (coaches and players)
- Splits feature for practice squad assignments
- Google Drive export (Docs and Slides)
- Play Library with public templates and user's personal plays
- Play archiving, cloning, and flip functionality
- Admin dashboard for AI logic management
- Password reset via email

**Known Issues/Technical Debt:**
- Port 5000 occasionally conflicts require workflow restart
- MemStorage interface in storage.ts is legacy (actual app uses PostgreSQL via Drizzle)

---

## 2. System Architecture

### Architecture Diagram (Text-Based)
```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React + Vite)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PlayDesigner │  │  PlayLibrary │  │  TeamPlaybooks│              │
│  │   (Canvas)    │  │   (Gallery)  │  │    (CRUD)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ CoachProfile │  │    Admin     │  │  GoogleDrive │              │
│  │   (Settings) │  │  (Dashboard) │  │ ExportModal  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                          │                                           │
│                    TanStack Query                                    │
└────────────────────────────┼────────────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────┼────────────────────────────────────────┐
│                      SERVER (Express.js)                             │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │                     routes.ts                              │       │
│  │  - /api/plays (CRUD)        - /api/teams (CRUD)           │       │
│  │  - /api/generate-play (AI)  - /api/auth/* (session)       │       │
│  │  - /api/google-drive/*      - /api/admin/*                │       │
│  └──────────────────────────────────────────────────────────┘       │
│       │                    │                      │                  │
│  ┌────▼─────┐     ┌───────▼───────┐    ┌────────▼────────┐         │
│  │ Drizzle  │     │ Google Gemini │    │ Google Drive API│         │
│  │   ORM    │     │  2.0 Flash    │    │    (OAuth 2.0)  │         │
│  └────┬─────┘     └───────────────┘    └─────────────────┘         │
└───────┼─────────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────────┐
│                    PostgreSQL (Neon)                                │
│   users │ teams │ plays │ playTeams │ teamCoaches │ teamPlayers   │
│   teamSplits │ aiGenerationLogs │ passwordResetTokens │ aiLogs    │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **Play Creation:** User drags players on canvas → Routes drawn → State saved in React → POST to /api/plays → Drizzle inserts to PostgreSQL
2. **AI Generation:** User types prompt or uploads image → POST to /api/generate-play → Gemini API → Response parsed, players/routes remapped → Rendered on canvas
3. **Google Drive Export:** OAuth flow → User selects plays → Server generates Docs/Slides via Google APIs → Returns file URL

### Key Patterns
- **MVC-like separation:** Frontend React components (View), Express routes (Controller), Drizzle/PostgreSQL (Model)
- **State Management:** React hooks (useState, useEffect) + TanStack Query for server state
- **Progressive Disclosure:** Complex UI elements reveal advanced options on interaction

---

## 3. File Structure

```
football-play-designer/
├── client/                          # Frontend React application
│   ├── public/
│   │   └── favicon.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components (40+ files)
│   │   │   ├── PlayDesigner.tsx     # Main canvas component (~3000 lines)
│   │   │   ├── PlayPreview.tsx      # Thumbnail renderer for gallery
│   │   │   ├── GoogleDriveExportModal.tsx
│   │   │   ├── SignUpModal.tsx
│   │   │   ├── TagPopover.tsx       # Play tagging (concept, situation)
│   │   │   ├── TeamPlaysList.tsx    # Reorderable play list
│   │   │   ├── TeamRosterCard.tsx   # Coaches/players management
│   │   │   └── TopNav.tsx           # Navigation header
│   │   ├── hooks/
│   │   │   ├── use-mobile.tsx
│   │   │   └── use-toast.ts
│   │   ├── lib/
│   │   │   ├── queryClient.ts       # TanStack Query config
│   │   │   ├── renderPlayToImage.tsx # Export play as PNG
│   │   │   └── utils.ts             # cn() helper
│   │   ├── pages/
│   │   │   ├── home.tsx             # Landing + PlayDesigner
│   │   │   ├── PlayLibrary.tsx      # Gallery view of plays
│   │   │   ├── TeamPlaybooks.tsx    # Team management
│   │   │   ├── CoachProfile.tsx     # User settings
│   │   │   ├── admin.tsx            # Admin dashboard
│   │   │   ├── reset-password.tsx
│   │   │   └── not-found.tsx
│   │   ├── utils/
│   │   │   ├── format-logic.ts      # Formation parsing
│   │   │   └── snap-math.ts         # Grid snapping calculations
│   │   ├── App.tsx                  # Router + providers
│   │   ├── index.css                # Tailwind + custom styles
│   │   └── main.tsx                 # Entry point
│   └── index.html
├── server/
│   ├── app.ts                       # Express app setup
│   ├── routes.ts                    # All API endpoints (~3000 lines)
│   ├── db.ts                        # Drizzle PostgreSQL connection
│   ├── storage.ts                   # IStorage interface (legacy)
│   ├── google-drive.ts              # Google Drive OAuth + export
│   ├── resend.ts                    # Email service for password reset
│   ├── index-dev.ts                 # Development entry
│   └── index-prod.ts                # Production entry
├── shared/
│   ├── schema.ts                    # Drizzle table definitions + Zod schemas
│   ├── football-config.ts           # Field dimensions, colors, formations
│   └── logic-dictionary.ts          # AI formation/route rules
├── attached_assets/                 # User uploads, screenshots
├── design_guidelines.md             # UI/UX design system
├── TECHNICAL_HANDOFF.md             # Previous handoff document
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── drizzle.config.ts
├── tsconfig.json
└── replit.md                        # Project summary for agents
```

---

## 4. Code Breakdown

### Database Schema (shared/schema.ts)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | id (UUID), email, password, isAdmin, googleDriveTokens |
| `teams` | Coach's team playbooks | id (serial), ownerId, name, year, gameFormat, coverImageUrl |
| `plays` | Individual play designs | id (serial), userId, name, type, data (JSONB), isPublic, isArchived, clonedFromId |
| `playTeams` | Many-to-many: plays ↔ teams | playId, teamId, displayOrder |
| `teamCoaches` | Coaching staff roster | teamId, firstName, lastName, role |
| `teamPlayers` | Player roster | teamId, firstName, lastName, position1, position2, defPosition1 |
| `teamSplits` | Squad assignments | teamId, playerId, squadName ("Squad 1" or "Squad 2") |
| `aiGenerationLogs` | AI generation history | prompt, hasImage, status, previewJson, rating |
| `passwordResetTokens` | Password reset flow | userId, token, expiresAt |
| `featureRequests` | User feedback | userType, featureDescription, useCase |

### Play Data Structure (JSONB in plays.data)
```typescript
{
  players: [
    { id: string, label: string, x: number, y: number, color: string, side: "offense"|"defense" }
  ],
  routes: [
    { id: string, playerId: string, points: [{x,y}], style: "straight"|"curved", 
      routeType?: "blitz"|"man"|"zone", isPrimary?: boolean, isMotion?: boolean }
  ],
  shapes: [
    { id: string, playerId?: string, type: "oval", x: number, y: number, 
      width: number, height: number, color: string }
  ],
  footballs: [
    { id: string, x: number, y: number, hasPlayAction?: boolean }
  ],
  playNotes: [
    { id: string, text: string, x: number, y: number, backgroundColor: string }
  ],
  mechanics?: { hasPlayAction: boolean, preSnapMotion: boolean }
}
```

### Key Components

**PlayDesigner.tsx (~3000 lines)**
- HTML5 Canvas rendering with React state
- Drag-and-drop player positioning with magnetic grid snapping
- Click-to-draw routes with Bezier curve support
- Defensive assignments (Blitz/Man/Zone)
- Play Notes (movable text annotations)
- Export to PNG via html-to-image
- AI Beta tab for Gemini integration
- Flip Play feature (horizontal mirror)

**PlayLibrary.tsx**
- Gallery grid of all plays (user's + public templates)
- Filtering by type (Offense/Defense/Special Teams)
- Sorting (newest, alphabetical)
- Clone/Flip quick actions on cards
- Progressive disclosure for play tags

**TeamPlaybooks.tsx**
- CRUD for teams with cover images
- Drag-and-drop play reordering
- Roster management (coaches + players)
- Splits for practice squad assignment
- Google Drive export (Docs/Slides)

### API Endpoints (server/routes.ts)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/plays` | GET/POST | List/create plays |
| `/api/plays/:id` | GET/PATCH/DELETE | Play CRUD |
| `/api/plays/:id/flip` | POST | Create flipped copy |
| `/api/teams` | GET/POST | Team management |
| `/api/teams/:id/plays` | GET/POST/PUT | Team playbook |
| `/api/teams/:id/coaches` | GET/POST/DELETE | Coaching staff |
| `/api/teams/:id/players` | GET/POST/DELETE | Player roster |
| `/api/teams/:id/splits` | GET/POST | Squad assignments |
| `/api/generate-play` | POST | AI play generation |
| `/api/public/templates` | GET | Public play library |
| `/api/register` | POST | User registration |
| `/api/login` | POST | Session login |
| `/api/logout` | POST | Session logout |
| `/api/user` | GET | Current user info |
| `/api/google/auth` | GET | OAuth initiation |
| `/api/google/callback` | GET | OAuth callback |
| `/api/google/drive/export` | POST | Export to Drive |
| `/api/admin/*` | Various | Admin-only routes |

---

## 5. Dependencies and Setup

### Dependencies (package.json)

**Core:**
- react, react-dom (18.3.1)
- express (4.21.2)
- drizzle-orm, drizzle-zod
- @neondatabase/serverless
- zod (3.24.2)

**AI/External:**
- @google/generative-ai (0.24.1) - Gemini API
- googleapis (148.0.0) - Drive API
- resend (4.0.0) - Email

**UI:**
- Radix UI (all primitives)
- shadcn/ui components
- lucide-react, tailwindcss, tailwind-merge
- framer-motion

**Forms/State:**
- @tanstack/react-query (5.60.5)
- react-hook-form, @hookform/resolvers

**Build:**
- vite (5.4.20), esbuild
- typescript (5.6.3)
- tsx (dev runner)

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `SESSION_SECRET` | Express session encryption key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `AI_INTEGRATIONS_GOOGLE_GEMINI_API_KEY` | Gemini API key |
| `RESEND_API_KEY` | Resend email API key |

### Run Commands

```bash
# Development
npm run dev        # Starts Express + Vite dev server on port 5000

# Production Build
npm run build      # Vite build + esbuild server bundle
npm run start      # Runs production server

# Database
npm run db:push    # Push Drizzle schema to PostgreSQL
npm run db:push --force  # Force push (caution: may drop data)

# Type Check
npm run check
```

---

## 6. Domain-Specific Details

### Game Formats Supported
- 5v5, 7v7, 9v9, 11v11

### Offensive Positions (by format)
- **5v5:** QB, RB, X, Y, Z
- **7v7:** + C, H (H-Back)
- **9v9:** + FB, TE, OL
- **11v11:** Full line (LT, LG, C, RG, RT) + TE

### Defensive Positions
- **5v5:** LB, CB, S, RUSH
- **7v7:** + FS, SS
- **9v9:** + DL, DE, DT, MLB, OLB
- **11v11:** Full scheme (DE, DT, NT, OLB, ILB, CB, FS, SS, NB, DB)

### Route Tree (from logic-dictionary.ts)
Short: Flat, Slant, Drag
Medium: Out, In, Curl, Crosser
Deep: Comeback, Corner, Post, Go, Wheel, Seam

### Defensive Assignments
- **Blitz:** Red arrow, rushes QB
- **Man:** Gray arrow, follows receiver
- **Zone:** Cyan arrow + purple/blue oval shape

### Color Coding
| Element | Color |
|---------|-------|
| QB | Black (#000000) |
| RB | Neon Green (#39ff14) |
| Y/Slot | Yellow (#eab308) |
| TE | Orange (#f97316) |
| Z Receiver | Blue (#1d4ed8) |
| X Receiver | Red (#ef4444) |
| Defense Linemen | Pink (#FFB6C1) |
| Linebackers | Light Blue (#87CEEB) |
| Secondary | Purple (#9333ea) |
| Primary Route | Red (#ef4444) |
| Zone Coverage | Purple/Light Blue ovals |

### AI Play Generation Rules
- Gemini 2.0 Flash processes both text prompts and uploaded images
- LOGIC_DICTIONARY enforces formation rules and route definitions
- SITUATIONAL_TAGS: Red Zone, 3rd & Long, Goal Line, etc.
- Zone shapes automatically generated for defensive coverages

---

## 7. Guidelines for Continuation

### Coding Standards
- TypeScript strict mode
- React functional components with hooks
- Zod for all API validation
- TanStack Query for data fetching (never raw fetch)
- shadcn/ui components preferred over custom

### Testing Approach
- Playwright for E2E (use sparingly - 3 attempts max per feature)
- Debug by reading logs first, fix, then verify with single test
- Use `data-testid` attributes on all interactive elements

### Common Patterns
```typescript
// API mutation with cache invalidation
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/endpoint', { method: 'POST', body: data }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/endpoint'] })
});

// Form with Zod validation
const form = useForm({
  resolver: zodResolver(insertSchema),
  defaultValues: { ... }
});
```

### Adding New Features
1. Define schema in `shared/schema.ts`
2. Add API endpoints in `server/routes.ts`
3. Create/update React components in `client/src/`
4. Follow progressive disclosure for complex UIs
5. Add appropriate `data-testid` attributes

### LLM Prompts for Extension
- "Based on this context, add a feature to export plays as PDF handouts"
- "Analyze the PlayDesigner component and suggest performance optimizations"
- "Add a new defensive coverage type called 'Tampa 2' to the logic dictionary"
- "Implement real-time collaboration using WebSockets"

---

## 8. Version History and Notes

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 4, 2026 | Initial comprehensive documentation |

### Author Notes
- Development database and production database are SEPARATE - data does not sync
- Global Library plays must be created directly in production (rc-football.com) with admin account
- Admin account: ray@raymcarroll.com
- Design system documented in `design_guidelines.md`
- Previous technical handoff in `TECHNICAL_HANDOFF.md`

### Links
- **Production:** https://rc-football.com
- **Replit:** https://replit.com/@raycarroll/football-play-designer
