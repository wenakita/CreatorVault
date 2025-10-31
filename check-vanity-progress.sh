#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🎯 VANITY SALT SEARCH - STATUS CHECK                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check if process is running
if ps aux | grep -q "[g]enerate-registry-vanity-salt"; then
    echo "✅ Process is RUNNING"
    PID=$(ps aux | grep "[g]enerate-registry-vanity-salt" | awk '{print $2}')
    echo "   PID: $PID"
else
    echo "❌ Process is NOT running"
    echo "   Start it with: ./start-vanity-search.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if result file exists
if [ -f "registry-vanity-address.json" ]; then
    echo "🎉 VANITY ADDRESS FOUND!"
    echo ""
    cat registry-vanity-address.json | jq '.'
    echo ""
    echo "✅ Ready to deploy!"
    echo "   Next: Update script/DeployRegistryVanity.s.sol"
else
    echo "⏳ Still searching..."
    echo ""
    
    # Show last few lines of log
    if [ -f "registry-vanity.log" ]; then
        echo "Recent progress:"
        tail -5 registry-vanity.log
        echo ""
        
        # Try to extract attempts
        LAST_LINE=$(grep "Tried" registry-vanity.log | tail -1)
        if [ ! -z "$LAST_LINE" ]; then
            echo "Latest: $LAST_LINE"
        fi
    else
        echo "❌ Log file not found: registry-vanity.log"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Commands:"
echo "  Watch live:  tail -f registry-vanity.log"
echo "  Stop search: kill \$(ps aux | grep '[g]enerate-registry-vanity-salt' | awk '{print \$2}')"
echo ""

