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

Allows users to create, edit, and manage team playbooks, including uploading cover images and associating plays with teams.

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