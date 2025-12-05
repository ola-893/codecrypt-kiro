#!/bin/bash

echo "🎃 CodeCrypt Netlify Login Helper 🎃"
echo "====================================="
echo ""
echo "Starting Netlify login process..."
echo ""
echo "📋 INSTRUCTIONS:"
echo "1. A browser window should open automatically"
echo "2. If it doesn't open, copy the URL that appears below"
echo "3. Paste it into your browser"
echo "4. Log in to Netlify and authorize the CLI"
echo "5. Return to this terminal once authorized"
echo ""
echo "Press ENTER to start the login process..."
read

# Start netlify login and capture output
netlify login

echo ""
echo "✅ Login process complete!"
echo ""
echo "Next steps:"
echo "  Run: cd codecrypt/frontend"
echo "  Then: ./deploy.sh"
echo ""
