# Eagle Vault Frontend - Design System

## Style Inspiration
- **Layout:** Yearn Finance v3 (clean, card-based, professional)
- **Colors:** 47 Eagle Finance golden palette
- **Theme:** Dark mode with glassmorphism

---

## Color Palette

### Primary (Eagle Golden)
- `eagle-gold`: #d4af37 (brand primary)
- `eagle-gold-dark`: #b8941f (hover states)
- `eagle-gold-darker`: #a0800d (active states)
- `eagle-gold-darkest`: #8a6f00 (maximum contrast)
- `eagle-gold-light`: #e2c55f (labels, accents)
- `eagle-gold-lighter`: #edd577 (highlights)
- `eagle-gold-lightest`: #f5e89f (brightest accents)

### Accent Colors
- `indigo`: #6366f1 (info, secondary actions)
- `purple`: #8b5cf6 (premium features)

### Backgrounds
- Primary: `#0a0a0a` (pure black)
- Secondary: `#171717` (dark gray)
- Cards: `rgba(10, 10, 10, 0.6)` with backdrop blur

---

## Typography

### Font Family
```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

### Font Weights
- 300: Light
- 400: Regular
- 500: Medium
- 600: Semibold (headings)
- 700: Bold

### Key Features
- Letter spacing: -0.01em (body), -0.02em (headings)
- Line height: 1.75
- Font smoothing: antialiased
- Ligatures: enabled

---

## Components

### VaultOverview
- **Style:** Large card with gradient border
- **Layout:** 4-column stats grid
- **Elements:**
  - Large token icon (gradient golden circle)
  - Token name with gradient text
  - Contract address (monospace)
  - Chain badges
  - 4 metric cards (TVL, APY, Balance, Rewards)

### VaultActions
- **Style:** Card with tabbed interface
- **Tabs:** Deposit | Withdraw
- **Elements:**
  - Tab navigation with golden underline
  - Input fields with Max button
  - Arrow separator
  - Vault selector
  - Primary action button (golden for deposit, red for withdraw)

### StrategyBreakdown
- **Style:** Card with sub-tabs
- **Tabs:** Strategies | Info | Risk
- **Elements:**
  - Strategy list with allocation bars
  - Active/inactive indicators (green/gray dots)
  - Token breakdown grid
  - External link to Charm Finance

### Header
- **Style:** Fixed header with backdrop blur
- **Elements:**
  - Golden token icon
  - Site name and tagline
  - Navigation links
  - Connect wallet button (golden)

---

## Design Principles

### 1. No Emojis
- Use SVG icons instead
- Professional appearance
- Better accessibility

### 2. Glassmorphism
- Cards: `rgba(255, 255, 255, 0.03)` background
- Backdrop filter: `blur(20px)`
- Border: `rgba(212, 175, 55, 0.2-0.3)`
- Hover: increase border opacity

### 3. Golden Accents
- Strategic use on:
  - Primary buttons
  - Active states
  - Borders
  - Token icons
  - Gradient text (headings, metrics)

### 4. High Contrast
- White text: `#ffffff`
- Body text: `#e5e5e5`
- Secondary text: `#a3a3a3`
- Muted text: `#737373`
- Pure black background: `#0a0a0a`

### 5. Smooth Transitions
- Duration: 0.2-0.3s
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`
- Hover effects: translateY(-2px)
- Shadow on hover: `shadow-eagle-gold/20`

---

## Spacing

### Consistent Scale
- 2px, 4px, 8px, 12px, 16px, 24px, 32px, 48px

### Container Max Width
- 1280px (5xl) for main content

### Card Padding
- Default: 1.5rem (24px)
- Large: 2rem (32px)

---

## Animations

### Fade In
```css
from: opacity 0, translateY(10px)
to: opacity 1, translateY(0)
duration: 0.3s
```

### Shimmer (for loading)
```css
background-position: 0% → 100% → 0%
duration: 3s
infinite
```

---

## Accessibility

### Focus States
- Outline: 2px solid eagle-gold
- Outline offset: 2px

### Reduced Motion
- All animations disabled when `prefers-reduced-motion: reduce`

### Contrast
- All text meets WCAG AAA standards
- Golden text: eagle-gold-lightest on dark backgrounds

---

## Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 996px
- Desktop: > 996px
- Wide: > 1400px

---

## Component States

### Buttons
- Default: eagle-gold background
- Hover: eagle-gold-dark + translateY(-1px) + shadow
- Active: translateY(0)
- Disabled: gray-700 background + gray-500 text

### Inputs
- Default: gray-900/50 background + gray-700 border
- Focus: eagle-gold/50 border + ring
- Error: red-500 border

### Cards
- Default: border-eagle-gold/30
- Hover: border-eagle-gold/40 + translateY(-2px)

---

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx          ← Navigation
│   │   ├── VaultOverview.tsx   ← Top stats card
│   │   ├── VaultActions.tsx    ← Deposit/Withdraw
│   │   └── StrategyBreakdown.tsx ← Strategy info
│   ├── config/
│   │   └── contracts.ts        ← Contract addresses
│   ├── App.tsx                 ← Main layout
│   ├── main.tsx                ← Entry point
│   └── index.css               ← Global styles
├── tailwind.config.js          ← Tailwind config
├── package.json                ← Dependencies
└── vite.config.ts              ← Vite config
```

---

## Key Differences from Old Design

### Removed
- ❌ All emojis (replaced with SVG icons)
- ❌ Colorful status badges
- ❌ Multiple info cards at bottom
- ❌ Separate wrap/unwrap interface
- ❌ Strategy as a tab

### Added
- ✅ Yearn-style layout
- ✅ Professional golden icons
- ✅ Cleaner typography
- ✅ Glassmorphism effects
- ✅ Better visual hierarchy
- ✅ Strategy breakdown card
- ✅ Elegant hover states

---

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (webkit prefixes included)
- Mobile: ✅ Responsive design

---

**Design Status:** Production Ready  
**Last Updated:** October 2025  
**Design System Version:** 2.0 (Yearn-inspired)

