# CreatorVault Design System

Extracted from visual documentation HTML files and implemented as reusable React components.

## 🎨 Color Palette

### Technical Colors (from docs)
```typescript
obsidian: {
  DEFAULT: '#0a0a0b',  // Deep background
  light: '#16161a',    // Elevated surfaces
  dark: '#050506',     // Deepest shadow
}

basalt: {
  DEFAULT: '#16161a',  // Card backgrounds
  light: '#2a2a32',    // Borders
  dark: '#0a0a0b',     // Subtle shadows
}

tension: {
  cyan: '#00f2ff',     // Primary accent
  blue: '#0044ff',     // Secondary accent
}

magma: {
  mint: '#00ffa3',     // Success / highlights
}

copper: {
  dull: '#4a3321',     // Warm accents
  bright: '#f59e0b',   // Warning / attention
}

signal: {
  cyan: '#06b6d4',     // Info
  pulse: '#22d3ee',    // Active states
}
```

### Usage
```tsx
<div className="bg-basalt border border-basalt-light">
  <span className="text-tension-cyan">Active</span>
</div>
```

## 📦 Components

### 1. PriceDiscoveryChart
Interactive bar chart for CCA price discovery visualization.

```tsx
import { PriceDiscoveryChart } from '@/components/PriceDiscoveryChart'

<PriceDiscoveryChart 
  data={[30, 35, 42, 55, 68, 85, 70, 50, 40, 30]}
  currentPrice={0.00148}
  className="h-64"
/>
```

**Props:**
- `data?: number[]` - Array of bid amounts/prices
- `currentPrice?: number` - Highlight current clearing price
- `className?: string` - Additional Tailwind classes

**Features:**
- Animated bars with staggered delays
- Hover tooltips showing values
- Current price indicator line
- Responsive design

---

### 2. BasinCard
Card component with technical aesthetic from docs/ajnastrategy.html.

```tsx
import { BasinCard } from '@/components/BasinCard'

<BasinCard 
  label="Ground Layer"
  title="Prerequisites"
  tag="Phase 01"
  accent="mint"
>
  <p>Your content here</p>
</BasinCard>
```

**Props:**
- `label?: string` - Small label above title
- `title: string` - Main heading
- `children: ReactNode` - Card content
- `tag?: string` - Top-right badge
- `accent?: 'cyan' | 'mint' | 'copper' | 'brand'` - Top border color
- `className?: string` - Additional classes

**Features:**
- Grain texture overlay
- Accent top border
- Hover lift effect
- Void shadow

---

### 3. FlowVisualization
Token/data flow diagram with animated lines.

```tsx
import { FlowVisualization } from '@/components/FlowVisualization'

<FlowVisualization
  title="Value Sifting Pipeline"
  nodes={[
    { label: 'User Swaps', value: '100 ETH' },
    { label: 'Tax Hook', highlight: true },
    { label: 'GaugeController' },
  ]}
  branches={[
    [{ label: '90% Lottery', value: '6.21%', highlight: true }],
    [{ label: '5% Creator', value: '0.345%' }],
    [{ label: '5% Protocol', value: '0.345%' }],
  ]}
/>
```

**Props:**
- `nodes: FlowNode[]` - Main flow nodes
- `branches?: FlowNode[][]` - Split flows at the end
- `title?: string` - Optional title
- `className?: string`

**FlowNode:**
```typescript
{
  label: string
  value?: string
  highlight?: boolean
}
```

**Features:**
- Animated node appearance
- Pulsing flow lines
- Branch visualization
- Configurable highlights

---

### 4. TechnicalMetric
Monospace metric display with loading states.

```tsx
import { TechnicalMetric, MetricGrid } from '@/components/TechnicalMetric'

<MetricGrid columns={3}>
  <TechnicalMetric
    label="Clearing Price"
    value="0.00148"
    suffix="ETH"
    size="xl"
    highlight
  />
  <TechnicalMetric
    label="Total Supply"
    value="10"
    suffix="M AKITA"
    icon={<Target className="w-3 h-3" />}
    loading={false}
  />
</MetricGrid>
```

**TechnicalMetric Props:**
- `label: string` - Metric name
- `value: string | number` - Metric value
- `suffix?: string` - Unit/suffix
- `icon?: ReactNode` - Optional icon
- `highlight?: boolean` - Cyan glow effect
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Value size
- `loading?: boolean` - Loading state
- `className?: string`

