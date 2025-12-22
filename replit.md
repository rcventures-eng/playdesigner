# Football Play Designer

## Overview

The Football Play Designer is a free, web-based, single-page application for amateur coaches to create offensive, defensive, and special teams plays. It offers a drag-and-drop canvas for player positioning and route drawing, with export capabilities. The project's core purpose is to provide an accessible and efficient play design experience for grassroots football, enabling users to visualize and share their strategies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React and TypeScript application built with Vite, utilizing shadcn/ui and Tailwind CSS for a consistent design. State management uses React hooks, and Wouter handles client-side routing. The design system supports custom theming and dark mode, employing a "Floating Console" aesthetic.

### Canvas and Drawing System

The core play design functionality uses HTML5 Canvas and SVG for rendering. Key features include:
-   **Field Elements**: Line of scrimmage, yard lines, hash marks, TV-broadcast style yard line numbers, draggable football, and a play-action marker.
-   **Player & Route Interaction**: Drag-and-drop for players, click-to-draw for routes, and a long-press cascading menu for comprehensive player interactions. Routes shift with players, and advanced route editing is available via double-click, featuring control handles and undo checkpoints.
-   **Draw-Through Transparency**: When a route style is selected from the long-press menu, the menu becomes click-through (pointer-events: none) to allow hovering over the player to start drawing. Once drawing begins, the menu fades to 15% opacity for unobstructed field visibility.
-   **Smart Menu Positioning**: Long-press menu detects backfield players (y > 294) and positions above them to avoid blocking the field. Includes vertical overflow protection.
-   **Resolution Independence**: A responsive scaling system maintains consistent coordinate handling across various screen sizes, with counter-scaling for player labels and menus.
-   **Player Rendering**: Offensive players are filled circles, defensive players are X shapes with labels.
-   **Defensive Assignments**: Supports advanced assignments like Blitz, Man Coverage (dynamically linked to offensive players), and Zone Coverage (resizable shapes with dynamic stem updates).
-   **Export Functionality**: Generates downloadable PNGs using `html-to-image`, capturing the logical canvas at a fixed resolution regardless of display scale.

### AI Play Creator

The AI Beta tab features an AI Play Creator powered by Google Gemini 2.0 Flash. It allows users to generate plays from natural language descriptions or hand-drawn diagrams.
-   **User Input**: Text prompts are processed using a comprehensive system prompt. Image uploads are processed via Gemini's vision model, interpreting formations, route styles, and primary targets.
-   **Visual Enhancements**: Includes a SportsCenter-style scrolling ticker for suggestion chips with seamless looping and hover-to-pause functionality.
-   **Backend Validation**: Infers `isPrimary` and `isMotion` flags from route geometry and validates defensive player routes.

### Shared Configuration

A centralized `shared/football-config.ts` acts as a single source of truth for design parameters, game logic, and formation coordinates. The `shared/logic-dictionary.ts` provides a `LOGIC_DICTIONARY` for AI Play Creator, defining offensive/defensive strategies, route patterns, and game mechanics. It also exports `SITUATIONAL_TAGS` for format-specific situational play tagging.

### Situational Tagging System

The PlayDesigner supports dynamic situational tagging for plays:
-   **Situational Toggle**: A checkbox next to the Concept label enables situational mode
-   **Format-Specific Tags**: When enabled, the dropdown shows situation-specific options based on game format (5v5, 7v7, 9v9, 11v11)
-   **Tag Options**: 5v5 has "Open Field", "Red Zone", "Goal Line", "2pt Conversion"; 7v7/9v9 have "Open Field", "High Red Zone", "Low Red Zone", "Goal Line", "2pt Conversion"; 11v11 has "Backed Up", "Coming Out", "Open Field", "Midfield", "Plus Territory", "High Red Zone", "Low Red Zone", "Goal Line", "2pt Conversion"
-   **Auto-Detection**: Uses `detectGameFormat` utility to determine format from player count or explicit selection
-   **AI Integration**: Situation context is injected into AI prompts for contextual play generation
-   **Data Storage**: Plays table includes a `situation` column for persisting situational tags

