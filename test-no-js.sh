#!/bin/bash

echo "Testing pramit.gg SEO - Content visibility without JavaScript"
echo "============================================================"
echo ""

# Test homepage
echo "1. Testing Homepage..."
curl -s http://localhost:3000 | grep -q "pramit mazumder" && echo "✓ Hero text found" || echo "✗ Hero text NOT found"
curl -s http://localhost:3000 | grep -q "Featured" && echo "✓ Featured section found" || echo "✗ Featured section NOT found"
curl -s http://localhost:3000 | grep -q "All Posts" && echo "✓ All Posts section found" || echo "✗ All Posts section NOT found"
echo ""

# Test about page
echo "2. Testing About page..."
curl -s http://localhost:3000/about | grep -q "current focus" && echo "✓ About content found" || echo "✗ About content NOT found"
curl -s http://localhost:3000/about | grep -q "building software" && echo "✓ About details found" || echo "✗ About details NOT found"
echo ""

# Test a post page (you'll need to replace with an actual slug)
echo "3. Testing Post page (replace with actual slug)..."
echo "curl -s http://localhost:3000/post/[actual-slug] | grep -q 'post content'"
echo ""

echo "4. View source test instructions:"
echo "   - Open http://localhost:3000 in browser"
echo "   - Right-click → View Page Source"
echo "   - Search for 'pramit mazumder' and post titles"
echo "   - All content should be in the HTML"
echo ""

echo "5. Disable JavaScript test:"
echo "   - Open DevTools (F12)"
echo "   - Settings → Preferences → Disable JavaScript"
echo "   - Navigate the site - all content should be visible"