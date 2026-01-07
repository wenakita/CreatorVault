# On-Chain Reputation System

A comprehensive reputation aggregator that pulls from multiple on-chain data sources to create a unified creator trust score.

## 🎯 Overview

The On-Chain Reputation System aggregates data from:

1. **[Talent Protocol](https://talent.app/)** - Builder scores, verified credentials, social links
2. **[Guild.xyz](https://guild.xyz/base)** - Base Guild roles and achievements
3. **[Basenames](https://docs.base.org/base-account/basenames/)** - ENS-like names on Base
4. **[Zora](https://zora.co/)** - Creator profiles and NFT activity

## 📊 Data Sources

### 1. Talent Protocol

**Endpoint:** `https://api.talentprotocol.com/api/v2/passports/{address}`

**Data Collected:**
- Talent Score (0-100)
- Builder Rank (e.g., #317)
- Verified status
- Activity score, Identity score, Skills score
- Social links (Twitter, GitHub, Discord, Telegram, Farcaster)
- Credentials and verifications
- Creator Coin stats (market cap, volume, holders)

**Example:**
```typescript
const passport = await getTalentPassport('0xA015954E2606d08967Aee3787456bB3A86a46A42')
// Returns: { score: 75, rank: 317, verified: true, ... }
```

### 2. Guild.xyz Base Guild

**Endpoint:** `https://api.guild.xyz/v2/users/{address}/memberships`

**Data Collected:**
- Caster Rank (10k+, 50k+, 100k+ followers on Farcaster)
- X Creator Rank (10k+, 50k+, 100k+ followers on Twitter/X)
- Base Social Score (0-100+)
- Builder Status (Based Developer, Recognized by Base)
- Coinbase Verified status
- Based status (owns a Basename)
- Onchain activity status

**Example Roles:**
- ✓ Based (has Basename)
- ✓ Onchain (made transactions on Base)
- ✓ Caster: 50k+ (50k+ Farcaster followers)
- ✓ X Creator: 10k+ (10k+ Twitter followers)
- ✓ Recognized by Base

### 3. Basenames

**Resolution:** Uses viem's ENS resolution on Base L2

**Data Collected:**
- Basename (e.g., "akita.base.eth")
- Avatar
- Display name
- Description
- Social links (Twitter, GitHub, Discord, Email, Website)

**Example:**
```typescript
const basename = await getBasenameProfile('0x...')
// Returns: { name: 'akita.base.eth', avatar: '...', twitter: '@wenakita', ... }
```

### 4. Zora

**Endpoint:** `https://api.zora.co/graphql`

**Data Collected:**
- Creator name and description
- Avatar
- Social media links
- NFT collections and activity

## 🧮 Reputation Scoring Algorithm

### Overall Score Calculation (0-100)

The aggregated reputation score is calculated using a **weighted average**:

```
Total Score = (Talent Score × 0.4) + (Guild Score × 0.3) + 
              (Verification Score × 0.2) + (Basename Bonus × 0.1)
```

### Component Scores

#### 1. **Guild Score** (0-100)
```typescript
Base scores:
- isBased: +20 points
- isOnchain: +15 points
- isBuilder: +20 points
- isCreator: +15 points
- isCoinbaseVerified: +10 points

Rank bonuses:
- Caster 100k+: +20
- Caster 50k+: +15
- Caster 10k+: +10
- X Creator 100k+: +20
- X Creator 50k+: +15
- X Creator 10k+: +10

Social Score: +min(baseSocialScore, 20)

Max: 100 points
```

#### 2. **Verification Trust Score** (0-100)
```typescript
- Talent Verified: +40
- Coinbase Verified: +30
- Has Basename: +30

Max: 100 points
```

#### 3. **Basename Bonus**
- Has Basename: 100 points (10% weight)
- No Basename: 0 points

### Reputation Levels

Based on the total score:

| Score Range | Level | Color |
|-------------|-------|-------|
| 90-100 | **Legendary** | Gold/Orange gradient |
| 75-89 | **Elite** | Purple/Pink gradient |
| 50-74 | **Established** | Blue/Cyan gradient |
| 25-49 | **Rising** | Green/Emerald gradient |
| 0-24 | **New** | Gray gradient |

## 🏆 Achievement Badges

Badges are automatically assigned based on credentials:

| Badge | Criteria |
|-------|----------|
| ✓ Talent Verified | Verified on Talent Protocol |
| ⭐ Top Builder | Talent Score ≥ 80 |
| 🏆 Recognized by Base | Has "Recognized by Base" Guild role |
| 📢 Mega Caster | Caster 100k+ |
| 📢 Active Caster | Caster 10k+ or 50k+ |
| 𝕏 Major Creator | X Creator 100k+ |
| 𝕏 Content Creator | X Creator 10k+ or 50k+ |
| ✓ Coinbase Verified | Verified through Coinbase |
| 🔷 Based | Has a Basename |
| ⚡ Onchain Active | Made transactions on Base |
| 🛠️ Builder | GitHub commits / Builder role |

## 📈 Social Reach Estimation

Estimates total social reach across platforms:

```typescript
Farcaster:
- Caster 100k+: 100,000 reach
- Caster 50k+: 50,000 reach
- Caster 10k+: 10,000 reach

Twitter/X:
- X Creator 100k+: 100,000 reach
- X Creator 50k+: 50,000 reach
- X Creator 10k+: 10,000 reach

Total Reach = Farcaster + Twitter/X
```

## 🎨 UI Components

### OnchainReputationCard

The main component that displays aggregated reputation:

```tsx
<OnchainReputationCard 
  creatorAddress="0xA015954E2606d08967Aee3787456bB3A86a46A42"
/>
```

**Features:**
- Overall reputation score with color-coded level
- Trust score percentage
- Talent Protocol score and rank
- Social reach estimate
- Achievement badges
- Guild role breakdown
- Links to verification sources
- Investment signal for high-reputation creators (score ≥ 60)

### Data Flow

```
1. Component mounts with creator address
2. Fetches data in parallel from all sources:
   - getTalentPassport()
   - getBaseGuildStats()
   - getBasenameProfile()
   - getZoraCreatorProfile()
3. Aggregates data using reputation-aggregator
4. Calculates scores and badges
5. Renders with animations
```

## 🔧 API Setup

### Required Environment Variables

```bash
# Frontend .env
VITE_TALENT_API_KEY=your_talent_api_key_here
```

### Installation

No additional packages needed beyond existing:
- `viem` (for Basename resolution)
- `framer-motion` (for animations)

## 📖 Usage Examples

### Basic Usage

```tsx
import { OnchainReputationCard } from '@/components/cca/OnchainReputationCard'

function AuctionPage() {
  return (
    <OnchainReputationCard 
      creatorAddress="0xA015954E2606d08967Aee3787456bB3A86a46A42"
    />
  )
}
```

### Programmatic Access

```typescript
import { getOnchainReputation } from '@/lib/reputation-aggregator'

const reputation = await getOnchainReputation('0x...')

console.log(reputation.aggregated.totalScore) // 75
console.log(reputation.aggregated.reputationLevel) // "Elite"
console.log(reputation.aggregated.badges) // ["✓ Talent Verified", "🔷 Based", ...]
console.log(reputation.aggregated.trustScore) // 80
console.log(reputation.aggregated.socialReach) // 150000
```

### Format for Display

```typescript
import { formatReputation } from '@/lib/reputation-aggregator'

const formatted = formatReputation(reputation)

console.log(formatted.score) // "75/100"
console.log(formatted.level) // "Elite"
console.log(formatted.badges) // "✓ Talent Verified 🔷 Based ⭐ Top Builder"
console.log(formatted.trust) // "80% verified"
console.log(formatted.reach) // "150k+ reach"
```

## 🚀 Future Enhancements

Potential additional data sources:

1. **Farcaster** - Direct API integration for cast history and engagement
2. **Lens Protocol** - Social graph and reputation
3. **Gitcoin Passport** - Additional verification stamps
4. **DegenScore** - Onchain activity scoring
5. **Snapshot** - DAO participation and governance
6. **Mirror** - Content creation history
7. **ENS** - Ethereum mainnet identity
8. **POAP** - Proof of attendance badges

## 🔒 Privacy & Security

- All data is fetched from public APIs and on-chain sources
- No private information is collected
- API keys are stored in environment variables (never exposed to client)
- Creator addresses are public blockchain addresses
- Users control their reputation by managing their on-chain presence

## 📚 References

- [Talent Protocol Docs](https://docs.talentprotocol.com/)
- [Guild.xyz GitHub](https://github.com/guildxyz/guild.xyz)
- [Base Guild](https://guild.xyz/base)
- [Basenames Docs](https://docs.base.org/base-account/basenames/)
- [Zora API Docs](https://docs.zora.co/docs/zora-api/intro)

## 💡 Investment Use Case

For investors evaluating creators:

**High Trust Signals (Score ≥ 60):**
- ✅ Multiple verification sources
- ✅ Strong social presence
- ✅ Active on-chain history
- ✅ Recognized by established protocols

**Red Flags (Score < 30):**
- ⚠️ No verifications
- ⚠️ No social presence
- ⚠️ New wallet with no history
- ⚠️ No Guild roles or badges

The system provides a **data-driven trust score** to help investors make informed decisions during token auctions.



