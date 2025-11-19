# Eagle Protocol - Design & Branding Guide

## Brand Identity

### Project Name
**Eagle Protocol** or simply **Eagle**

### Tagline Options
1. "Omnichain DeFi. Simplified."
2. "Cross-chain made simple"
3. "One transaction, infinite possibilities"
4. "Bridge. Compose. Thrive."

### Brand Personality
- **Innovative**: Cutting-edge cross-chain technology
- **Trustworthy**: Secured by LayerZero, verified contracts
- **Accessible**: Complex DeFi made simple
- **Fast**: Quick cross-chain transfers
- **Professional**: Enterprise-grade infrastructure

## Logo Concepts

### Eagle Symbol Ideas
1. **Abstract Bird**: Minimalist geometric eagle in flight
2. **Network Wings**: Eagle wings made of connected nodes/dots
3. **Cross-chain Eagle**: Eagle with multiple colored trails (representing chains)
4. **Shield Eagle**: Eagle wrapped around a shield (security emphasis)

### Logo Style Guide
- **Type**: Modern, geometric, minimal
- **Color**: Primary gradient (Indigo → Cyan)
- **Format**: SVG for scalability
- **Variations needed**:
  - Full logo (symbol + text)
  - Symbol only (for favicons, app icons)
  - Horizontal lockup
  - Vertical lockup
  - Monochrome (for dark/light backgrounds)

## Color Palette

### Primary Colors

```css
/* Background Colors */
--bg-primary: #0a0a0f;       /* Very dark blue-black */
--bg-secondary: #1a1a2e;     /* Dark blue-gray */
--bg-tertiary: #16213e;      /* Slightly lighter blue-gray */

/* Accent Colors */
--accent-primary: #4f46e5;   /* Indigo blue - CTAs, links */
--accent-secondary: #06b6d4; /* Cyan - highlights, success */
--accent-tertiary: #8b5cf6;  /* Purple - special features */

/* Text Colors */
--text-primary: #ffffff;     /* White - headlines */
--text-secondary: #94a3b8;   /* Light gray - body text */
--text-tertiary: #64748b;    /* Medium gray - muted text */
--text-accent: #06b6d4;      /* Cyan - links, highlights */

/* Status Colors */
--success: #10b981;          /* Green - success states */
--warning: #f59e0b;          /* Orange - warnings */
--error: #ef4444;            /* Red - errors */
--info: #3b82f6;             /* Blue - info messages */

/* Gradients */
--gradient-primary: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
--gradient-hero: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
--gradient-card: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%);
```

### Color Usage

| Element | Color | Hex |
|---------|-------|-----|
| Primary CTAs | Indigo | #4f46e5 |
| Secondary CTAs | Cyan | #06b6d4 |
| Card backgrounds | Dark blue-gray | #1a1a2e |
| Card borders | Indigo (20% opacity) | rgba(79, 70, 229, 0.2) |
| Hover states | Cyan glow | #06b6d4 + shadow |
| Chain badges | Varied | Per chain colors |

### Chain-Specific Colors
```css
/* Chain Brand Colors */
--chain-base: #0052FF;       /* Base blue */
--chain-ethereum: #627EEA;   /* Ethereum purple */
--chain-bnb: #F3BA2F;        /* BNB yellow */
--chain-solana: #14F195;     /* Solana green */
```

## Typography

### Font Families

**Headlines & UI**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Body Text**
```css
font-family: 'Inter', system-ui, sans-serif;
```

**Code & Addresses**
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

### Font Sizes

```css
/* Headlines */
--text-hero: 4.5rem;      /* 72px - Hero headline */
--text-h1: 3rem;          /* 48px - H1 */
--text-h2: 2.25rem;       /* 36px - H2 */
--text-h3: 1.875rem;      /* 30px - H3 */
--text-h4: 1.5rem;        /* 24px - H4 */

/* Body */
--text-large: 1.25rem;    /* 20px - Large body */
--text-base: 1rem;        /* 16px - Body text */
--text-small: 0.875rem;   /* 14px - Small text */
--text-tiny: 0.75rem;     /* 12px - Labels */

/* Special */
--text-code: 0.9rem;      /* 14.4px - Code blocks */
```

### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;
```

## UI Components

### Buttons

#### Primary Button
```css
background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
color: #ffffff;
padding: 0.875rem 2rem;
border-radius: 0.75rem;
font-weight: 600;
transition: transform 0.2s, box-shadow 0.2s;

/* Hover */
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
```

#### Secondary Button
```css
background: transparent;
border: 2px solid #4f46e5;
color: #4f46e5;
padding: 0.875rem 2rem;
border-radius: 0.75rem;
font-weight: 600;
transition: background 0.2s, color 0.2s;

/* Hover */
background: rgba(79, 70, 229, 0.1);
color: #06b6d4;
border-color: #06b6d4;
```

### Cards

```css
background: rgba(26, 26, 46, 0.6);
border: 1px solid rgba(79, 70, 229, 0.2);
border-radius: 1rem;
padding: 2rem;
backdrop-filter: blur(20px);
transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;

/* Hover */
transform: translateY(-4px);
border-color: rgba(6, 182, 212, 0.4);
box-shadow: 0 12px 32px rgba(6, 182, 212, 0.2);
```

### Input Fields

```css
background: rgba(26, 26, 46, 0.8);
border: 1px solid rgba(148, 163, 184, 0.2);
border-radius: 0.5rem;
padding: 0.75rem 1rem;
color: #ffffff;
font-family: 'JetBrains Mono', monospace;

/* Focus */
border-color: #4f46e5;
outline: 2px solid rgba(79, 70, 229, 0.2);
```

### Badges

```css
/* Chain Badge */
background: rgba(79, 70, 229, 0.15);
border: 1px solid rgba(79, 70, 229, 0.3);
padding: 0.25rem 0.75rem;
border-radius: 9999px;
font-size: 0.75rem;
font-weight: 600;
color: #06b6d4;
```

### Address Display

```css
background: rgba(0, 0, 0, 0.4);
border: 1px solid rgba(148, 163, 184, 0.1);
border-radius: 0.5rem;
padding: 0.5rem 1rem;
font-family: 'JetBrains Mono', monospace;
font-size: 0.875rem;
color: #94a3b8;
display: flex;
align-items: center;
gap: 0.5rem;

