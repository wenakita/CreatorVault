#!/bin/bash

# Quick Switch Script - Eagle Vault Modern UI
# This script switches between old and new UI versions

echo "🎨 Eagle Vault - UI Switcher"
echo "=============================="
echo ""

cd "$(dirname "$0")/src"

if [ -f "AppModern.tsx" ] && [ ! -f "App.old.tsx" ]; then
    echo "📦 Switching to MODERN UI..."
    mv App.tsx App.old.tsx
    mv AppModern.tsx App.tsx
    echo "✅ Modern UI activated!"
    echo ""
    echo "Run: npm run dev"
elif [ -f "App.old.tsx" ]; then
    echo "🔄 Switching back to ORIGINAL UI..."
    mv App.tsx AppModern.tsx
    mv App.old.tsx App.tsx
    echo "✅ Original UI restored!"
    echo ""
    echo "Run: npm run dev"
else
    echo "❌ Error: Files not found"
    echo "Make sure you're in the frontend directory"
    exit 1
fi

echo ""
echo "Current UI: $(grep -q "AppModern" App.tsx 2>/dev/null && echo "Modern (Yearn-style)" || echo "Original")"

