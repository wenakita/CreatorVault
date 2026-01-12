# Brand Kit

> **Standalone design system tool** for the CreatorVault protocol.

This is a self-contained design system application with its own dependencies. It can be run independently from the main frontend.

## Overview

The brand kit provides:
- **Protocol Identity System**: Colors, typography, and geometry specifications
- **Component Library**: Reusable UI components following the "Glass & Steel" aesthetic
- **AI Brand Guidelines**: Context file for LLMs to generate consistent UI/copy

## Running Independently

```bash
cd frontend/src/brand-kit
npm install  # or pnpm install
npm run dev
```

## AI & Brand Guidelines

See **[BRAND_GUIDELINES.md](./BRAND_GUIDELINES.md)** for the full brand context file. Paste this into any LLM to ensure generated code matches the ERCreator4626 aesthetic.

## Design Tokens

- **Typography**: Inter, JetBrains Mono, Doto
- **Colors**: Defined in `tailwind.config.js`
- **Motion**: Framer Motion physics curves
- **Geometry**: Super-ellipse specifications

## License

MIT License.