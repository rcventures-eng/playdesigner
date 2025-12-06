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
-   **Route Shifting**: When dragging a player, all their routes shift with them maintaining shape (non-assignment routes only). Delta is calculated between new and old position and applied to all route points.
-   **Export Functionality**: Generates downloadable PNGs using `html-to-image`, optimized for quality at various sizes.
-   **Interaction Model**: Drag-and-drop for players, click-to-draw for routes, and a long-press cascading menu for comprehensive player interactions.
-   **Long-press vs Drag Detection**: Uses 8px movement threshold and timer fallback check to reliably distinguish between long-press (menu) and drag (move player) gestures.

### Player Rendering and Defensive Assignments

Players are rendered differently based on their side (`offense` or `defense`). Offensive players are filled circles, while defensive players are X shapes with labels.
The system supports advanced defensive assignments through a long-press menu, including:
-   **Blitz**: Red solid line to the QB.
-   **Man Coverage**: Gray dotted line to a dynamically linked offensive player.
-   **Zone Coverage**: Tethered zone shapes (Circle, Oval, Rectangle) that can be independently dragged and resized, with dynamic stem updates.

### AI Play Creator

The Special Teams tab features an AI Play Creator powered by Google Gemini 2.0 Flash. Users can describe a play in natural language or upload hand-drawn play diagrams, and the AI generates players and routes on the canvas. Key features include:
-   **Text Prompts**: Natural language descriptions are processed with a comprehensive system prompt containing field dimensions, player color codes, and route types.
-   **Image Upload**: Hand-drawn diagrams are processed via Gemini's vision model with specialized prompts that:
    - Snap players to exact FORMATIONS coordinates (no pixel-based inference)
    - Use spatial heuristics for unlabeled players (left-to-right ordering, LOS proximity)
    - Interpret route styles (solid=passing, curved=curved, dotted=motion for offense only)
    - Detect primary targets (marked with "1" or asterisk)
-   **Backend Validation**: Infers isPrimary and isMotion flags from route geometry when AI doesn't set them explicitly. Validates defensive players never have motion routes.
-   **Payload Support**: Server accepts up to 10MB JSON payloads for base64-encoded images.

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