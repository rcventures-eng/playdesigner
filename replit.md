# Football Play Designer

## Overview

The Football Play Designer is a free, web-based, single-page application for amateur coaches to create and visualize offensive, defensive, and special teams plays. It offers a drag-and-drop canvas for player positioning and route drawing, with export capabilities. The project aims to provide an accessible, efficient, and AI-enhanced play design experience for grassroots football, enabling users to visualize, share, and generate strategic plays.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React and TypeScript application built with Vite, utilizing shadcn/ui and Tailwind CSS for design. State management uses React hooks, and Wouter handles client-side routing. The design system supports custom theming and dark mode.

### Canvas and Drawing System

The core play design functionality uses HTML5 Canvas and SVG. Features include:
-   **Field Elements**: Configurable field elements (line of scrimmage, yard lines, hash marks), draggable football, and play-action marker.
-   **Player & Route Interaction**: Drag-and-drop for players, click-to-draw for routes, and comprehensive player interactions via a long-press menu. Routes shift with players, and advanced route editing includes control handles and undo checkpoints.
-   **Resolution Independence**: Responsive scaling ensures consistent coordinate handling across devices.
-   **Player Rendering**: Differentiates offensive (filled circles) and defensive (X shapes) players.
-   **Defensive Assignments**: Supports advanced assignments like Blitz, Man Coverage (linked to offensive players), and Zone Coverage (resizable shapes).
-   **Export Functionality**: Generates downloadable PNGs of the canvas content.

### AI Play Creator

The AI Beta tab features an AI Play Creator powered by Google Gemini 2.0 Flash.
-   **Input**: Generates plays from natural language descriptions or hand-drawn diagrams (via image uploads).
-   **Visual Enhancements**: Includes a SportsCenter-style scrolling ticker for suggestion chips.
-   **Backend Validation**: Infers play characteristics (`isPrimary`, `isMotion`) and validates defensive routes.

### Shared Configuration

`shared/football-config.ts` acts as a single source of truth for design parameters and game logic. `shared/logic-dictionary.ts` provides a `LOGIC_DICTIONARY` for AI Play Creator, defining strategies and route patterns, and `SITUATIONAL_TAGS` for format-specific play tagging.

### Situational Tagging System

Supports dynamic situational tagging for plays based on game format (e.g., 5v5, 11v11), with options like "Open Field," "Red Zone," and "Goal Line." Tags are integrated into AI prompts for contextual generation.

### Backend

The backend uses Express.js with TypeScript, providing API routes for AI play generation, user authentication, team management, and play management.

### Data Storage

Drizzle ORM with PostgreSQL manages data for `users`, `teams`, `plays`, `ai_logs`, and other related entities. The `plays` table links to users and optionally to teams.

### Team Playbook Management

Allows users to create, edit, and manage team playbooks, including uploading cover images and associating plays with teams. The `play_teams` junction table enables many-to-many relationships, allowing a single play to be assigned to multiple team playbooks simultaneously.

### Team Roster Management

The Team Roster feature allows coaches to manage their coaching staff and players for each team playbook:
-   **Coaching Staff Section**: Add/edit/delete coaches with First Name, Last Name, and Role (Head Coach, Assistant, Offensive Coordinator, Defensive Coordinator, Volunteer)
-   **Players Section**: Add/edit/delete players with First Name, Last Name, Position 1, Position 2, Defensive Position, and up to 4 Main Colors (comma-separated)
-   **Upload Options**: Import rosters via CSV file or screenshot image (uses Gemini AI for OCR parsing)
-   **Preview Modal**: Review parsed data before confirming import
-   **Database Tables**: `teamCoaches` and `teamPlayers` with proper foreign key relationships to teams
-   **API Endpoints**:
    -   GET/POST/PATCH/DELETE `/api/teams/:teamId/coaches` - Coach CRUD operations
    -   GET/POST/PATCH/DELETE `/api/teams/:teamId/players` - Player CRUD operations
    -   POST `/api/teams/:teamId/roster/import` - Bulk import coaches and players
    -   POST `/api/teams/:teamId/roster/parse-image` - AI-powered image parsing
-   **UI Component**: `TeamRosterCard.tsx` displays below team cover image on Team Playbooks page
-   **Design**: Uses shadcn Card components with white background, gray borders, and comprehensive data-testid coverage for testing

### Team Splits (Squad Assignments)

The Splits section allows coaches to organize players into two squads for practice planning:
-   **Squad 1 and Squad 2**: Two side-by-side squads displayed in a grid layout
-   **Player Assignment**: Assign up to 6 players per squad from the roster via dropdown selection
-   **Visual Indicators**: Shows player name, positions (offensive/defensive), and color badges
-   **Remove Players**: X button to remove players from a squad
-   **Unassigned Players**: Only players not already assigned to a squad appear in the dropdown
-   **Database Table**: `teamSplits` with foreign keys to `teams` and `teamPlayers` (cascade delete)
-   **API Endpoints**:
    -   GET `/api/teams/:teamId/splits` - Get all squad assignments with player info
    -   POST `/api/teams/:teamId/splits` - Add player to a squad (validates 6-player limit)
    -   DELETE `/api/teams/:teamId/splits/:splitId` - Remove player from squad
