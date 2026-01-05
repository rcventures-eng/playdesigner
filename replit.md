# Football Play Designer

## Overview

The Football Play Designer is a free, web-based, single-page application for amateur coaches to create and visualize offensive, defensive, and special teams plays. It offers a drag-and-drop canvas for player positioning and route drawing, with export capabilities. The project aims to provide an accessible, efficient, and AI-enhanced play design experience for grassroots football, enabling users to visualize, share, and generate strategic plays.

## User Preferences

Preferred communication style: Simple, everyday language.

### Playwright Testing Guardrails

To avoid excessive costs from repeated test failures:
-   **3 attempts max** for any single feature/bug - if it fails 3 times with similar errors, stop and reassess
-   **5 total tests** per session before pausing to ask if user wants to continue
-   **Skip Playwright for debugging** - use it for verification after a fix is confirmed working
-   **Better debugging approach**: Trace code flow by reading files first, check logs, fix the issue, then run one Playwright test to confirm
-   **When to use Playwright**: Final validation, user-facing flows, visual verification
-   **When NOT to use Playwright**: Debugging pointer/canvas interactions (timing-sensitive), hunting for root cause, simple code changes

## System Architecture

### Frontend

The frontend is a React and TypeScript application built with Vite, utilizing shadcn/ui and Tailwind CSS for design. State management uses React hooks, and Wouter handles client-side routing. The design system supports custom theming and dark mode.

### Canvas and Drawing System

The core play design functionality uses HTML5 Canvas and SVG. Key features include configurable field elements, drag-and-drop player positioning, click-to-draw routes with advanced editing, resolution independence, and distinct rendering for offensive and defensive players. It also supports defensive assignments (Blitz, Man, Zone), play notes (movable text annotations), and export to downloadable PNGs. The "Flip Play" feature mirrors plays horizontally for strategic variations.

### AI Play Creator

The AI Beta tab leverages Google Gemini 2.0 Flash to generate plays from natural language descriptions or hand-drawn diagrams (image uploads). It includes visual enhancements and validates inferred play characteristics and defensive routes. A shared `LOGIC_DICTIONARY` and `SITUATIONAL_TAGS` define AI strategies and contextual play tagging.

### Backend

The backend is an Express.js and TypeScript application, providing API routes for AI play generation, user authentication, team and play management.

### Data Storage

Drizzle ORM with PostgreSQL is used for data management across entities like `users`, `teams`, `plays`, and `ai_logs`.

### Team Management

The system supports comprehensive team management, including:
-   **Team Playbook Management**: Create, edit, and manage team playbooks, associate plays, and upload cover images. Plays can be assigned to multiple teams via a junction table.
-   **Team Roster Management**: Add/edit/delete coaches and players, import rosters via CSV or AI-powered image parsing, and store data in dedicated `teamCoaches` and `teamPlayers` tables.
-   **Team Splits (Squad Assignments)**: Organize players into two squads for practice planning, with visual indicators and assignment management, stored in a `teamSplits` table.

### Google Drive Export

Users can connect their personal Google Drive accounts via OAuth 2.0 to export team playbooks. Exports support Google Docs (handout format, 2 plays per page with metadata) and Google Slides (one play per slide). The system handles play selection, reordering, and secure token storage.

**Single Play Export to Drive**: Users can export individual plays directly to Google Drive from the Play Designer. The feature uses a 3-state flow: (1) unauthenticated users see a sign-up modal, (2) authenticated users without Drive connection are redirected to OAuth, (3) connected users can upload directly. The button shows dynamic text based on state and displays a success link with the file name after upload.

### Play Management Features

Plays can be archived (`isArchived` flag) instead of deleted, with dedicated views and authorization. A global template system allows admins to share public starter plays, tracking origins via `clonedFromId`.

### Authentication

Session-based authentication uses `express-session` with `connect-pg-simple` and `bcryptjs` for registration, login, logout, and user info. The UI adapts based on authentication and user roles (e.g., admin).

### User Profile and Admin Dashboard

A `/profile` page allows users to manage their avatar and preferences. An `/admin` dashboard provides protected access for managing AI Logic, formation presets, AI logs, and user accounts.

### Mobile Wizard Workflow

The `/mobile` route provides a separate 3-step mobile-optimized experience for designing plays on touch devices:

