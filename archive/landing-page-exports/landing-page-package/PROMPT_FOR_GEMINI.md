# Prompt for Gemini: Eagle Project Landing Page

## Project Overview

Create a modern, professional landing page for **Eagle**, a revolutionary cross-chain DeFi protocol built on LayerZero V2 that enables seamless token bridging and composable operations across Base, Ethereum, BNB Chain, and Solana.

## What is Eagle?

Eagle is an **omnichain fungible token (OFT)** that serves as a liquid wrapper for yield-bearing vault shares. It enables users to:

1. **Bridge tokens across chains** in seconds (Base ↔ Ethereum ↔ BNB Chain ↔ Solana)
2. **Compose complex DeFi operations** in a single transaction
3. **Redeem for WLFI tokens** through an automated vault system
4. **Earn yield** through integrated strategies

## Key Innovation: 1-Transaction Compose Flow

The **ComposerV2** contract enables users to execute complex cross-chain operations in **ONE transaction**:

```
User on Base sends 1 EAGLE
    ↓
Bridges to Ethereum automatically
    ↓
Unwraps to vault shares
    ↓
Redeems for WLFI tokens
    ↓
Bridges WLFI back to Base
    ↓
User receives WLFI on Base
```

**All in ONE transaction!** No manual steps. No waiting. No claiming.

## Technical Architecture

### Multi-Chain Deployment

**Eagle Token (OFT)**: Deployed at `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E`
- Base (Primary Hub)
- Ethereum
- BNB Chain
- Solana

**WLFI Token (OFT)**: Deployed at `0x4769...96DC1` (Base), with adapters on:
- Ethereum: `0x2437F6555350c131647daA0C655c4B49A7aF3621`
- BNB Chain: `0x2437F6555350c131647daA0C655c4B49A7aF3621`
- Solana: (Solana OFT Address)

**ComposerV2** (Ethereum): `0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F`
- Orchestrates cross-chain redemption
- Automatic WLFI bridging
- Built-in refund mechanism

### Architecture Highlights

1. **Tri-Hub Model**: Base acts as the central liquidity hub
2. **Vanity Addresses**: Same `0x47...` address across all chains for easy verification
3. **LayerZero V2**: Ultra-secure cross-chain messaging with DVN verification
4. **EagleRegistry**: Dynamic endpoint management for upgradeability

## Key Features to Showcase

### 1. Cross-Chain Bridging
- **Instant bridging** across 4 blockchains
- **Same address** on all chains (0x474e...)
- **Verified by LayerZero** DVNs (Google, LayerZero Labs)
- **10-20 minute** cross-chain transfers

### 2. 1-Transaction Compose
- Send EAGLE from Base
- Automatically redeems for WLFI
- WLFI delivered back to Base
- **No manual claiming required**

### 3. Security Features
- **Automatic refunds** on failure
- **Slippage protection** built-in
- **Access control** with roles
- **Emergency pause** capability

### 4. User Benefits
- **Gas efficient**: Optimized LayerZero operations
- **Transparent**: All contracts verified on block explorers
- **Liquid**: Trade or bridge anytime
- **Yield-bearing**: Backed by productive vault strategies

## Landing Page Requirements

### Design Style
- **Modern & Professional**: Think Uniswap, AAVE, or Compound style
- **Dark mode preferred** with vibrant accent colors (blues, purples)
- **Smooth animations**: Subtle fade-ins, hover effects
- **Mobile responsive**: Perfect on all devices
- **Fast loading**: Optimized assets

### Page Sections

#### 1. Hero Section
- **Headline**: "Eagle: Omnichain DeFi. Simplified."
- **Subheadline**: "Bridge tokens across 4 chains and execute complex DeFi operations in one transaction"
- **CTA Buttons**: 
  - "Launch App" (primary, bright blue)
  - "Read Docs" (secondary, outline)
- **Visual**: Animated network diagram showing Base, Ethereum, BNB, Solana interconnected

#### 2. Key Features Grid (3-4 cards)
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Cross-Chain     │  │ 1-TX Compose    │  │ Secure & Safe   │
│ Bridging        │  │                 │  │                 │
│                 │  │                 │  │                 │
│ Bridge tokens   │  │ Complex DeFi in │  │ Automatic       │
│ across 4 chains │  │ one transaction │  │ refunds & DVN   │
│ in seconds      │  │                 │  │ verification    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### 3. "How It Works" Flow Diagram
Visual timeline showing:
1. User sends EAGLE on Base
2. Token bridges to Ethereum
3. Automatic redemption for WLFI
4. WLFI bridges back to Base
5. User receives WLFI

**Add visual indicators**: Chain logos, arrows, time estimates

#### 4. Network Support
Grid showing supported chains with logos:
- **Base** (Primary Hub) - Logo + "Primary Liquidity Hub"
- **Ethereum** - Logo + "ComposerV2 & OVault"
- **BNB Chain** - Logo + "Cross-chain Hub"
- **Solana** - Logo + "Cross-chain Hub"

#### 5. Technical Stats Dashboard
Real-time or static stats in cards:
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total Volume │  │ Transactions │  │ Chains       │  │ Security     │
│              │  │              │  │              │  │              │
│ $XXX,XXX     │  │ XX,XXX       │  │ 4 Networks   │  │ 2 DVNs       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