-   **Use Case**: Helps coaches plan how to divide players if the full roster shows up for practice

### Google Drive Export (All Users)

Coaches can connect their personal Google Drive accounts and export team playbooks:
-   **Per-User OAuth**: Each coach connects their own Google Drive via OAuth 2.0 flow
-   **Export Modal**: Accessible via "Sync to Drive" button on Team Playbooks page (`/playbooks`)
-   **Formats**: Google Docs (handout format with 2 plays per page) and Google Slides (one play per slide)
-   **Play Selection**: Choose which plays to include in export with select all/deselect all options
-   **Drag-and-Drop Reordering**: Plays can be reordered in the export modal before exporting
-   **Connect/Disconnect**: Users can manage their Google Drive connection from the export modal
-   **Token Storage**: OAuth tokens stored securely in user's `googleDriveTokens` column with automatic refresh
-   **Google Docs Formatting**:
    -   Cover page: Team Name → Cover Image (if available) → Year → Total Plays (all centered)
    -   Play images render with metadata header (name, formation, concept, situation) - no separate text labels
    -   2 plays per page layout with proper spacing and page breaks
    -   Images rendered at high quality (2x pixel ratio, 468 PT width)
-   **Play Image Rendering**: `PlaySVGForExport` component renders metadata boxes in header (matching Play Designer appearance)
-   **API Endpoints**: 
    -   `GET /api/google-drive/status` - Check user's connection status
    -   `GET /api/auth/google-drive/authorize` - Start OAuth flow
    -   `GET /api/auth/google-drive/callback` - OAuth callback with CSRF protection
    -   `POST /api/google-drive/disconnect` - Disconnect user's Google Drive
    -   `POST /api/teams/:teamId/export-to-drive` - Export playbook (team owner only)
    -   `GET /api/teams/:teamId/plays-for-export` - Get plays for export modal (includes situation field)
-   **Security**: State parameter validated against session to prevent CSRF attacks
-   **Files**: `server/google-drive.ts` (service), `client/src/components/GoogleDriveExportModal.tsx` (UI), `client/src/lib/renderPlayToImage.tsx` (image rendering)

### Play-Team Assignment

The TagPopover component includes a "Team Playbooks" section that allows users to:
-   Assign plays to multiple team playbooks via checkbox toggles
-   View all their team playbooks with assignment status
-   "Create your first Team Playbook" link when no playbooks exist
-   API endpoints: GET/POST/DELETE `/api/plays/:id/teams/:teamId` with owner/admin authorization

### Play Archiving System

Plays can be archived (`isArchived` flag) instead of deleted, with dedicated archive views and authorization controls.

### Authentication System

Session-based authentication uses `express-session` with `connect-pg-simple` and `bcryptjs`. It includes registration, login, logout, and user information retrieval. The UI adapts based on authentication status and user roles (e.g., admin).

### Coach Profile Page

A dedicated `/profile` page for users to manage their avatar, and editable fields like favorite NFL team/coach, and offensive/defensive scheme preferences. Updates are handled via a `PATCH /api/user/profile` endpoint with Zod validation.

### Admin Dashboard

A protected `/admin` interface for managing AI Logic (`LOGIC_DICTIONARY`), formation presets, AI generation logs, and user accounts. Admin access is controlled by an `isAdmin` flag and `verifyAdmin` middleware. Features include a sortable, paginated user table and email management.

### Play Type Tabs

Supports "Offense," "Defense," "Special," and "AI Beta" tabs, each maintaining independent state and allowing combination of formations.

### Right Sidebar Directions Panel

A fixed-width sidebar provides guided instructions, "Pro Tips," and calls-to-action.

### Play Library Page

A light-themed `/plays` page for managing saved plays. It features a collapsible sidebar for filters, a gallery grid with play cards, sorting options, and actions like sharing, exporting, and creating new plays. Unauthenticated users can browse public templates, while authenticated users can save and clone plays.

### Global Template System

An admin-controlled public play library allows sharing starter content. Plays can be marked `isPublic`, and `clonedFromId` tracks template origins.

### Feature Request System

A user feedback system accessible from the right sidebar. It collects user type, feature description, and use case, storing them in a `feature_requests` table. Submissions are validated, protected against spam, and trigger email notifications to administrators via Resend.

## External Dependencies

-   **UI/Design**: Radix UI, shadcn/ui, Lucide React, class-variance-authority, Tailwind CSS.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit, node-postgres.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Carousel/Modals**: embla-carousel-react, vaul.