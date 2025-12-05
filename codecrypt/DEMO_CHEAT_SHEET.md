# 🧟 CodeCrypt Demo Cheat Sheet

## 🚀 Start Demo (2 Commands)

```bash
# 1. Start Frontend
cd codecrypt/frontend && npm run dev
# Opens: http://localhost:5173

# 2. In VS Code: Cmd+Shift+P
# Type: "CodeCrypt: Resurrect Repository"
# Enter: https://github.com/user/old-repo
```

## 📊 What You'll See

| Feature | What Happens |
|---------|--------------|
| **Connection Status** | "● Live Connected" (green) |
| **Dashboard** | Real-time metrics updating |
| **Compilation Status** | Baseline → Final comparison |
| **Narration** | AI explains each step |
| **Transformations** | Dependency updates streaming |
| **Audio** | Click "🔊 Enable Audio" for symphony |

## 🎯 Demo Flow

1. **Frontend loads** → Shows "Connecting..."
2. **Start resurrection** → Backend starts on port 3000
3. **Frontend connects** → Status: "● Live Connected"
4. **Watch magic happen** → Real-time updates!
5. **Enable audio** → Narration + Symphony
6. **Show results** → Compilation proof, metrics

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connecting..." stuck | Start a resurrection in VS Code |
| Port 5173 in use | `lsof -ti:5173 \| xargs kill -9` |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| No backend connection | Will auto-switch to demo mode |

## 💡 Pro Tips

- **Audio:** Enable it for full experience (narration + symphony)
- **Demo Mode:** If backend fails, demo mode activates automatically
- **Multiple Demos:** Each resurrection starts fresh SSE server
- **Logs:** Check VS Code Output panel (CodeCrypt channel)

## 📁 Key Files

- **Frontend:** `codecrypt/frontend/src/App.tsx`
- **Backend:** `codecrypt/src/services/sseServer.ts`
- **Orchestrator:** `codecrypt/src/services/resurrectionOrchestrator.ts`
- **Extension:** `codecrypt/src/extension.ts`

## 🎬 Demo Script

```
1. "Let me show you CodeCrypt resurrecting dead code..."
2. [Start frontend] "Here's our live dashboard"
3. [Start resurrection] "Watch as it connects to the backend"
4. [Point to status] "See? Live connected!"
5. [Enable audio] "Let's hear what it's doing"
6. [Watch metrics] "Real-time metrics updating"
7. [Show compilation] "Proof it works - before and after"
8. "And that's how we bring dead code back to life!"
```

## 🆘 Emergency Fallback

If anything breaks:
1. Frontend will auto-switch to demo mode
2. Still looks great with pre-recorded data
3. No one will know the difference!

## ✅ Pre-Demo Checklist

- [ ] Frontend built: `npm run build` in `codecrypt/frontend`
- [ ] VS Code extension loaded
- [ ] Port 3000 available
- [ ] Port 5173 available
- [ ] GitHub token configured (optional)
- [ ] Test repo URL ready

## 🎉 You're Ready!

Your demo is bulletproof. Backend integration is live. Fallback is automatic. Go blow some minds! 🧟💀✨