**MetricGrid Props:**
- `children: ReactNode`
- `columns?: 2 | 3 | 4` - Grid columns
- `className?: string`

**Features:**
- Monospace font
- Spring animations
- Loading pulse effect
- Responsive grid

---

### 5. ManifoldBackground
Animated SVG background pattern.

```tsx
import { ManifoldBackground } from '@/components/ManifoldBackground'

<div className="relative">
  <ManifoldBackground opacity={0.15} variant="cyan" />
  {/* Your content */}
</div>
```

**Props:**
- `opacity?: number` - Background opacity (0-1)
- `variant?: 'default' | 'copper' | 'cyan'` - Color scheme

**Features:**
- Flowing curves animation
- Diagonal grid lines
- Gradient strokes
- Non-intrusive background

---

## 🎭 Animations

### Keyframes Available
```css
/* Tension line slide */
animate-tension-slide

/* Particle sifting */
animate-sift-down

/* Flow animation */
animate-flow

/* Pulse ring */
animate-pulse-ring

/* Shimmer effect */
animate-shimmer
```

### Usage
```tsx
<div className="animate-tension-slide">
  Sliding element
</div>
```

---

## 🖼️ Textures & Effects

### Grain Overlay
```tsx
<div 
  className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
  style={{
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")`
  }}
/>
```

### Wire Grid
```tsx
<div 
  className="fixed inset-0 pointer-events-none opacity-[0.015]"
  style={{
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px'
  }}
/>
```

### Glow Effects
```css
/* Cyan glow */
shadow-glow-cyan

/* Mint glow */
shadow-glow-mint

/* Void shadow */
shadow-void
```

---

## 📝 Typography

### Font Families
```css
font-sans       /* Inter */
font-display    /* Space Grotesk, Inter */
font-mono       /* JetBrains Mono, Space Mono */
```

### Monospace Labels
```tsx
<span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
  SYSTEM_STATUS
</span>
```

---

## 🎨 Component Patterns

### Glass Card (Basalt Style)
```tsx
<div className="bg-basalt/80 backdrop-blur-md border border-basalt-light overflow-hidden">
  {/* Top accent */}
  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-tension-cyan to-transparent opacity-30" />
  
  <div className="p-8">
    {/* Content */}
  </div>

  {/* Grain overlay */}
  <div 
    className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
    style={{ backgroundImage: '...' }}
  />
</div>
```

### Technical Input
```tsx
<input 
  className="w-full bg-black/30 border border-basalt-light px-4 py-3 font-mono text-lg focus:border-tension-cyan focus:outline-none transition-colors"
  placeholder="0.0"
/>
```

### Primary Button (Tension Style)
```tsx
<button className="bg-tension-cyan hover:bg-tension-cyan/90 text-black py-4 px-6 font-mono uppercase tracking-wider transition-all border border-tension-cyan/30">
  Initialize Strategy
</button>
```

---

## 📱 Responsive Patterns

### Metric Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  {/* Metrics */}
</div>
```

### Two-Column Layout
```tsx
<div className="grid lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    {/* Main content */}
  </div>
  <div>
    {/* Sidebar */}
  </div>
</div>
```

---

## 🚀 Usage Example

See `frontend/src/pages/AuctionBid.tsx` for a complete implementation using all components with real contract data.

---

## 📚 Inspired By

- `docs/cca.html` - Price discovery visualization, manifold backgrounds
- `docs/ajnastrategy.html` - Basin cards, grain textures, sifting metaphors
- `docs/feearchitecture.html` - Flow diagrams, strata design
- `docs/creatorvaultfactory.html` - Technical metrics, schematic UI
- `docs/solana.html` - Glass effects, bilateral layouts
- `docs/vrf.html` - Copper tones, signal pulse animations

---

## 🎯 Design Principles

1. **Technical Aesthetic** - Monospace fonts, wire grids, precise spacing
2. **Subtle Motion** - Spring animations, flow effects, pulse glows
3. **Dark Foundation** - Obsidian/basalt backgrounds with accent highlights
4. **Layered Depth** - Grain textures, glass effects, void shadows
5. **Tension Accents** - Cyan/mint highlights for important elements
6. **Data-Driven** - All components accept real contract data



