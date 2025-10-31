#!/bin/bash

# Eagle OVault Frontend Deployment Script
# Agent 2: Frontend Developer
# Date: October 31, 2025

set -e  # Exit on error

echo "╔════════════════════════════════════════════╗"
echo "║   EAGLE OVAULT FRONTEND DEPLOYMENT        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from frontend directory${NC}"
    exit 1
fi

# Step 1: Verify production addresses
echo -e "${YELLOW}📋 Step 1: Verifying production addresses...${NC}"
if grep -q "0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953" src/config/contracts.ts; then
    echo -e "${GREEN}✅ Production addresses verified${NC}"
else
    echo -e "${RED}❌ Production addresses not found. Did you update contracts.ts?${NC}"
    exit 1
fi

# Step 2: Check environment file
echo -e "${YELLOW}📋 Step 2: Checking environment file...${NC}"
if [ -f ".env.production" ]; then
    echo -e "${GREEN}✅ .env.production found${NC}"
else
    echo -e "${RED}❌ .env.production not found${NC}"
    exit 1
fi

# Step 3: Install dependencies
echo -e "${YELLOW}📦 Step 3: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4: Run type check
echo -e "${YELLOW}🔍 Step 4: Running type check...${NC}"
npm run lint
echo -e "${GREEN}✅ Type check passed${NC}"

# Step 5: Build for production
echo -e "${YELLOW}🏗️  Step 5: Building for production...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 6: Show build stats
echo ""
echo -e "${YELLOW}📊 Build Statistics:${NC}"
if [ -d "dist" ]; then
    echo "  Total files: $(find dist -type f | wc -l)"
    echo "  Total size: $(du -sh dist | cut -f1)"
    echo ""
fi

# Step 7: Preview option
echo -e "${YELLOW}🎯 Deployment Options:${NC}"
echo ""
echo "  1. Test locally:"
echo "     ${GREEN}npm run preview${NC}"
echo ""
echo "  2. Deploy to Vercel:"
echo "     ${GREEN}vercel --prod${NC}"
echo ""
echo "  3. Or push to main branch (auto-deploy):"
echo "     ${GREEN}git add .${NC}"
echo "     ${GREEN}git commit -m 'Deploy production (Oct 31, 2025)'${NC}"
echo "     ${GREEN}git push origin main${NC}"
echo ""

# Success message
echo "╔════════════════════════════════════════════╗"
echo "║   ✅ BUILD SUCCESSFUL                      ║"
echo "║   🚀 Ready for deployment!                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Ask if user wants to preview
read -p "Would you like to preview the build? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Starting preview server...${NC}"
    npm run preview
fi