### Backend

The backend uses Express.js with TypeScript, providing API routes for AI play generation, user authentication, and team management.

### Data Storage

Drizzle ORM with PostgreSQL manages data, including `users`, `teams`, `plays`, `ai_logs`, `ai_generation_logs`, and `password_reset_tokens` tables.

**Plays Table Structure**: The `plays` table links directly to users via `userId` (required), with an optional `teamId` for organization. This allows users to save plays immediately after signup without creating a team first. Teams serve as an optional organizational layer.

**Play API Routes**:
- `POST /api/plays`: Creates a play for the authenticated user. Requires `name` and `type`; accepts optional `teamId`, `data`, `tags`, and `isFavorite`. If `teamId` is provided, validates the team belongs to the current user.
- `GET /api/plays`: Returns all plays for the authenticated user, ordered by creation date (newest first). Supports optional `?teamId=` and `?archived=true` query parameters. Returns `archivedCount` for sidebar badge.
- `DELETE /api/plays/:id`: Deletes a play. Only the play owner or an admin can delete.
- `PATCH /api/plays/:id/archive`: Toggles the archive status of a play. Only the play owner or an admin can archive/unarchive.
- `DELETE /api/teams/:id`: Deletes a team. Only the team owner or an admin can delete.

### Play Archiving System

Plays can be archived instead of deleted to preserve them without cluttering the main library:
-   **Database Schema**: `isArchived` boolean column on plays table (default false)
-   **Archive Toggle**: Archive/unarchive buttons on play cards in My Plays section
-   **Archive Folder**: Dedicated "Archive" folder in PlayLibrary sidebar with count badge
-   **Filtering**: Archived plays are excluded from normal views and shown only in Archive folder
-   **Authorization**: Only play owner or admin can archive/unarchive plays

### Authentication System

Session-based authentication uses `express-session` with `connect-pg-simple` for PostgreSQL-backed sessions and `bcryptjs` for password hashing. API routes exist for registration, login, logout, and retrieving user information.

**TopNav Authentication UI**: The TopNav component conditionally renders based on authentication state:
- **Logged out**: Displays "Log In" and "Sign Up" buttons
- **Logged in**: Displays personalized greeting "Hey Coach [NAME]" with user avatar (shows profile picture if set, otherwise initials) and dropdown menu
- User data is fetched via `/api/me` endpoint which returns `id`, `email`, `firstName`, `isAdmin`, `favoriteNFLTeam`, `favoriteNFLCoach`, `offensiveSchemePreference`, `defensiveSchemePreference`, and `avatarUrl`
- Admin state is automatically synced from the user data to enable/disable admin features

### Coach Profile Page

