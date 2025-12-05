# 🧟 START YOUR DEMO NOW!

## Quick Start (2 steps)

### Step 1: Start the Frontend
```bash
cd codecrypt/frontend
npm run dev
```
Open: **http://localhost:5173**

### Step 2: Start a Resurrection in VS Code
1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: **"CodeCrypt: Resurrect Repository"**
4. Enter a GitHub URL (e.g., `https://github.com/user/old-repo`)
5. Watch the magic happen! ✨

## What You'll See

- Frontend connects to backend automatically
- Status shows **"● Live Connected"**
- Real-time metrics, transformations, and narration
- Live compilation status
- AST/LLM analysis results streaming in

## Demo Tips

1. **Enable Audio:** Click the "🔊 Enable Audio Experience" button for narration and symphony
2. **Watch the Dashboard:** See metrics update in real-time
3. **Check Compilation Status:** See baseline vs final compilation results
4. **Narration Panel:** AI narrator explains what's happening

## If Backend Isn't Running

- Frontend will show "Connecting..." for a few seconds
- Then automatically switches to "● Demo Mode"
- Uses pre-recorded demo data
- Still looks great for demos!

## Troubleshooting

**Frontend won't connect?**
- Make sure you started a resurrection in VS Code
- Backend only runs during active resurrections
- Check VS Code Output panel for errors

**Port 5173 in use?**
- Kill the process: `lsof -ti:5173 | xargs kill -9`
- Or use a different port: `npm run dev -- --port 5174`

**Port 3000 in use?**
- Backend SSE server needs port 3000
- Kill the process: `lsof -ti:3000 | xargs kill -9`

## Ready? GO! 🚀

```bash
# Terminal 1: Start frontend
cd codecrypt/frontend && npm run dev

# VS Code: Run resurrection command
# Cmd+Shift+P → "CodeCrypt: Resurrect Repository"
```

Your demo is ready to blow minds! 🧟💀✨
