# Football Play Designer

## Overview

A free, web-based football play designer tool for amateur coaches to design offensive, defensive, and special teams plays. The application provides a drag-and-drop canvas interface where coaches can position players, draw routes, and export plays as images in various sizes. Built as a single-page application with no authentication required, it prioritizes ease of use and accessibility across desktop, tablet, and mobile devices.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**Rationale**: React provides component reusability and a rich ecosystem. TypeScript adds type safety, reducing runtime errors. Vite offers fast hot module replacement for improved developer experience.

**UI Component Library**: shadcn/ui built on Radix UI primitives with Tailwind CSS for styling.

**Rationale**: shadcn/ui provides accessible, customizable components that can be directly modified in the codebase rather than being a dependency. Radix UI handles complex accessibility concerns. Tailwind CSS enables rapid UI development with a utility-first approach and maintains design consistency through the design system defined in `tailwind.config.ts`.

**State Management**: React hooks (useState, useRef, useEffect) for local component state.

**Rationale**: The application's state is primarily UI-focused (player positions, routes, canvas interactions). Local state with hooks is sufficient and avoids the complexity of global state management libraries.

**Routing**: Wouter for client-side routing.

**Rationale**: Lightweight routing solution suitable for single-page applications. The app currently has minimal routing needs (home page and 404).

**Design System**: Custom design tokens defined in CSS variables with dark mode support.

**Rationale**: CSS variables enable dynamic theming and provide a single source of truth for colors, spacing, and typography. The design follows specifications in `design_guidelines.md` with a dark navy background, orange accents, and football field green canvas.

### Canvas and Drawing System

**HTML Canvas**: The play designer uses HTML5 Canvas and SVG (implementation in `PlayDesigner.tsx`) for rendering the football field, player positions, routes, and shapes.

**Field Configuration (FIELD object)**: All field geometry is controlled by a centralized FIELD configuration object in PlayDesigner.tsx:
- `FIELD.WIDTH` = 694px (native export width)
- `FIELD.HEIGHT` = 392px (native export height)
- `FIELD.HEADER_HEIGHT` = 60px (white header for metadata)
- `FIELD.FIELD_TOP` = 60px (where green field starts)
- `FIELD.LOS_Y` = 284px (line of scrimmage, 8 yards from bottom)
- `FIELD.SIDE_PADDING` = 27px
- `FIELD.BOTTOM_PADDING` = 12px
- `FIELD.PIXELS_PER_YARD` = 12
- `FIELD.FIELD_LEFT/RIGHT` = computed getters for field bounds
- `FIELD.PLAYER_BOUNDS` = computed bounds for player drag limits

**Field Layout**: Vertical field orientation (694×392px) optimized for printing two plays per 8.5×11 page:
- White header block: 60px at top for metadata badges (Name, Formation, Concept, Personnel)
- Green field area: 332px height starting at y=60
- Line of scrimmage: Horizontal white line at y=284 (8 yards from bottom, 6px stroke)
- Field area: ~8 yards (96px) behind LOS, ~18.7 yards ahead for offensive target area
- Hash marks: Two sets of short horizontal marks at `FIELD.LEFT_HASH_X` and `FIELD.RIGHT_HASH_X` (NCAA-style)
- Yard lines: Horizontal lines every 60px (5-yard increments) with 4px stroke at 30% opacity
- Edge yard markers: Short tick marks on left/right edges marking each yard (12px spacing)
- Footballs: Unlimited draggable footballs (10×20px vertical orientation with white center lace line). Users can add multiple footballs and individually select/delete them.
- Play-Action marker: Black circle with white "PA" text at football's bottom-right (appears on all footballs when Play Action concept selected)
- Scale: 12 pixels per yard, 53.33 yard regulation width

**Motion Routes**: Motion routes (enabled via "Motion (dotted)" checkbox) display with visual split at Line of Scrimmage:
- Below LOS (y >= FIELD.LOS_Y): Dotted line (strokeDasharray="5,5") - represents pre-snap motion
- Above LOS (y < FIELD.LOS_Y): Solid line - represents post-snap route
- Arrow marker only appears when route crosses LOS
- Helper functions: `splitMotionRouteAtLOS()` calculates intersection point, `getRoutePathForPoints()` generates path for each segment

**Rationale**: Native 694×392 resolution ensures maximum sharpness when exporting at full size (no upscaling artifacts). The 60px white header separates play metadata from the field area for clean presentation. Downscaling to smaller sizes (e.g., 347×196 for half size) works well with high-quality smoothing.

**Export Functionality**: html-to-image library (`toPng` function) for converting canvas to downloadable PNG images at customizable dimensions. The `generateScaledExport` helper function uses a two-path approach:
- **Native size (694×392)**: Direct capture with pixelRatio: 1 - pixel-perfect quality, unchanged from original
- **Other sizes**: Capture at 2x resolution (1388×784 via pixelRatio: 2), then downscale to target using canvas with imageSmoothingQuality='high'
- Both Download and Copy to Clipboard use this shared helper for consistent output

**Rationale**: The 2x capture + downscale approach produces crisp exports at any size because downscaling from high-resolution preserves detail (unlike upscaling which invents pixels). Native 694×392 exports remain pixel-perfect. Designed for printing two plays per 8.5×11 page.

