# Technical Handoff Document
## Football Play Designer - AI-Native Platform

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Purpose:** Onboard new Technical Architect with comprehensive system understanding

---

## Table of Contents
1. [Project Overview & Stack](#1-project-overview--stack)
2. [Core Architecture: The 'Single Source of Truth'](#2-core-architecture-the-single-source-of-truth)
3. [The Rendering Engine (The 'Smart Scale' System)](#3-the-rendering-engine-the-smart-scale-system)
4. [The AI Pipeline (/api/generate-play)](#4-the-ai-pipeline-apigenerate-play)
5. [Database & Schema Logic](#5-database--schema-logic)
6. [Current Status & Known 'Gotchas'](#6-current-status--known-gotchas)

---

## 1. Project Overview & Stack

### Goal
Build an **AI-Native Football Play Designer** targeting youth/high school football coaches. The platform enables:
- **Text-to-Play**: Describe a play in natural language, AI generates the formation and routes
- **Image-to-Play**: Upload a hand-drawn diagram, AI interprets and digitizes it
- **Manual Design**: Traditional drag-and-drop canvas with route drawing

### Target Market
Amateur coaches (youth leagues, high school, Pop Warner) with revenue target of $100K-$500K/year by 2027.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + TypeScript | Single-page application |
| **Styling** | Tailwind CSS + shadcn/ui | Component library & design system |
| **Routing** | Wouter | Lightweight client-side routing |
| **State** | React Query (TanStack) | Server state management |
| **Backend** | Node.js + Express | API server |
| **Database** | PostgreSQL + Drizzle ORM | Data persistence |
| **AI** | Google Gemini 2.0 Flash | Play generation (text & vision) |
| **Email** | Resend | Transactional emails (welcome, password reset) |
| **Infrastructure** | Replit | Hosting, CI/CD, secrets management |

### Key Dependencies
```
@google/generative-ai  - Gemini API client
drizzle-orm            - Type-safe ORM
express-session        - Session management
connect-pg-simple      - PostgreSQL session store
bcryptjs               - Password hashing
resend                 - Email API
html-to-image          - PNG export functionality
```

---

## 2. Core Architecture: The 'Single Source of Truth'

### The Problem We Solved
AI models can "hallucinate" player positions, inventing coordinates that don't align with the rendering engine. This creates plays that look wrong or can't be rendered.

### The Solution: Shared Configuration Files

Two TypeScript files act as the **single source of truth** for both the AI and the rendering engine:

#### `shared/football-config.ts`
This file defines the **physical reality** of the football field:

```typescript
export const FOOTBALL_CONFIG = {
  field: {
    width: 694,           // Canvas width in pixels
    height: 392,          // Canvas height in pixels
    losY: 284,            // Line of scrimmage Y-coordinate
    pixelsPerYard: 12,    // Scale factor
    centerX: 347,         // Center of field
    // ... computed properties for hash marks, boundaries, etc.
  },
  colors: {
    offense: { qb: "#000000", rb: "#39ff14", ... },
    defense: { linebacker: "#87CEEB", ... },
    routes: { primary: "#ef4444", blitz: "#ef4444", ... },
  },
  positions: {
    offense: { qb: { yOffset: 1 }, rb: { yOffset: 6 }, ... },
    defense: { linebacker: { yOffset: -4 }, ... },
  }
};

export const FORMATIONS = {
  "5v5": {
    offense: {
      spread: {
        players: [
          { label: "QB", x: 347, y: 312, colorKey: "offense.qb", side: "offense" },
          // ... exact pixel coordinates for each player
        ]
      }
    }
  },
  "7v7": { ... }
};
```

**Why This Matters:** When the AI generates a "5v5 Spread" formation, it doesn't guess coordinates. It references the **exact same `FORMATIONS` object** that the canvas uses to render players.

#### `shared/logic-dictionary.ts`
This file defines the **Football IQ** - teaching the AI what football concepts mean:

```typescript
export const LOGIC_DICTIONARY = {
  offense: {
    formations: {
      "5v5 Spread": {
        rule: "Center at LOS. QB at LOS+28. RB at LOS+75. 2 Receivers split wide.",
        playerCount: 5
      },
      // ...
    },
    routeTree: {
      "Slant": {
        style: "straight",
        rule: "3 steps vertical (15px), then 45-degree cut inside toward middle.",
        depth: "short"
      },
      "Post": {
        style: "straight", 
        rule: "Run 10-12 yards vertical, 45-degree cut toward goalpost.",
        depth: "deep"
      },
      // ... all standard NFL routes
    },
    concepts: {
      "Mesh": { rule: "Two receivers cross underneath", routes: ["Drag", "Drag"] },
      "Four Verticals": { rule: "All receivers run Go routes", routes: ["Go", "Go", "Go", "Go"] },
      // ...
    }
  },
  defense: {
    formations: { ... },
    assignments: {
      "Blitz": { style: "linear", color: "routes.blitz", rule: "Red solid line to QB" },
      "Man": { style: "linear", color: "routes.man", rule: "Gray dotted line to assigned player" },
      "Zone": { style: "area", rule: "Show with zone shape" }
    }
  },
  keywords: {
    formationTriggers: ["spread", "bunch", "trips", "empty", "shotgun"],
    routeTriggers: ["flat", "slant", "out", "in", "curl", "post", "go", "wheel"],
    defenseTriggers: ["cover 1", "cover 2", "man", "zone", "blitz"]
  }
};
```

### The Critical Insight

```
┌─────────────────────────────────────────────────────────────┐
│                    AI SYSTEM PROMPT                          │
│  "Use ONLY coordinates from FORMATIONS. Do not invent."     │
│                         │                                    │
│                         ▼                                    │
│              shared/football-config.ts                       │
│                         │                                    │
│         ┌───────────────┴───────────────┐                   │
│         ▼                               ▼                   │
│   AI Generation                   Canvas Rendering          │
│   (Gemini API)                    (React Canvas)            │
│         │                               │                   │
│         └───────────────┬───────────────┘                   │
│                         ▼                                    │
│              Identical Coordinates                           │
│              No Hallucinations                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Rendering Engine (The 'Smart Scale' System)

### The Problem
Football play diagrams need to work on:
- Desktop monitors (1920x1080)
- Tablets/iPads (768x1024) - **primary target**
- Mobile phones (375x667)

But the coordinate system must remain consistent for:
- AI generation
- Drag-and-drop
- PNG export
- Database storage

### The Solution: Resolution Independence

The canvas uses a **two-layer architecture**:

#### Layer A: The Field (Scales)
```typescript
// The field has a fixed "logical" size
const LOGICAL_WIDTH = 694;
const LOGICAL_HEIGHT = 392;

// Calculate scale factor based on viewport
const scaleFactor = Math.min(
  containerWidth / LOGICAL_WIDTH,
  containerHeight / LOGICAL_HEIGHT
);

// Apply CSS transform
<div style={{ transform: `scale(${scaleFactor})` }}>
  <FieldCanvas />  {/* Always renders at 694x392 */}
</div>
```

#### Layer B: UI Overlay (Does NOT Scale)
```typescript
// Floating elements like menus, labels stay readable
<div className="absolute top-0 left-0" style={{ /* no transform */ }}>
  <PlayerContextMenu />
  <RouteEditHandles />
</div>
```

### The Mouse Correction Problem

When the field is scaled, mouse coordinates are wrong:

```
User clicks at screen position (500, 200)
But field is scaled to 0.8x
Actual logical position = (500 / 0.8, 200 / 0.8) = (625, 250)
```

**Solution: Divide by Scale Factor**

```typescript
const handleMouseMove = (e: MouseEvent) => {
  const rect = canvasRef.current.getBoundingClientRect();
  
  // Get screen coordinates
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;
  
  // Convert to logical coordinates (THE FIX)
  const logicalX = screenX / scaleFactor;
  const logicalY = screenY / scaleFactor;
  
  // Now logicalX/logicalY work correctly for drag-and-drop
};
```

### Counter-Scaling for UI Elements

Player labels need to stay readable regardless of zoom:

```typescript
// If field is scaled down, labels scale UP
const labelScale = 1 / scaleFactor;

<text 
  transform={`scale(${labelScale})`}
  style={{ fontSize: '12px' }}  // Always 12px on screen
>
  {player.label}
</text>
```

---

## 4. The AI Pipeline (/api/generate-play)

### Endpoint: `POST /api/generate-play`

### Prompt Engineering Strategy

The AI prompt has three layers:

#### 1. System Instructions (Hardcoded Rules)
```typescript
const systemPrompt = `
You are a football play designer AI. You MUST follow these rules:

COORDINATE RULES:
- Use ONLY coordinates from the provided FORMATIONS object
- NEVER invent or interpolate coordinates
- Players must be placed at exact preset positions

OUTPUT FORMAT:
Return valid JSON matching this schema:
{
  "formation": "5v5 Spread",
  "players": [...],
  "routes": [...],
  "description": "..."
}
`;
```

#### 2. Context Injection (Dynamic)
```typescript
// Inject the actual config files into the prompt
const contextPrompt = `
AVAILABLE FORMATIONS:
${JSON.stringify(FORMATIONS, null, 2)}

ROUTE DEFINITIONS:
${JSON.stringify(LOGIC_DICTIONARY.offense.routeTree, null, 2)}

DEFENSIVE ASSIGNMENTS:
${JSON.stringify(LOGIC_DICTIONARY.defense.assignments, null, 2)}
`;
```

#### 3. User Request
```typescript
const userPrompt = `
Design a play with the following requirements:
${userInput}

Game format: ${gameFormat}  // "5v5" or "7v7"
`;
```

### Multimodal Flow (Image-to-Play)

For hand-drawn diagram uploads:

```typescript
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash-exp" 
});

const result = await model.generateContent([
  systemPrompt,
  {
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64Data
    }
  },
  "Analyze this hand-drawn play diagram and convert it to our schema."
]);
```

### The 'Snap-to-Grid' Logic

**Problem:** AI might say "put QB at approximately center" → coordinates vary each time.

**Solution:** Force the AI to reference presets by name, not coordinates:

```typescript
// Instead of:
{ label: "QB", x: 345, y: 310 }  // ❌ Invented coordinates

// The AI outputs:
{ label: "QB", formation: "5v5 Spread", position: "QB" }  // ✅ Reference

// Backend resolves to actual coordinates:
const preset = FORMATIONS["5v5"].offense.spread.players.find(p => p.label === "QB");
// { x: 347, y: 312 }  // Exact from config
```

---

## 5. Database & Schema Logic

### Storage Architecture

The application uses **direct PostgreSQL access** via Drizzle ORM for all core entities (users, teams, plays, sessions). 

> **Note:** A `MemStorage` class exists in `server/storage.ts` as legacy scaffolding from the initial template. It is NOT used for production data - all routes use `db.insert()`, `db.select()`, etc. directly.

### Current Schema (`shared/schema.ts`)

```typescript
// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Plays table (RECENTLY REFACTORED)
export const plays = pgTable("plays", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),  // Required
  teamId: integer("team_id").references(() => teams.id),            // Optional
  name: text("name").notNull(),
  type: text("type").notNull(),  // "offense" | "defense" | "special"
  data: jsonb("data"),           // The full play JSON (players, routes, etc.)
  tags: text("tags").array(),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI generation logs (for debugging/analytics)
export const aiGenerationLogs = pgTable("ai_generation_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  prompt: text("prompt"),
  response: jsonb("response"),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### The Recent Refactor: User-First, Team-Optional

**Before:**
- Plays belonged to Teams
- Users had to create a Team before saving plays
- Friction in onboarding flow

**After:**
- Plays belong to Users (required `userId`)
- Teams are optional organizational layer (`teamId` nullable)
- Users can save plays immediately after signup

```
User ─────────────────────────────────────────┐
  │                                            │
  ├──► Plays (directly owned)                  │
  │      ├── My First Play                     │
  │      ├── Red Zone Concept                  │
  │      └── Goal Line Package                 │
  │                                            │
  └──► Teams (optional organization)           │
         ├── Wildcats (teamId: 1)              │
         │     └── Plays with teamId: 1        │
         └── JV Squad (teamId: 2)              │
               └── Plays with teamId: 2        │
```

### API Routes for Plays

```typescript
// Create a play (requires auth)
POST /api/plays
Body: { name, type, data?, tags?, isFavorite?, teamId? }
// userId is pulled from session, not request body
// If teamId provided, validates it belongs to current user

// Get user's plays (requires auth)
GET /api/plays?teamId=optional
// Returns all plays for authenticated user
// Optionally filtered by teamId
```

---

## 6. Current Status & Known 'Gotchas'

### Yard Line Numbers: The Rotation Logic

Broadcast-style yard numbers face **toward the end zones**, not toward the sidelines:

```
        ← 10 ────────────────── 10 →
        ← 20 ────────────────── 20 →
        ← 30 ────────────────── 30 →
        ← 40 ────────────────── 40 →
        ← 50 ────────────────── 50 →
```

**Implementation:**
```typescript
// Left side: rotate -90 degrees (face left end zone)
ctx.rotate(-Math.PI / 2);  // -90°

// Right side: rotate +90 degrees (face right end zone)
ctx.rotate(Math.PI / 2);   // +90°
```

The numbers are rendered at the TOP of the field (viewer's perspective) and rotated so the "top" of the number faces the appropriate end zone.

### AI Input Box: The 'Nuclear Option'

The AI prompt textarea needed a fixed height that wouldn't collapse. Standard Tailwind classes were overridden by component defaults.

**Solution: Inline Styles**
```tsx
<Textarea
  style={{ height: '120px', minHeight: '120px' }}  // Nuclear option
  className="resize-none ..."
/>
```

This ensures the height sticks regardless of component library defaults.

### Authentication System

**Type:** Session-based (not JWT)

**Stack:**
- `express-session` - Session middleware
- `connect-pg-simple` - PostgreSQL session store
- `bcryptjs` - Password hashing (cost factor: 10)

**Session Configuration:**
```typescript
app.use(session({
  store: new PgSession({ pool }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    sameSite: 'lax'
  }
}));
```

**Trust Proxy:** Enabled for Replit's reverse proxy (X-Forwarded-Proto).

### Email Integration (Resend)

**Triggers:**
1. **Welcome Email** - Sent on user registration
2. **Password Reset** - Sent via "Forgot Password" flow

**Security:**
- Password reset links use `APP_BASE_URL` environment variable
- Never trust `Host` header for link generation
- Tokens expire after 1 hour
- Tokens are single-use (marked `used: true` after consumption)

**Template Location:** `server/resend.ts`

### Admin Dashboard

**Access Control:**
- Route: `/admin`
- Requires both:
  1. Valid session (logged in)
  2. `isAdmin: true` flag on user record

**Current Admin Accounts:**
- ben.carroll1108@gmail.com
- ray@raymcarroll.com

**Features:**
- View/edit AI Logic Dictionary
- View formation presets
- Access AI generation logs
- Manage users / resend welcome emails

---

## Quick Reference: File Locations

| Purpose | File |
|---------|------|
| Database schema | `shared/schema.ts` |
| Football config | `shared/football-config.ts` |
| AI logic dictionary | `shared/logic-dictionary.ts` |
| API routes | `server/routes.ts` |
| Auth middleware | `server/app.ts` |
| Email templates | `server/resend.ts` |
| Canvas component | `client/src/components/PlayCanvas.tsx` |
| AI play generator | `client/src/components/AIPlayCreator.tsx` |
| Top navigation | `client/src/components/TopNav.tsx` |

---

## Questions?

This document provides the foundation for understanding the Football Play Designer architecture. For specific implementation details, refer to the `replit.md` file and inline code comments.

**Key Contacts:**
- Ben Carroll - ben.carroll1108@gmail.com
- Ray Carroll - ray@raymcarroll.com
