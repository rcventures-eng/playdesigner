# Football Play Designer

## Overview

The Football Play Designer is a free, web-based, single-page application for amateur coaches to create offensive, defensive, and special teams plays. It features a drag-and-drop canvas for player positioning and route drawing, with export capabilities. The project aims to provide an accessible and efficient play design experience for grassroots football.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React and TypeScript application built with Vite, utilizing shadcn/ui and Tailwind CSS for a consistent design. State management uses React hooks, and Wouter handles client-side routing. The design system supports custom theming and dark mode.

### Global Top Navigation

A sleek orange navigation bar sits above the entire application:
-   **TopNav Component**: `h-12 bg-orange-500 shadow-md` provides a 48px branded header with subtle shadow separation.
-   **Left Side**: RC Football logo image (h-9 w-auto object-contain) with "RC Football" text next to it (bold, white, tracking-tight).
-   **Right Side**: Log In (text button), Sign Up (white pill button), and circular profile placeholder.

### Floating Console Layout

The app uses a modern "Floating Console" aesthetic with breathing room around all edges:
-   **Outer Wrapper**: `h-screen w-screen flex flex-col overflow-hidden` contains TopNav and workspace.
-   **Main Container**: `flex-1 bg-slate-950 px-10 pb-10 pt-3 flex flex-col gap-4` provides 40px padding on sides/bottom, 12px on top (tighter connection to TopNav).
-   **Left Sidebar**: `rounded-2xl border border-white/10 shadow-2xl bg-slate-900/95` appears as a floating card with subtle translucent styling.
-   **Center Field Area**: `rounded-2xl bg-slate-900/50 border border-white/5` frames the play canvas with subtle visual boundaries.
-   **Metadata Header**: When visible, also uses `rounded-2xl border border-white/10` to match the floating panel aesthetic.

### Canvas and Drawing System

The core play design functionality uses HTML5 Canvas and SVG for rendering. A `FIELD` configuration object defines field geometry and scaling. Key features include:
-   **Field Elements**: Line of scrimmage, yard lines, hash marks, yard line numbers (30/40/50), draggable football, and a play-action marker.
-   **Yard Line Numbers**: TV-broadcast style numbers (30, 40, 50) with authentic sideline orientation. Left numbers rotate -90° (counter-clockwise), right numbers rotate +90° (clockwise), creating the mirror effect seen on real fields. Positioned at 15% and 85% field width, anchored to LOS (30 at LOS+12px, 40 at LOS-108px, 50 at LOS-228px). Uses bold 32px Arial Narrow font, white with 0.25 opacity.
-   **Motion Routes**: Differentiated visual display before and after the Line of Scrimmage.
-   **Route Shifting**: When dragging a player, all their routes shift with them maintaining shape (non-assignment routes only). Delta is calculated between new and old position and applied to all route points.
-   **Export Functionality**: Generates downloadable PNGs using `html-to-image`, optimized for quality at various sizes. Export always captures the logical canvas at 694×392 regardless of display scale.
-   **Interaction Model**: Drag-and-drop for players, click-to-draw for routes, and a long-press cascading menu for comprehensive player interactions.
-   **Long-press vs Drag Detection**: Uses 8px movement threshold and timer fallback check to reliably distinguish between long-press (menu) and drag (move player) gestures.
-   **Advanced Route Editing**: Double-click on any route to enter edit mode with blue control handles at every route point. The first point remains locked to the player position while other points can be freely dragged to adjust the route shape. Each drag operation creates an undo checkpoint. Curved routes auto-recalculate their curves when endpoints change. Click on the canvas background to exit edit mode.

### Resolution Independence

The canvas uses a responsive scaling system to fit various screen sizes while maintaining consistent coordinate handling:
-   **Scale Calculation**: `useResponsiveScale` hook calculates scale factor based on container size (FIELD.WIDTH 694 × FIELD.HEIGHT 392) with 20px margin and 0.4 minimum scale.
-   **Two-Layer Architecture**: Layer A (scaled field canvas with CSS transform) and Layer B (fixed-size AI overlay centered at 100%).
-   **Coordinate Correction**: All pointer event handlers divide clientX/clientY by scale factor before using coordinates, ensuring accurate interaction at any zoom level.
-   **Counter-Scaling**: Player labels (defensive and offensive) and Play-Action marker use `transform: scale(1/scale)` to maintain readability regardless of field zoom.
-   **Menu Positioning**: Long-press menu position calculated with scale factor: `menuX = rect.left + player.x * scale`.
-   **Touch Optimization**: Field canvas has `touch-action: none` for better mobile/tablet interaction.

