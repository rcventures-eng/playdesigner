# Football Play Designer - Project Documentation

## Project Overview

A free, web-based football playbook application for amateur coaches to design, visualize, and share offensive, defensive, and special teams plays. Features drag-and-drop player positioning, route drawing, AI-powered play generation, team roster management, and Google Drive export capabilities.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: Wouter (lightweight React router)
- **State Management**: React hooks + TanStack Query
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based (express-session + connect-pg-simple)
- **AI Integration**: Google Gemini 2.0 Flash
- **External Services**: Google Drive API, Resend (email)

## Project Structure

```
├── client/src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui primitives
│   │   ├── mobile/      # Mobile-specific components
│   │   ├── PlayDesigner.tsx      # Main canvas component
│   │   ├── GoogleDriveExportModal.tsx
│   │   ├── TeamPlaysList.tsx
│   │   └── TeamRosterCard.tsx
│   ├── pages/           # Route pages
│   │   ├── home.tsx              # Landing + play designer
│   │   ├── PlayLibrary.tsx       # User's saved plays
│   │   ├── TeamPlaybooks.tsx     # Team management
│   │   ├── mobile-designer.tsx   # Mobile wizard flow
│   │   ├── admin.tsx             # Admin dashboard
│   │   └── CoachProfile.tsx      # User profile
│   ├── lib/             # Utilities
│   │   ├── renderPlayToImage.tsx # Play export rendering
│   │   ├── renderPageToImage.tsx # Roster/Splits export
│   │   └── queryClient.ts        # TanStack Query setup
│   └── hooks/           # Custom React hooks
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database operations (IStorage interface)
│   ├── google-drive.ts  # Google Drive API integration
│   ├── db.ts            # Database connection
│   └── app.ts           # Express app setup
├── shared/
│   ├── schema.ts        # Drizzle ORM models + Zod schemas
│   ├── football-config.ts  # Field dimensions, game formats
│   └── logic-dictionary.ts # AI logic reference
```

## Key Features

### 1. Play Designer Canvas
- HTML5 Canvas + SVG rendering
- Drag-and-drop player positioning
- Click-to-draw routes with curves
- Offensive/defensive/special teams modes
- Play notes (text boxes)
- Flip play horizontally
- Undo/redo (50-snapshot stack on mobile)

### 2. Team Management
- Create/edit teams with playbooks
- Roster management (coaches + players)
- Squad splits for practice groups
- Assign plays to multiple teams
- Cover image uploads

### 3. Export System
- **Local**: Download as PNG
- **Google Drive**: Export to Docs or Slides
  - Handout format (2-4 plays per page)
  - Presentation format (1-4 plays per slide)
  - Roster/Splits pages as full-page images
  - "Less Color" printer-friendly mode
  - Easter egg loading cadences during export

### 4. AI Play Creator
- Natural language → play generation
- Hand-drawn diagram interpretation
- Formation and concept suggestions

### 5. Mobile Experience (`/mobile`)
- 3-step wizard: Field → Details → Save
- Touch-optimized canvas
- Long-press player action menu
- Scroll locking during interaction

## Database Schema (Key Tables)

```typescript
users          // Authentication + profile
teams          // Team playbooks
plays          // Play designs (JSON data)
teamPlays      // Many-to-many: plays ↔ teams
teamBlankPages // Section dividers, roster pages, splits pages
coaches        // Team coaching staff
players        // Team roster
teamSplits     // Squad assignments
ai_logs        // AI generation history
```

## API Routes Pattern

All routes follow REST conventions:
- `GET /api/teams/:id/plays` - List team plays
- `POST /api/plays` - Create play
- `PATCH /api/plays/:id` - Update play
- `POST /api/teams/:id/export-to-drive` - Google Drive export

## Environment Variables

Required secrets (managed via Replit Secrets):
- `DATABASE_URL` - PostgreSQL connection
- `SESSION_SECRET` - Express session secret
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

## Development Commands

```bash
npm run dev          # Start dev server (frontend + backend)
npm run db:push      # Push schema changes to database
npm run db:push --force  # Force push (data loss warning)
```

## Key Implementation Notes

### Play Data Structure
Plays store JSON data including:
- `players[]` - Position, routes, assignments
- `notes[]` - Text boxes with x, y, width, height
- `losY` - Line of scrimmage position
- `hasPA`, `hasRPO` - Play action/RPO indicators

### Export Pipeline
1. `GoogleDriveExportModal` collects options
2. `renderPlaysToImages()` converts plays to Base64
3. `renderRosterPageToBase64()` / `renderSplitsPageToBase64()` for special pages
4. API sends to `google-drive.ts` for document creation
5. Google Docs API creates formatted document

### Less Color Mode
Export flag that renders:
- White field background (instead of green)
- Green yard lines and border
- High-contrast metatag boxes (white bg, black border)

### Database Sync
- DEV and PROD databases must have matching constraint names
- Use `npm run db:push` for schema sync
- Never manually write SQL migrations
- Check existing schema before making changes

## Testing Approach

- Playwright for E2E testing (user flows, visual verification)
- Limit: 3 attempts per feature, 5 total tests per session
- Skip Playwright for debugging; use for final validation
- Canvas interactions are timing-sensitive

## File Conventions

- Components: PascalCase (`PlayDesigner.tsx`)
- Pages: kebab-case or PascalCase (`mobile-designer.tsx`)
- Utilities: camelCase (`queryClient.ts`)
- Types: Defined in `shared/schema.ts` with Drizzle + Zod
