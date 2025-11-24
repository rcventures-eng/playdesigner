# Football Play Designer - Design Guidelines

## Design Approach
**Utility-First Sports Application Design** - This is a professional coaching tool prioritizing functionality, clarity, and efficient workflows. Drawing inspiration from sports analytics platforms and design tools like Figma/Canva, with the specific dark navy/orange athletic aesthetic from the provided reference.

## Typography System
**Primary Font**: Inter or similar clean sans-serif for exceptional readability
- **Play Titles/Headers**: 24-28px, font-weight 700
- **Section Labels**: 16-18px, font-weight 600
- **Form Labels**: 14px, font-weight 500
- **Metadata/Tags**: 12-13px, font-weight 400
- **Button Text**: 15px, font-weight 600

## Color Palette (From Reference Screenshot)
**Background**: Deep navy/dark blue (#1a2332 or similar)
**Accent/Primary**: Bright orange (#ff6b35 or similar) for CTAs and active states
**Canvas Background**: Football field green with white hash marks
**Text**: White (#ffffff) primary, light gray (#cbd5e1) secondary
**Borders/Dividers**: Subtle gray-blue (#374151)

**Player Circle Colors**:
- Offense: Green, Blue, Red, Yellow, Black, Orange, Gray (bright, saturated versions)
- Defense: Brown (D-Line), Magenta (LBs), Purple (DBs)

## Layout System
**Tailwind Spacing Units**: 2, 4, 6, 8, 12, 16 for consistent rhythm

**Main Layout Structure**:
- **Toolbar Panel** (left or top on mobile): Fixed 280px wide on desktop, full-width collapsible on mobile - contains all controls, metadata inputs, and tools
- **Canvas Area**: Flexible remaining space with centered football field (maintains aspect ratio, max-width constrained)
- **Property Panel** (right): 300px wide on desktop, slide-over on tablet/mobile - shows selected element properties

## Component Library

### Canvas & Field
- Football field background with yard lines, hash marks, and line of scrimmage
- 10 yards behind LOS, 20 yards beyond LOS visible
- Grid overlay (toggleable) for precise positioning
- Zoom controls: 50%, 75%, 100%, 150%, 200%

### Toolbar Controls
- **Play Type Toggle**: Large pill-style toggle (Offense/Defense/Special Teams)
- **Metadata Form**: Stacked input groups with labels, clean white inputs on dark background
  - Name (text input)
  - Formation (dropdown or text)
  - Concept (dropdown: Outside Run, Inside Run, Short Pass, RPO, Screen Pass, etc.)
  - Personnel (text input with examples)
- **Tool Palette**: Icon buttons in 2-3 column grid
  - Add Player Circle (with color selector)
  - Add Football
  - Draw Route (with line style selector)
  - Add Zone Shape (defense only)
  - Add Text Label
- **Route Options**: Compact button group
  - Line Type: Straight | Rounded
  - Route Priority: Primary (Red) | 2nd (Black+Badge) | 3rd | 4th | Decision (Blue)
  - Motion: Dotted (behind LOS) | Solid (beyond LOS)
  - Toggle: Show/Hide Blocking Lines
- **Export Section**: Prominent orange button + dimension inputs
  - Preset sizes dropdown (694x392, 100x40, custom)
  - Custom width/height inputs
  - "Export as Image" button
  - "Copy to Clipboard" button

### Draggable Elements
- **Player Circles**: 48px diameter circles with team color fills, white borders (2px), optional text label inside/below
- **Football**: 32px width oval shape, brown with laces detail
- **Routes/Lines**: 3px width, arrow endpoints, smooth curves for rounded style
- **Badges**: Small numbered badges (16px) for route priority indication
- **Zone Shapes**: Semi-transparent fills (30% opacity) with dashed borders

### Selection & Editing
- Selected elements: Bright cyan outline (3px), resize/rotate handles
- Multi-select: Shift+click or drag selection box
- Properties panel shows: Position (x,y), Color, Label, Route type

## Responsive Behavior
**Desktop (1024px+)**: Three-panel layout (toolbar | canvas | properties)
**Tablet (768-1023px)**: Collapsible sidebar, floating properties panel
**Mobile (<768px)**: 
- Toolbar collapses to bottom sheet/drawer
- Canvas takes full screen with zoom/pan
- Properties as modal/slide-up panel
- Touch-optimized: Larger hit areas (minimum 44px), pinch-to-zoom support

## Interaction Patterns
- **Drag & Drop**: Smooth dragging with snap-to-grid option (toggleable)
- **Route Drawing**: Click player circle, drag to create path, click to add waypoints, double-click to finish
- **Context Menus**: Right-click elements for quick actions (duplicate, delete, change color, add label)
- **Keyboard Shortcuts**: Delete (remove), Cmd+C/V (copy/paste), Cmd+Z (undo), Arrow keys (nudge)
- **Undo/Redo**: Prominent toolbar buttons with keyboard support

## Visual Enhancements
- Subtle shadows on floating panels (shadow-lg)
- Smooth transitions (150ms) for tool switches and panel animations
- Active tool indicator: Orange border/background on selected tool button
- Canvas grid dots: Subtle, only visible at 100%+ zoom
- Field texture: Very subtle noise/grain overlay for realism

## Mobile-Specific Optimizations
- Bottom toolbar with expandable tool drawer
- Two-finger pan for canvas navigation
- Tap-and-hold for element selection
- Simplified route drawing: Tap waypoints instead of drag
- Large touch targets (56px minimum) for all interactive elements

**No Hero Image**: This is a functional application tool, not a marketing page - the canvas IS the hero element.