Extracted from visual documentation HTML files and implemented as reusable React components.

## 🎨 Color Palette

### Technical Colors (from docs)
```typescript
obsidian: {
  DEFAULT: '#0a0a0b',  // Deep background
  light: '#16161a',    // Elevated surfaces
  dark: '#050506',     // Deepest shadow
}

basalt: {
  DEFAULT: '#16161a',  // Card backgrounds
  light: '#2a2a32',    // Borders
  dark: '#0a0a0b',     // Subtle shadows
}

tension: {
  cyan: '#00f2ff',     // Primary accent
  blue: '#0044ff',     // Secondary accent
}

magma: {
  mint: '#00ffa3',     // Success / highlights
}

copper: {
  dull: '#4a3321',     // Warm accents
  bright: '#f59e0b',   // Warning / attention
}

signal: {
  cyan: '#06b6d4',     // Info
  pulse: '#22d3ee',    // Active states
}
```

### Usage
```tsx
<div className="bg-basalt border border-basalt-light">
  <span className="text-tension-cyan">Active</span>
</div>
```

## 📦 Components

### 1. PriceDiscoveryChart
Interactive bar chart for CCA price discovery visualization.

```tsx
import { PriceDiscoveryChart } from '@/components/PriceDiscoveryChart'

<PriceDiscoveryChart 
  data={[30, 35, 42, 55, 68, 85, 70, 50, 40, 30]}
  currentPrice={0.00148}
  className="h-64"
/>
```

**Props:**
- `data?: number[]` - Array of bid amounts/prices
- `currentPrice?: number` - Highlight current clearing price
- `className?: string` - Additional Tailwind classes

**Features:**
- Animated bars with staggered delays
- Hover tooltips showing values
- Current price indicator line
- Responsive design

---

### 2. BasinCard
Card component with technical aesthetic from docs/ajnastrategy.html.

```tsx
import { BasinCard } from '@/components/BasinCard'

<BasinCard 
  label="Ground Layer"
  title="Prerequisites"
  tag="Phase 01"
  accent="mint"
>
  <p>Your content here</p>
</BasinCard>
```

**Props:**
- `label?: string` - Small label above title
- `title: string` - Main heading
- `children: ReactNode` - Card content
- `tag?: string` - Top-right badge
- `accent?: 'cyan' | 'mint' | 'copper' | 'brand'` - Top border color
- `className?: string` - Additional classes

**Features:**
- Grain texture overlay
- Accent top border
- Hover lift effect
- Void shadow

---

### 3. FlowVisualization
Token/data flow diagram with animated lines.

```tsx
import { FlowVisualization } from '@/components/FlowVisualization'

<FlowVisualization
  title="Value Sifting Pipeline"
  nodes={[
    { label: 'User Swaps', value: '100 ETH' },
    { label: 'Tax Hook', highlight: true },
    { label: 'GaugeController' },
  ]}
  branches={[
    [{ label: '90% Lottery', value: '6.21%', highlight: true }],
    [{ label: '5% Creator', value: '0.345%' }],
    [{ label: '5% Protocol', value: '0.345%' }],
  ]}
/>
```

**Props:**
- `nodes: FlowNode[]` - Main flow nodes
- `branches?: FlowNode[][]` - Split flows at the end
- `title?: string` - Optional title
- `className?: string`

**FlowNode:**
```typescript
{
  label: string
  value?: string
  highlight?: boolean
}
```

**Features:**
- Animated node appearance
- Pulsing flow lines
- Branch visualization
- Configurable highlights

---

### 4. TechnicalMetric
Monospace metric display with loading states.

```tsx
import { TechnicalMetric, MetricGrid } from '@/components/TechnicalMetric'

<MetricGrid columns={3}>
  <TechnicalMetric
    label="Clearing Price"
    value="0.00148"
    suffix="ETH"
    size="xl"
    highlight
  />
  <TechnicalMetric
    label="Total Supply"
    value="10"
    suffix="M AKITA"
    icon={<Target className="w-3 h-3" />}
    loading={false}
  />
</MetricGrid>
```

**TechnicalMetric Props:**
- `label: string` - Metric name
- `value: string | number` - Metric value
- `suffix?: string` - Unit/suffix
- `icon?: ReactNode` - Optional icon
- `highlight?: boolean` - Cyan glow effect
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Value size
- `loading?: boolean` - Loading state
- `className?: string`

