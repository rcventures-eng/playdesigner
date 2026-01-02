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

### Play Management Features

Plays can be archived (`isArchived` flag) instead of deleted, with dedicated views and authorization. A global template system allows admins to share public starter plays, tracking origins via `clonedFromId`.

### Authentication

Session-based authentication uses `express-session` with `connect-pg-simple` and `bcryptjs` for registration, login, logout, and user info. The UI adapts based on authentication and user roles (e.g., admin).

### User Profile and Admin Dashboard

A `/profile` page allows users to manage their avatar and preferences. An `/admin` dashboard provides protected access for managing AI Logic, formation presets, AI logs, and user accounts.

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