**Interaction Model**: Drag-and-drop for player positioning (24×24px circles, bounds from FIELD.PLAYER_BOUNDS), click-to-draw for routes, and property panels for metadata entry.

**Long-Press Cascading Menu**: Mouse-only route creation workflow (NO keyboard shortcuts):
- **Trigger**: 300ms hold on any player triggers the menu (movement threshold of 8px cancels if dragging)
- **Visual Feedback**: Pulsing orange ring around player during long-press (suppresses cyan selection ring)
- **Menu Structure**: Three-level horizontal cascade, centered below cursor:
  - Level 1: Pass, Run, Block (vertical stack, arrows indicate submenus)
  - Level 2: Straight, Curved (expands right on hover)
  - Level 3: Motion? and Make Primary? checkboxes (only for Pass/Run, not Block)
- **Route Start**: Clicking Straight/Curved immediately starts route drawing from that player with chosen settings
- **Auto-Reset**: After completing a route, tool auto-returns to Select, and Motion/Primary toggles reset
- **Dismissal**: Click-outside closes menu; leaving canvas cancels long-press

**Player Interaction Patterns**:
- Quick tap: Select player (cyan ring)
- Double tap: Edit player label (2-character max)
- Long-press (300ms): Open Route Options menu (orange pulsing ring)
- Drag: Move player position (8px movement threshold)

**Rationale**: Follows design guidelines emphasizing ease of use and touch-friendly interactions for mobile/tablet support. Drag bounds calculated from FIELD config ensure players stay within the visible field area.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**Rationale**: Lightweight and flexible web server framework. The current implementation shows minimal backend logic, suggesting the app is primarily client-side rendered.

**Development vs Production**: Separate entry points (`index-dev.ts` and `index-prod.ts`) with Vite middleware in development for HMR.

**Rationale**: Development mode integrates Vite's dev server for fast refresh. Production serves pre-built static assets from the `dist/public` directory.

**API Structure**: Routes registered in `server/routes.ts` with `/api` prefix convention.

**Rationale**: Clear separation between API endpoints and static asset serving. Currently minimal backend functionality, indicating most features are client-side.

### Data Storage

**ORM**: Drizzle ORM with PostgreSQL dialect configured.

**Rationale**: Type-safe database operations with automatic TypeScript type inference from schema definitions. Drizzle provides a lightweight alternative to heavier ORMs.

**Database Provider**: Neon Database (@neondatabase/serverless) configured in `drizzle.config.ts`.

**Rationale**: Serverless PostgreSQL suitable for Replit deployments. Provides connection pooling and edge compatibility.

**Schema Design**: Currently minimal schema in `shared/schema.ts` with a users table (id, username, password).

**Rationale**: The MVP explicitly states "No login needed," so the existing user schema may be a template or planned for future features. Play data might be stored client-side (localStorage) or in a future database table.

**In-Memory Storage**: `MemStorage` class in `server/storage.ts` provides a RAM-based implementation.

**Rationale**: Enables development and testing without database dependencies. Can be swapped for database-backed storage when needed.

### Data Persistence Strategy

**Client-Side Storage**: Given the "no login" requirement and single-page architecture, plays are likely saved in browser localStorage or sessionStorage.

**Rationale**: Simplifies the MVP by avoiding server-side persistence and authentication. Users can save plays locally and export as images.

**Future Database Schema**: When persistence is added, a `plays` table would store:
- Play metadata (name, formation, concept, personnel)
- Player positions (x, y coordinates, colors, labels)
- Routes (points arrays, types, styles)
- Shapes (zone coverage drawings)
- Play type (offense/defense/special teams)

## External Dependencies

### Third-Party UI Libraries

- **Radix UI**: Comprehensive collection of unstyled, accessible component primitives (Dialog, Dropdown, Select, Toast, etc.)
- **shadcn/ui**: Pre-styled components built on Radix UI following the New York style variant
- **Lucide React**: Icon library for UI elements (chevrons, download icons, tools)
- **class-variance-authority (CVA)**: Utility for creating variant-based component APIs
- **cmdk**: Command menu component (not currently visible in UI but available)

### Forms and Validation

- **React Hook Form**: Form state management with `@hookform/resolvers` for validation
- **Zod**: Schema validation library with `drizzle-zod` integration for type-safe database schemas

### Database and ORM

- **Drizzle ORM**: Type-safe database toolkit
- **@neondatabase/serverless**: PostgreSQL client for Neon Database
- **drizzle-kit**: CLI tool for schema migrations

### Utilities and Tooling

- **TanStack Query**: Data fetching and caching library (configured in `queryClient.ts`)
- **date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Utility for conditionally joining classNames
- **html-to-image**: Converting DOM nodes to images for play export functionality

### Build Tools

- **Vite**: Frontend build tool and dev server
- **esbuild**: Bundling the production server
- **TypeScript**: Type checking across client and server
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer plugins

### Replit Integration

- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Replit workspace integration
- **@replit/vite-plugin-dev-banner**: Development environment banner

### Session Management

- **connect-pg-simple**: PostgreSQL session store for Express (currently configured but may not be actively used given "no login" requirement)

### Canvas/Graphics

- **embla-carousel-react**: Carousel component for potential UI galleries
- **vaul**: Drawer component library for mobile-friendly panels