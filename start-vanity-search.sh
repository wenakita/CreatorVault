#!/bin/bash

# Start vanity salt search for Registry in background
# This will take 2-3 hours to find pattern 0x47...ea91e

echo "Starting vanity salt search for EagleRegistry..."
echo "Pattern: 0x47...ea91e"
echo "Expected time: 2-3 hours"
echo ""
echo "Output will be saved to: registry-vanity.log"
echo "Result will be saved to: registry-vanity-address.json"
echo ""

nohup npx ts-node scripts/generate-registry-vanity-salt.ts > registry-vanity.log 2>&1 &

PID=$!
echo "Process started with PID: $PID"
echo ""
echo "To check progress:"
echo "  tail -f registry-vanity.log"
echo ""
echo "To stop:"
echo "  kill $PID"
echo ""
echo "When complete, the salt will be in: registry-vanity-address.json"