/* Copy button */
button {
  background: rgba(79, 70, 229, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

button:hover {
  background: rgba(6, 182, 212, 0.3);
}
```

## Animations

### Page Load
```css
/* Fade in from bottom */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stagger delay for sections */
.section:nth-child(1) { animation-delay: 0s; }
.section:nth-child(2) { animation-delay: 0.1s; }
.section:nth-child(3) { animation-delay: 0.2s; }
```

### Hover Effects
```css
/* Card lift */
.card:hover {
  transform: translateY(-8px);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Glow effect */
.button:hover {
  box-shadow: 0 0 30px rgba(79, 70, 229, 0.6);
  transition: box-shadow 0.3s ease;
}

/* Scale */
.icon:hover {
  transform: scale(1.1);
  transition: transform 0.2s ease;
}
```

### Loading States
```css
/* Skeleton loading */
@keyframes skeleton {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1) 0%,
    rgba(148, 163, 184, 0.2) 50%,
    rgba(148, 163, 184, 0.1) 100%
  );
  background-size: 200px 100%;
  animation: skeleton 1.5s ease-in-out infinite;
}
```

### Pulse Effect
```css
/* For "Live" indicators */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.live-indicator {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

## Spacing System

```css
/* Use 4px base unit */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Breakpoints

```css
/* Mobile First */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Desktops */
--breakpoint-xl: 1280px;  /* Large desktops */
--breakpoint-2xl: 1536px; /* Extra large */
```

## Icons

### Icon Style
- **Outline style** for most UI elements
- **Solid style** for filled states
- **Size**: 24px default, 20px small, 32px large
- **Stroke width**: 1.5px

### Recommended Icon Sets
1. **Heroicons** - Modern, clean, perfect for web3
2. **Lucide** - Clean and consistent
3. **Feather** - Minimalist and elegant

### Key Icons Needed
- 🔗 Chain/Link (for bridging)
- ⚡ Lightning (for speed/compose)
- 🔒 Lock/Shield (for security)
- 📊 Chart (for stats)
- ✓ Check (for verification)
- 📋 Copy (for addresses)
- 🔄 Refresh/Sync (for updates)
- → Arrow (for flow diagrams)
- 🌐 Globe (for multi-chain)

## Layout

### Container Widths
```css
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;

/* Padding */
--container-padding: 1.5rem; /* Mobile */
--container-padding-lg: 3rem; /* Desktop */
```

### Grid System
```css
/* Features grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}
```

## Special Effects

### Background Gradient Mesh
```css
background: radial-gradient(
  ellipse at top,
  rgba(79, 70, 229, 0.15),
  transparent 50%
),
radial-gradient(
  ellipse at bottom,
  rgba(6, 182, 212, 0.1),
  transparent 50%
);
```

### Glass Morphism
```css
background: rgba(26, 26, 46, 0.4);
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Glow Effects
```css
/* Button glow */
box-shadow: 
  0 0 20px rgba(79, 70, 229, 0.4),
  0 0 40px rgba(79, 70, 229, 0.2),
  inset 0 0 20px rgba(79, 70, 229, 0.1);

/* Text glow */
text-shadow: 
  0 0 10px rgba(6, 182, 212, 0.6),
  0 0 20px rgba(6, 182, 212, 0.4);
```

## Accessibility

### Contrast Ratios
- **Headline text**: 7:1 (AAA)
- **Body text**: 4.5:1 (AA)
- **Large text**: 3:1 (AA)

### Focus States
```css
*:focus {
  outline: 2px solid #06b6d4;
  outline-offset: 2px;
}
```

### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Example Compositions

### Hero Section
```
┌──────────────────────────────────────────┐
│                                          │
│   [Eagle Logo]                           │
│                                          │
│   Eagle: Omnichain DeFi.                │
│   Simplified.                            │
│                                          │
│   Bridge tokens across 4 chains...      │
│                                          │
│   [Launch App]  [Read Docs]              │
│                                          │
│   [Animated Network Visualization]       │
│                                          │
└──────────────────────────────────────────┘
```

### Feature Card
```
┌──────────────────────┐
│  [Icon]              │
│                      │
│  Feature Title       │
│                      │
│  Short description   │
│  of the feature...   │
│                      │
│  [Learn More →]      │
└──────────────────────┘
```

### Address Block
```
┌────────────────────────────────────────┐
│ Eagle OFT (All Chains)                 │
│                                        │
│ 0x474eD38C...ab0eA91E    [Copy] [View] │
└────────────────────────────────────────┘
```

---

## Implementation Notes

1. **Use Tailwind CSS** for rapid development
2. **Implement dark mode only** (simpler, matches crypto aesthetic)
3. **Optimize images**: Use WebP format, lazy loading
4. **Performance**: Target < 3s page load
5. **Mobile first**: Design for mobile, enhance for desktop
6. **Animations**: Subtle and purposeful only
7. **Accessibility**: Keyboard navigation, screen reader support

## Tools & Resources

- **Color Contrast Checker**: https://colourcontrast.cc/
- **Gradient Generator**: https://cssgradient.io/
- **Icon Sets**: Heroicons, Lucide, Feather
- **Fonts**: Google Fonts (Inter), JetBrains Mono
- **Animations**: Framer Motion library
- **3D Background**: Three.js or Spline (optional)

---

**Remember**: Clean, modern, trustworthy, fast! ⚡

