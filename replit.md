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

The core play design functionality uses HTML5 Canvas and SVG. Key features include configurable field elements, drag-and-drop player positioning, click-to-draw routes with advanced editing, resolution independence, and distinct rendering for offensive and defensive players. It supports defensive assignments, play notes, and export to downloadable PNGs. The "Flip Play" feature mirrors plays horizontally.

### AI Play Creator

The AI Beta tab leverages Google Gemini 2.0 Flash to generate plays from natural language descriptions or hand-drawn diagrams. It includes visual enhancements and validates inferred play characteristics.

### Backend

The backend is an Express.js and TypeScript application, providing API routes for AI play generation, user authentication, team, and play management.

### Data Storage

Drizzle ORM with PostgreSQL is used for data management across entities like `users`, `teams`, `plays`, and `ai_logs`.

### Database Schema Sync & Publishing

Replit's publish process requires careful synchronization of DEV and PROD database schemas, specifically constraint names, to avoid validation failures. Manual SQL adjustments are preferred over `drizzle-kit push` to match PROD constraint naming conventions.

### Team Management

The system supports comprehensive team management including:
-   **Team Playbook Management**: Create, edit, and manage playbooks, associate plays, and upload cover images. Plays can be assigned to multiple teams.
-   **Team Roster Management**: Add/edit/delete coaches and players, import rosters via CSV or AI, and manage team splits for practice planning.
-   **Playbook Page Types**: Supports "Blank Page" (section dividers), "Roster Page" (displays team players/coaches), and "Splits Page" (displays squad assignments and optional advanced statistics).
-   **Play Thumbnails**: Smart-centered thumbnails with enhanced rendering and note indicators.
-   **Single Play Export**: Individual plays can be exported to Google Drive.

### Google Drive Export

Users can connect their personal Google Drive accounts via OAuth 2.0 to export team playbooks. Exports support Google Docs (handout format) and Google Slides (one play per slide).

### Play Management Features

Plays can be archived (`isArchived` flag) with dedicated views. A global template system allows admins to share public starter plays, tracking origins via `clonedFromId`.

### Authentication

Session-based authentication uses `express-session` with `connect-pg-simple` and `bcryptjs` for registration, login, logout, and user info. UI adapts based on authentication and user roles.

### User Profile and Admin Dashboard

A `/profile` page allows users to manage their avatar and preferences. An `/admin` dashboard provides protected access for managing AI Logic, formation presets, AI logs, and user accounts.

### Mobile Wizard Workflow

The `/mobile` route provides a 3-step mobile-optimized experience for designing plays on touch devices:
1.  **Field**: Game format selection and touch-friendly canvas with player positioning and AI mode.
2.  **Details**: Play naming, situation, and concept tags.
3.  **Save**: Export options including download as image, save to library, and team playbook integration.

Mobile features include aggressive scroll locking, a 50-snapshot undo stack, screenshot/share capabilities, player-specific colored routes, motion route styling, a long-press player action menu for assignments, and note interaction for moving/resizing. A "Clear Play" button allows progressive clearing of play elements.

## External Dependencies

-   **UI/Design**: Radix UI, shadcn/ui, Lucide React, class-variance-authority, Tailwind CSS.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit, node-postgres.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Carousel/Modals**: embla-carousel-react, vaul.