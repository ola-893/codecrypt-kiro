# 🚀 Live Backend Demo Guide

## What Was Fixed

The frontend was hardcoded to use demo mode only. I've now connected it to the real backend SSE server that runs when you execute a resurrection.

## How to Run Your Demo

### Option 1: Live Backend (RECOMMENDED for demo)

1. **Open the frontend in your browser:**
   ```bash
   cd codecrypt/frontend
   npm run dev
   ```
   Open http://localhost:5173

2. **Start a resurrection from VS Code:**
   - Open VS Code with the CodeCrypt extension
   - Run command: "CodeCrypt: Resurrect Repository"
   - Enter a GitHub URL
   - The frontend will automatically connect to the live backend on port 3000
   - You'll see REAL-TIME updates as the resurrection happens!

3. **What you'll see:**
   - Status shows "● Live Connected" when backend is running
   - Real metrics, transformations, and narration events
   - Live compilation status updates
   - Real AST/LLM analysis results

### Option 2: Demo Mode (Fallback)

If the backend isn't running:
- The frontend will automatically fallback to demo mode after 2 connection attempts
- Status shows "● Demo Mode"
- Uses the pre-recorded demo-data.json

## Backend Connection Details

- **Backend SSE Server:** http://localhost:3000/events
- **Frontend Dev Server:** http://localhost:5173
- **Connection:** Automatic with 2 retry attempts
- **Fallback:** Demo mode activates if backend unavailable

## Key Changes Made

1. **App.tsx:**
   - Always tries to connect to `http://localhost:3000/events`
   - Fallback to demo mode only if connection fails
   - Shows "Live Connected" vs "Demo Mode" status
   - Removed production-only demo mode logic

2. **Connection Flow:**
   ```
   Frontend starts → Try localhost:3000 → Success? → Live mode
                                        → Fail? → Demo mode
   ```

## Troubleshooting

**"Connecting..." status stuck?**
- Make sure you've started a resurrection from VS Code
- The SSE server only starts when a resurrection is running
- After 2 failed attempts, it will switch to demo mode

**Want to force demo mode?**
- Just don't start a resurrection - it will auto-switch after a few seconds

**Backend not starting?**
- Check VS Code extension is activated
- Check for errors in VS Code Output panel (CodeCrypt channel)
- Verify port 3000 is not in use

## Demo Script

1. Open frontend: `cd codecrypt/frontend && npm run dev`
2. Open http://localhost:5173 - you'll see "Connecting..."
3. In VS Code, run "CodeCrypt: Resurrect Repository"
4. Enter a repo URL (e.g., https://github.com/user/old-repo)
5. Watch the frontend connect and show "● Live Connected"
6. See real-time updates as the resurrection progresses!
7. Enable audio for narration and symphony

## Production Deployment

For Netlify deployment, the frontend will still work in demo mode since there's no backend server in production. The live backend connection is for local development/demos only.