**MetricGrid Props:**
- `children: ReactNode`
- `columns?: 2 | 3 | 4` - Grid columns
- `className?: string`

**Features:**
- Monospace font
- Spring animations
- Loading pulse effect
- Responsive grid

---

### 5. ManifoldBackground
Animated SVG background pattern.

```tsx
import { ManifoldBackground } from '@/components/ManifoldBackground'

<div className="relative">
  <ManifoldBackground opacity={0.15} variant="cyan" />
  {/* Your content */}
</div>
```

**Props:**
- `opacity?: number` - Background opacity (0-1)
- `variant?: 'default' | 'copper' | 'cyan'` - Color scheme

**Features:**
- Flowing curves animation
- Diagonal grid lines
- Gradient strokes
- Non-intrusive background

---

## 🎭 Animations

### Keyframes Available
```css
/* Tension line slide */
animate-tension-slide

/* Particle sifting */
animate-sift-down

/* Flow animation */
animate-flow

/* Pulse ring */
animate-pulse-ring

/* Shimmer effect */
animate-shimmer
```

### Usage
```tsx
<div className="animate-tension-slide">
  Sliding element
</div>
```

---

## 🖼️ Textures & Effects

### Grain Overlay
```tsx
<div 
  className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
  style={{
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23filter)'/%3E%3C/svg%3E")`
  }}
/>
```

### Wire Grid
```tsx
<div 
  className="fixed inset-0 pointer-events-none opacity-[0.015]"
  style={{
    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px'
  }}
/>
```

### Glow Effects
```css
/* Cyan glow */
shadow-glow-cyan

/* Mint glow */
shadow-glow-mint

/* Void shadow */
shadow-void
```

---

## 📝 Typography

### Font Families
```css
font-sans       /* Inter */
font-display    /* Space Grotesk, Inter */
font-mono       /* JetBrains Mono, Space Mono */
```

### Monospace Labels
```tsx
<span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
  SYSTEM_STATUS
</span>
```

---

## 🎨 Component Patterns

### Glass Card (Basalt Style)
```tsx
<div className="bg-basalt/80 backdrop-blur-md border border-basalt-light overflow-hidden">
  {/* Top accent */}
  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-tension-cyan to-transparent opacity-30" />
  
  <div className="p-8">
    {/* Content */}
  </div>

  {/* Grain overlay */}
  <div 
    className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
    style={{ backgroundImage: '...' }}
  />
</div>
```

### Technical Input
```tsx
<input 
  className="w-full bg-black/30 border border-basalt-light px-4 py-3 font-mono text-lg focus:border-tension-cyan focus:outline-none transition-colors"
  placeholder="0.0"
/>
```

### Primary Button (Tension Style)
```tsx
<button className="bg-tension-cyan hover:bg-tension-cyan/90 text-black py-4 px-6 font-mono uppercase tracking-wider transition-all border border-tension-cyan/30">
  Initialize Strategy
</button>
```

---

## 📱 Responsive Patterns

### Metric Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  {/* Metrics */}
</div>
```

### Two-Column Layout
```tsx
<div className="grid lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    {/* Main content */}
  </div>
  <div>
    {/* Sidebar */}
  </div>
</div>
```

---

## 🚀 Usage Example

See `frontend/src/pages/AuctionBid.tsx` for a complete implementation using all components with real contract data.

---

## 📚 Inspired By

- `docs/cca.html` - Price discovery visualization, manifold backgrounds
- `docs/ajnastrategy.html` - Basin cards, grain textures, sifting metaphors
- `docs/feearchitecture.html` - Flow diagrams, strata design
- `docs/creatorvaultfactory.html` - Technical metrics, schematic UI
- `docs/solana.html` - Glass effects, bilateral layouts
- `docs/vrf.html` - Copper tones, signal pulse animations

---

## 🎯 Design Principles

1. **Technical Aesthetic** - Monospace fonts, wire grids, precise spacing
2. **Subtle Motion** - Spring animations, flow effects, pulse glows
3. **Dark Foundation** - Obsidian/basalt backgrounds with accent highlights
4. **Layered Depth** - Grain textures, glass effects, void shadows
5. **Tension Accents** - Cyan/mint highlights for important elements
6. **Data-Driven** - All components accept real contract data



