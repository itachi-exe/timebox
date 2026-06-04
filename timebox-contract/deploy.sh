#!/bin/bash
# Deploy TimeBox contract to Sui testnet
# Requires: sui CLI installed and a funded testnet wallet
# Run: chmod +x deploy.sh && ./deploy.sh

set -e

echo "Building TimeBox contract..."
sui move build

echo ""
echo "Publishing to Sui testnet..."
RESULT=$(sui client publish --gas-budget 100000000 --json)

PACKAGE_ID=$(echo "$RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for obj in data.get('objectChanges', []):
    if obj.get('type') == 'published':
        print(obj['packageId'])
        break
")

echo ""
echo "Deployed successfully!"
echo "Package ID: $PACKAGE_ID"
echo ""
echo "Add this to timebox-backend/.env:"
echo "CONTRACT_ADDRESS=$PACKAGE_ID"