A dedicated profile management page at `/profile` accessible via Trophy icon in TopNav dropdown:
-   **Avatar**: 120x120 centered avatar with camera button to update profile picture URL
-   **Read-Only Fields**: Name and Email (contact support to change)
-   **Editable Fields**:
    - Favorite NFL Team (text input)
    - Favorite NFL Coach (dropdown with all 30 current NFL head coaches for 2024-2025 season)
    - Offensive Scheme Preference (dropdown: Run First/Ground Control, Balanced Offense, Pass First/Space and Timing, Athlete-Centric, Simple - Low Install, Misdirection & Deception, Shot Plays/Big Plays)
    - Defensive Scheme Preference (dropdown: Contain/No Big Plays, Simple Zone/Area Defense, Man Coverage/Match Up, Pressure/Aggressive, Read & React, Athlete-Centric, Bend Don't Break)
-   **Helper Text**: Scheme preference fields show "For play recommendations in the future"
-   **API Endpoint**: `PATCH /api/user/profile` with Zod validation for updates
-   **Styling**: Dark slate theme with orange accents for visibility

### Admin Dashboard

A protected admin interface at `/admin` allows for configuration of the AI Logic (`LOGIC_DICTIONARY`), viewing formation presets, accessing AI generation logs, and managing user emails.

**Security**: Admin access is controlled by a database-backed `isAdmin` flag on the users table. The `verifyAdmin` middleware checks both valid session authentication AND the isAdmin flag before granting access to any admin endpoints. All admin API calls use session-based authentication with credentials. Non-admin users are redirected to the home page and receive 401/403 errors if they attempt direct API access.

**Registered Users Table**: The Email tab displays a sortable, paginated data table of registered users:
-   **Columns**: First Name, Favorite NFL Team, IP Address, Account Created, Last Login, Actions
-   **Features**: Click column headers to sort (asc/desc with visual indicator), 20 rows per page with Previous/Next pagination
-   **API Endpoint**: `GET /api/admin/users?page=1&limit=20&sortBy=createdAt&sortOrder=desc` returns paginated user data
-   **Login Tracking**: On successful login, `lastLoginAt` (timestamp) and `lastLoginIp` (from x-forwarded-for header) are updated

**Email Management**: Admins can view registered users and resend welcome emails through the admin panel. Welcome emails are sent via Resend integration with HTML escaping for security.

### Play Type Tabs

The application features "Offense," "Defense," "Special" (reserved), and "AI Beta" tabs. Each tab maintains independent state and supports "Add Defense?" or "Add Offense?" toggles to combine formations on the field.

### Right Sidebar Directions Panel

A fixed-width right sidebar provides guided instructions on play creation, including "Pro Tips" and calls-to-action for account creation and feature requests.

### Play Library Page

A light-themed page at `/plays` for managing saved plays:
-   **Layout**: White background with collapsible left sidebar (filters) and main gallery grid
-   **Authentication**: Unauthenticated users can browse public templates; saving/cloning requires login
-   **Play Type Tabs**: Offense/Defense/Special toggle pills to filter by play type
-   **Library Sections**: "My Library" (user's plays) and "RC Football Basic Play Library" (public templates)
-   **Sidebar Filters**: Categories include All Plays, Run, Pass, Play-Action, RPO, Trick with counts
-   **Gallery Grid**: Responsive 1-4 column grid with play cards showing mini-canvas previews
-   **Sorting**: Group By dropdown with options: Play Name, Date Created, Formation, Personnel
-   **Actions**: Share Play (copies link), Export Play (stub), New Play (redirects to designer)
-   **Play Cards**: Show static preview using PlayPreview component, play name, formation, personnel, and category badges
-   **Official Template Badge**: Globe icon badge displayed on public template plays
-   **Clone Workflow**: Users can clone public templates to their personal library via Copy button
-   **Components**: `PlayPreview.tsx` renders static SVG preview of play data (players, routes, shapes)

### Global Template System

Admin-controlled public play library for sharing starter content:
-   **Database Schema**: `isPublic` boolean and `clonedFromId` integer columns on plays table
-   **Public API**: `GET /api/public/templates` returns all public plays (no auth required)
-   **Admin Controls**: "Post to Global Library" checkbox in PlayDesigner save workflow (admin only)
-   **Security**: Non-admins cannot edit public plays; admins can toggle isPublic on existing plays
-   **Clone Attribution**: `clonedFromId` tracks which template a cloned play was based on
-   **Unauthenticated Access**: All users can browse public templates; sign-in required to save copies

### Feature Request System

A user feedback collection system accessible from the right sidebar "Request a Feature" button:
-   **Database Storage**: `feature_requests` table stores userType, featureDescription, useCase, optional userId, and createdAt timestamp
-   **API Endpoint**: `POST /api/feature-requests` - no authentication required, accepts submissions from all users
-   **Spam Protection**: Honeypot field silently rejects bot submissions while returning 201 status
-   **Input Validation**: Backend validates userType against allowed list, enforces string types, and limits content length to 5000 characters
-   **Email Notifications**: Sends formatted HTML email to admin via Resend with HTML-escaped content to prevent injection
-   **Frontend Dialog**: Modal dialog matching login modal styling (dark theme) with user type select, feature description textarea, and use case textarea

## External Dependencies

-   **UI/Design**: Radix UI, shadcn/ui, Lucide React, class-variance-authority, Tailwind CSS.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit, node-postgres.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Carousel/Modals**: embla-carousel-react, vaul.