1. **Step 1 (Field)**: Game format selection (5v5, 7v7, 9v9, 11v11) + touch-friendly canvas with player positioning and AI mode integration
2. **Step 2 (Details)**: Play naming, situation tags, and concept tags with a mini preview
3. **Step 3 (Save)**: Export options including download as image, save to library (authenticated users), and team playbook integration

Key mobile components in `client/src/components/mobile/`:
- `MobilePlayDesigner.tsx`: Main container orchestrating the wizard flow
- `MobileCanvas.tsx`: Touch-optimized canvas with simplified controls, player-colored routes, and motion route styling
- `FormatSelector.tsx`: Initial format selection overlay
- `AIPromptOverlay.tsx`: AI play generation with voice input (uses shadcn Dialog, centered modal on tablets, full-screen on phones)
- `PlayDetailsForm.tsx`: Play metadata form
- `SaveExportPanel.tsx`: Auth-aware save/export options
- `WizardNavigation.tsx`: Bottom tab bar navigation with compact wizard tabs and tool buttons (Undo, Screenshot, Share)
- `OrientationPrompt.tsx`: Landscape orientation prompt

**Mobile Touch Isolation:**
- Aggressive scroll locking during player drag and route drawing via `lockAllScroll()`/`unlockAllScroll()` helpers
- Disables overflow and touch-action on document.body and documentElement during interactions
- Unlocks on pointerUp, pointerCancel, or component unmount
- Visual feedback: amber border on dragged players, green indicator during route drawing

**Mobile Undo/Redo System:**
- 50-snapshot undo stack tracking player positions and routes
- Uses functional setDraft pattern to avoid stale closure bugs
- Snapshots captured before each player drag or route drawing starts
- Exposed via `pushToUndoStack()`, `undo()`, and `canUndo` from `usePlayDraft` hook

**Mobile Export Features:**
- **Screenshot**: Uses `html-to-image` (toPng) to capture canvas as downloadable PNG with 2x pixel ratio
- **Share**: Uses Web Share API with file sharing for iOS native share sheet, falls back to download when unavailable

**Mobile Route Rendering Features:**
- Routes render in player-specific colors (Z=blue, Y=yellow, X=red, RB=green, QB=black) via `route.color` property
- Curved routes use Catmull-Rom style bezier smoothing for continuous curves
- Motion routes show dotted line pre-snap (below LOS) and solid line post-snap (above LOS)
- Route endpoints show arrowhead only (no filled dot indicator)
- Route drawing preview uses active player's color

**Mobile Player Action Menu:**
- Long-press on player opens bottom sheet menu with Pass/Run/Block (offense) or Blitz/Man/Zone (defense)
- Pass routes: Menu stays open to show Straight/Curved style options, Motion/Primary checkboxes
- Run/Block/Defense: Immediately starts drawing and closes menu
- Orange highlighting (#f97316) for selected options
- Green "Draw Route" CTA button for Pass routes
- Tapping outside auto-starts drawing with current selections

**Mobile Clear Play Feature:**
- "Clear Play" button with Trash2 icon in bottom toolbar
- First press: Clears routes, shapes, notes, footballs (keeps formation)
- Second press: Removes formation entirely, shows format selector
- Pushes to undo stack before clearing for undo parity

**Mobile User Profile Menu:**
- Shows "Hey Coach {name}" with avatar when logged in
- Dropdown includes: Build Plays (active), grayed items with 🚧, Log Out
- Click outside closes dropdown

Custom hooks in `client/src/hooks/`:
- `useMobileDetection.ts`: Detects mobile/tablet devices
- `useOrientation.ts`: Tracks device orientation
- `usePlayDraft.ts`: Session persistence via sessionStorage, undo history management

### UI/UX Patterns

The application uses progressive disclosure for play tag details, displaying only essential fields initially and revealing advanced options upon user interaction. A fixed-width right sidebar provides guided instructions and "Pro Tips." The Play Library page (`/plays`) offers a gallery view with filters and sorting, allowing both authenticated and unauthenticated users to browse public templates.

## External Dependencies

-   **UI/Design**: Radix UI, shadcn/ui, Lucide React, class-variance-authority, Tailwind CSS.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit, node-postgres.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Carousel/Modals**: embla-carousel-react, vaul.