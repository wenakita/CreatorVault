#!/bin/bash

# Verify Agent Briefing Setup
# This script confirms all agents will read AGENT_BRIEFING.md

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying Agent Briefing Setup...${NC}"
echo ""

FAILED=0

# Check files exist
echo -e "${BLUE}📁 Checking required files...${NC}"
FILES=(
  "AGENT_BRIEFING.md"
  "AGENT_INSTRUCTIONS.md"
  "ARCHITECTURE_OVERVIEW.md"
  "MULTI_AGENT_DEPLOYMENT_V2.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $file exists${NC}"
  else
    echo -e "${RED}❌ $file missing${NC}"
    FAILED=1
  fi
done

echo ""
echo -e "${BLUE}🤖 Checking agent prompts...${NC}"

# Check each agent prompt includes briefing
for agent in 2 3 4; do
  if grep -q "AGENT_BRIEFING.md" MULTI_AGENT_DEPLOYMENT_V2.md | grep -q "Agent $agent"; then
    echo -e "${GREEN}✅ Agent $agent will read briefing${NC}"
  else
    # More lenient check
    if grep -A 10 "Agent $agent" MULTI_AGENT_DEPLOYMENT_V2.md | grep -q "AGENT_BRIEFING.md"; then
      echo -e "${GREEN}✅ Agent $agent will read briefing${NC}"
    else
      echo -e "${RED}❌ Agent $agent won't read briefing${NC}"
      FAILED=1
    fi
  fi
done

echo ""
echo -e "${BLUE}📋 Checking briefing content...${NC}"

# Check critical content
if grep -qi "EagleRegistry" AGENT_BRIEFING.md; then
  echo -e "${GREEN}✅ Registry pattern documented${NC}"
else
  echo -e "${RED}❌ Registry pattern missing${NC}"
  FAILED=1
fi

if grep -qi "same address" AGENT_BRIEFING.md; then
  echo -e "${GREEN}✅ Same address requirement documented${NC}"
else
  echo -e "${RED}❌ Same address requirement missing${NC}"
  FAILED=1
fi

if grep -q "Agent 2" AGENT_BRIEFING.md; then
  echo -e "${GREEN}✅ Agent 2 section present${NC}"
else
  echo -e "${RED}❌ Agent 2 section missing${NC}"
  FAILED=1
fi

if grep -q "Agent 3" AGENT_BRIEFING.md; then
  echo -e "${GREEN}✅ Agent 3 section present${NC}"
else
  echo -e "${RED}❌ Agent 3 section missing${NC}"
  FAILED=1
fi

if grep -q "Agent 4" AGENT_BRIEFING.md; then
  echo -e "${GREEN}✅ Agent 4 section present${NC}"
else
  echo -e "${RED}❌ Agent 4 section missing${NC}"
  FAILED=1
fi

echo ""
echo -e "${BLUE}📊 Summary${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All checks passed! Agents will read the briefing.${NC}"
  echo ""
  echo -e "${BLUE}ℹ️  To update briefing for all agents:${NC}"
  echo "  1. Edit AGENT_BRIEFING.md"
  echo "  2. Add info under 'CRITICAL UPDATES'"
  echo "  3. Save - all agents see it automatically!"
  echo ""
  echo -e "${BLUE}ℹ️  To start agents:${NC}"
  echo "  1. Open 3 new Composer windows"
  echo "  2. Copy prompts from MULTI_AGENT_DEPLOYMENT_V2.md"
  echo "  3. Paste and run"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some checks failed!${NC}"
  echo ""
  echo -e "${YELLOW}⚠️  Please fix the issues above before starting agents.${NC}"
  echo ""
  exit 1
fi

