#!/bin/bash

# Test script for A5 cross-check CLI
echo "🧪 Testing A5 Cross-Check CLI"
echo "=============================="

# Test resolutions 1-5
for resolution in {1..3}; do
    echo "Testing resolution $resolution..."
    if node index.js $resolution test-res$resolution.geojson; then
        echo "✅ Resolution $resolution test passed"
        rm -f test-res$resolution.geojson
    else
        echo "❌ Resolution $resolution test failed"
        exit 1
    fi
    echo ""
done
echo "🎉 All tests passed! The cross-check tool is working correctly."