### Player Rendering and Defensive Assignments

Players are rendered differently based on their side (`offense` or `defense`). Offensive players are filled circles, while defensive players are X shapes with labels.
The system supports advanced defensive assignments through a long-press menu, including:
-   **Blitz**: Red solid line to the QB.
-   **Man Coverage**: Gray dotted line to a dynamically linked offensive player.
-   **Zone Coverage**: Tethered zone shapes (Circle, Oval, Rectangle) that can be independently dragged and resized, with dynamic stem updates.

### AI Play Creator

The AI Beta tab features an AI Play Creator powered by Google Gemini 2.0 Flash. Users can describe a play in natural language or upload hand-drawn play diagrams, and the AI generates players and routes on the canvas. Key features include:
-   **SportsCenter-Style Scrolling Ticker**: Suggestion chips scroll continuously right-to-left in a broadcast ticker style. Uses CSS keyframe animation with `translateX(-50%)` over 20 seconds. Chips are duplicated for seamless looping. Hover pauses the animation via `.ticker-container:hover .ticker-track { animation-play-state: paused; }`. Chips defined in centralized `suggestionChips` array for easy future additions.
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

The application features a 4-tab navigation with uniform styling (text-[11px] font-semibold px-1):
-   **Offense**: Standard offensive play design with formation presets and player colors.
-   **Defense**: Defensive play design with dynamic header layout optimization to maximize field space. Includes shape tools for zone coverage visualization.
-   **Special**: Currently disabled (opacity-50, pointer-events-none). Reserved for future special teams plays.
-   **AI Beta**: Features an orange Sparkles icon. Clones all Special tab functionality including the AI Play Creator, formation presets, and manual editing. Provides a dedicated canvas for AI-assisted play creation.

Each tab maintains independent state (players, routes, shapes, footballs, history) for complete isolation between play types.

### Right Sidebar Directions Panel

A fixed-width (w-96) directions panel on the right side provides guided instructions for building plays:
-   **Content**: Six numbered sections covering Add Players, Position & Label, Draw Routes, Tag Your Play, Quick Actions, and Export Your Play.
-   **Layout**: Uses flex column layout with scrollable content area (flex-1 overflow-y-auto) and fixed CTA section at bottom.
-   **Pro Tips**: Orange-highlighted italic tips (using !text-orange-400) for AI Beta and account features.
-   **CTA Buttons**: Two buttons positioned inside the scrollable area with mt-6 spacing after Export section:
    -   **Create Your Free Account**: Large promotional mega-button (h-32, w-full) with centered flex layout. Features Sparkles icon (w-8 h-8), text-2xl font-extrabold headline, and text-sm sub-text. Uses bg-orange-500 hover:bg-orange-600 brand colors.
    -   **Request a Feature**: Secondary green button (bg-green-600 hover:bg-green-700, text-xs) matching Preloaded Game Format styling.
-   **Follow Us Section**: Fixed footer outside scrollable area with border-t separator. Contains centered "Follow Us" label and three social links (@Twitter, @Instagram, @TikTok) with hover effects.

## External Dependencies

-   **UI Libraries**: Radix UI, shadcn/ui, Lucide React, class-variance-authority.
-   **Forms & Validation**: React Hook Form, Zod.
-   **Database**: Drizzle ORM, @neondatabase/serverless, drizzle-kit.
-   **Utilities**: TanStack Query, date-fns, clsx, tailwind-merge, html-to-image.
-   **Build Tools**: Vite, esbuild, TypeScript, PostCSS.
-   **Replit Integrations**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner.
-   **Session Management**: connect-pg-simple.
-   **Canvas/Graphics**: embla-carousel-react, vaul.