#!/bin/bash

# CodeCrypt Frontend Deployment Script
# This script helps deploy the CodeCrypt frontend to Netlify

set -e

echo "🎃 CodeCrypt Frontend Deployment 🎃"
echo "===================================="
echo ""

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Check if logged in
echo "📝 Checking Netlify authentication..."
if ! netlify status &> /dev/null; then
    echo "🔐 Please log in to Netlify..."
    netlify login
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
fi

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if site is linked
echo "🔗 Checking site linkage..."
if [ ! -f ".netlify/state.json" ]; then
    echo "🆕 Site not linked. Initializing..."
    echo ""
    echo "Please follow the prompts to create or link your site."
    echo "Recommended settings:"
    echo "  - Build command: npm run build"
    echo "  - Publish directory: dist"
    echo ""
    netlify init
fi

# Ask for deployment type
echo ""
echo "Choose deployment type:"
echo "  1) Preview deploy (test before going live)"
echo "  2) Production deploy (live site)"
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "🚀 Deploying preview..."
        netlify deploy
        ;;
    2)
        echo "🚀 Deploying to production..."
        netlify deploy --prod
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎉 Your CodeCrypt frontend is now live!"
echo "Check the URL above to view your site."