#### 6. Security & Trust
- **Verified Contracts**: Links to Etherscan, Basescan, etc.
- **Audited by**: (If applicable)
- **Powered by LayerZero V2**: Official logo and badge
- **DVN Verification**: Google & LayerZero Labs logos

#### 7. Addresses & Verification
Copyable addresses with "Verify on Explorer" links:
```
Eagle OFT (All Chains)
0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
[Copy] [Verify on Basescan]

WLFI OFT (Base)
0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e
[Copy] [Verify on Basescan]

ComposerV2 (Ethereum)
0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F
[Copy] [Verify on Etherscan]
```

#### 8. Documentation & Resources
Links to:
- Technical Documentation
- GitHub Repository
- LayerZero Scan (for transaction tracking)
- Community (Discord/Telegram/Twitter)

#### 9. Footer
- © 2025 Eagle Protocol
- Links: Docs | GitHub | Support | Terms
- "Built with LayerZero V2" badge

### Interactive Elements

1. **Network Switcher**: Allow users to see Eagle addresses on different chains
2. **Transaction Tracker**: Input field to track LayerZero cross-chain transfers
3. **Copy Address Buttons**: One-click copy for all contract addresses
4. **Animated Flow Diagram**: Show token movement across chains
5. **Hover Effects**: Cards lift/glow on hover

### Color Scheme Suggestions

**Primary Colors**:
- Background: `#0a0a0f` (Very dark blue-black)
- Surface: `#1a1a2e` (Dark blue-gray)
- Primary Accent: `#4f46e5` (Indigo blue - for CTAs)
- Secondary Accent: `#06b6d4` (Cyan - for highlights)

**Text Colors**:
- Primary: `#ffffff` (White)
- Secondary: `#94a3b8` (Light gray)
- Muted: `#64748b` (Medium gray)

**Status Colors**:
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Error: `#ef4444` (Red)

### Typography
- **Headlines**: Inter, SF Pro Display, or similar modern sans-serif
- **Body**: Inter or system fonts for readability
- **Code/Addresses**: JetBrains Mono or Fira Code (monospace)

### Tech Stack Recommendations
- **Framework**: Next.js 14+ (React) or Vite (React)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Heroicons or Lucide
- **3D Effects** (optional): Three.js for background
- **Blockchain Integration**: wagmi/viem (if adding wallet connect later)

## Important Notes for Gemini

1. **Focus on Simplicity**: The landing page should make cross-chain DeFi feel simple and accessible
2. **Trust & Security**: Emphasize LayerZero verification, contract verification, and automatic safety features
3. **Visual Appeal**: Use gradients, glows, and modern UI patterns
4. **Performance**: Fast load times are critical
5. **Responsive**: Mobile-first design
6. **Accessibility**: Proper contrast ratios, semantic HTML, keyboard navigation

## Key Messages to Convey

1. **"Cross-chain made simple"** - Emphasize ease of use
2. **"One transaction, infinite possibilities"** - Highlight Composer
3. **"Secured by LayerZero"** - Trust through established protocol
4. **"Same address everywhere"** - User convenience
5. **"Automatic & Safe"** - Built-in refunds and protection

## Assets Needed (You can use placeholders or generate)

1. **Chain Logos**: Base, Ethereum, BNB Chain, Solana (use official logos)
2. **LayerZero Logo**: Official branding
3. **Eagle Logo**: (Design a simple, modern eagle icon or abstract bird shape)
4. **Background**: Gradient mesh or abstract blockchain network visualization
5. **Icons**: Bridge, compose, security, speed (use Heroicons or similar)

## Deliverables

Please create:

1. **Landing Page (index.html + assets)** 
   - Fully responsive
   - Dark mode
   - Smooth animations
   - All sections mentioned above

2. **README.md** for the landing page explaining:
   - How to run it locally
   - Tech stack used
   - How to customize

3. **assets/** folder with:
   - Optimized images
   - SVG icons
   - Any generated graphics

## Example Flow to Visualize

```
┌─────────┐         ┌───────────┐         ┌──────────┐
│  User   │ ──1──>  │   Base    │ ──2──>  │ Ethereum │
│ on Base │         │ EAGLE OFT │         │ Composer │
└─────────┘         └───────────┘         └──────────┘
                                                 │
                                                 │ 3. Unwrap
                                                 │ 4. Redeem
                                                 │ 5. Bridge
                                                 ▼
┌─────────┐         ┌───────────┐         ┌──────────┐
│  User   │ <──6──  │   Base    │ <──5──  │ Ethereum │
│ + WLFI  │         │ WLFI OFT  │         │  WLFI    │
└─────────┘         └───────────┘         └──────────┘

All in ONE transaction initiated by user!
```

## Questions to Consider

- Should we add a "Live Demo" video or GIF?
- Should we include APY/yield information?
- Should we show total value locked (TVL)?
- Should we add a FAQ section?
- Should we include a newsletter signup?

**Default**: Include all of the above if it fits naturally!

---

## Final Notes

This landing page should feel **premium, modern, and trustworthy**. Think of it as the face of a serious DeFi protocol that's making cross-chain operations accessible to everyone.

Focus on:
1. ✨ **Visual appeal** - Modern, sleek, professional
2. 🔒 **Trust signals** - Verification, security, LayerZero
3. 🚀 **Simplicity** - Easy to understand, even for DeFi newcomers
4. ⚡ **Performance** - Fast, responsive, smooth
5. 📱 **Mobile-first** - Works perfectly on phones

Good luck! 🚀

