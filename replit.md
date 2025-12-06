# Football Play Designer

## Overview

The Football Play Designer is a free, web-based, single-page application for amateur coaches to create offensive, defensive, and special teams plays. It features a drag-and-drop canvas for player positioning and route drawing, with export capabilities. The project aims to provide an accessible and efficient play design experience for grassroots football.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React and TypeScript application built with Vite, utilizing shadcn/ui and Tailwind CSS for a consistent design. State management uses React hooks, and Wouter handles client-side routing. The design system supports custom theming and dark mode.

### Canvas and Drawing System

The core play design functionality uses HTML5 Canvas and SVG for rendering. A `FIELD` configuration object defines field geometry and scaling. Key features include:
-   **Field Elements**: Line of scrimmage, yard lines, hash marks, draggable football, and a play-action marker.
-   **Motion Routes**: Differentiated visual display before and after the Line of Scrimmage.
-   **Export Functionality**: Generates downloadable PNGs using `html-to-image`, optimized for quality at various sizes.
-   **Interaction Model**: Drag-and-drop for players, click-to-draw for routes, and a long-press cascading menu for comprehensive player interactions.

### Player Rendering and Defensive Assignments

Players are rendered differently based on their side (`offense` or `defense`). Offensive players are filled circles, while defensive players are X shapes with labels.
The system supports advanced defensive assignments through a long-press menu, including:
-   **Blitz**: Red solid line to the QB.
-   **Man Coverage**: Gray dotted line to a dynamically linked offensive player.
-   **Zone Coverage**: Tethered zone shapes (Circle, Oval, Rectangle) that can be independently dragged and resized, with dynamic stem updates.

### AI Play Creator

The Special Teams tab features an AI Play Creator powered by Google Gemini 2.0 Flash. Users can describe a play in natural language or upload an image, and the AI generates players and routes on the canvas. The AI leverages a detailed system prompt with field dimensions, player color codes, and route types.

### Shared Configuration Architecture

A centralized `shared/football-config.ts` file acts as the single source of truth for colors, field dimensions, game logic rules, and formation coordinates, ensuring consistency across the application and AI system. `FORMATIONS` exports predefined formation templates with exact coordinates.

### Football Logic Dictionary (AI-Only)

The `shared/logic-dictionary.ts` provides `LOGIC_DICTIONARY`, a comprehensive strategy reference used exclusively by the AI Play Creator. It defines offensive formations, route patterns, play concepts, defensive schemes, assignments, and game mechanics with associated trigger keywords and visual rules.

### Backend

The backend uses Express.js with TypeScript, primarily serving static assets. It includes an API route (`/api/generate-play`) for AI play generation.

### Data Storage

Drizzle ORM with PostgreSQL (Neon Database) is configured for type-safe database operations. While MVP uses client-side storage, a `users` schema exists for future authentication and play persistence.

### Play Type Tabs

The application features independent tabs for Offense, Defense, and Special Teams, each maintaining separate state and undo history. The Defense tab includes a dynamic header layout optimization to maximize field space.

## External Dependencies

-   **UI Libraries**: Radix UI, shadcn/ui, Lucide React, class-variance-authority.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Canvas/Graphics**: embla-carousel-react, vaul.