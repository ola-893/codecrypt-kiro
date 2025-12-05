# 🧟 CodeCrypt

Bring dead code back to life with AI-powered modernization and dependency resurrection.

## 🚀 Quick Start

### 1. Install the Extension

Install CodeCrypt from the VS Code marketplace or build from source.

### 2. Configure LLM Provider

CodeCrypt needs an AI provider for semantic code analysis. Choose one:

**Option A: Anthropic Claude (Recommended)**
```bash
# Get API key from: https://console.anthropic.com/
# In VS Code, run: CodeCrypt: Configure Anthropic API Key
```

**Option B: Google Gemini**
```bash
# Get API key from: https://makersuite.google.com/app/apikey
# In VS Code, run: CodeCrypt: Configure Gemini API Key
```

### 3. Start Resurrection

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: `CodeCrypt: Resurrect Repository`
4. Enter a GitHub repository URL
5. Watch the magic happen! 🧟✨

### 4. View Live Dashboard

Open your browser to see the resurrection in real-time:
- **Local**: http://localhost:3001
- **Production**: https://codecrypt-demo.netlify.app

## ✨ Features

### 🔍 Death Detection
Analyzes repository activity and generates a "Death Certificate" identifying:
- Outdated dependencies
- Security vulnerabilities
- Deprecated APIs
- Dead code patterns

### 🤖 Hybrid Analysis
Combines AST (Abstract Syntax Tree) parsing with LLM semantic understanding to:
- Understand code structure
- Preserve developer intent
- Suggest idiomatic modernizations

### 🔄 Automated Updates
Intelligently updates dependencies with:
- Smart version resolution
- Dead URL detection and replacement
- Automatic lockfile regeneration
- Validation and rollback support

### 📊 Live Dashboard
Real-time visualization featuring:
- **Metrics Dashboard**: Charts showing progress
- **3D Ghost Tour**: Interactive code city visualization
- **AI Narration**: Voice explaining each step
- **Resurrection Symphony**: Music evolving with code quality
- **Compilation Status**: Before/after comparison

### 🐳 Time Machine Validation
Tests original vs. modernized code in Docker containers to prove functional equivalence.

## 📋 Requirements

- VS Code 1.106.1 or higher
- Node.js 16+ (for npm-based projects)
- Docker (optional, for Time Machine validation)
- API key for Anthropic Claude or Google Gemini

## 🎯 How It Works

```
1. Death Detection
   ↓
2. Hybrid Analysis (AST + LLM)
   ↓
3. Resurrection Planning
   ↓
4. Automated Resurrection
   ↓
5. Live Visualization
   ↓
6. Time Machine Validation
```

### Step-by-Step Process

1. **Death Detection**: Clones repository and analyzes for issues
2. **Hybrid Analysis**: Combines AST parsing with AI to understand code
3. **Resurrection Planning**: Creates detailed modernization plan
4. **Automated Resurrection**: Applies updates, runs tests, validates changes
5. **Live Visualization**: Streams real-time updates to dashboard
6. **Time Machine Validation**: Proves functional equivalence with Docker

## 🎮 Commands

- `🧟 CodeCrypt: Resurrect Repository` - Start resurrection
- `🔑 CodeCrypt: Configure Anthropic API Key` - Set up Claude
- `🔑 CodeCrypt: Configure Gemini API Key` - Set up Gemini
- `🔄 CodeCrypt: Switch LLM Provider` - Switch between providers
- `🔒 CodeCrypt: Configure GitHub Token` - Set up GitHub auth
- `🗑️ CodeCrypt: Clear All Secrets` - Remove stored API keys

## ⚙️ Configuration

### LLM Provider Settings

```json
{
  "codecrypt.llmProvider": "anthropic",  // or "gemini"
  "codecrypt.geminiModel": "gemini-3-pro-preview"
}
```

### Intelligent Fallback

CodeCrypt automatically falls back if the primary provider fails:

```
Primary LLM → Fallback LLM → AST-only Analysis
```

**Best Practice**: Configure both providers for maximum reliability.

## 🏗️ Development

### Backend (VS Code Extension)

```bash
cd codecrypt
npm install
npm run compile
```

### Frontend (Dashboard)

```bash
cd codecrypt/frontend
npm install
npm run dev  # Development server on http://localhost:3001
npm run build  # Production build
```

### Deploy Frontend

```bash
cd codecrypt/frontend
npm run build
npx netlify deploy --prod --dir=dist
```

## 📊 Dashboard Features

### Metrics Dashboard
Real-time charts showing:
- Dependencies updated
- Vulnerabilities fixed
- Code complexity
- Test coverage
- Lines of code

### 3D Ghost Tour
Interactive visualization where:
- Files are buildings
- Height = lines of code
- Color = change frequency
- Timeline shows evolution

### AI Narration
Voice commentary explaining:
- What's being updated
- Why changes are needed
- Progress status
- Errors and warnings

### Resurrection Symphony
Music that evolves based on:
- Code quality metrics
- Complexity reduction
- Test coverage increase
- Vulnerability fixes

## 🔒 Security

- API keys stored securely using VS Code SecretStorage
- Keys never logged or exposed
- Environment variables sanitized
- MCP server credentials validated

## 🐛 Troubleshooting

### Dashboard shows "Disconnected"
1. Make sure you've started a resurrection in VS Code
2. Check that the backend is running (extension is active)
3. Verify frontend is on http://localhost:3001

### "No LLM provider configured"
1. Run `CodeCrypt: Configure Anthropic API Key` or `CodeCrypt: Configure Gemini API Key`
2. Enter your API key
3. Restart VS Code

### Build fails after resurrection
1. Check the resurrection report for errors
2. Review removed dependencies
3. Run `npm install` manually
4. Check for breaking changes in updated packages

## 📚 Documentation

- [Dead URL Detection](./docs/dead-url-detection.md)
- [Package Replacement Registry](./docs/package-registry.md)
- [Build System Detection](./docs/build-systems.md)
- [LLM Provider Setup](./docs/llm-setup.md)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🎃 Kiroween Hackathon Project

CodeCrypt was created for the Kiroween Hackathon with a "resurrection" theme. All naming, UI/UX, and documentation embrace the spooky/gothic aesthetic.

---

**Made with 💀 by the CodeCrypt team**
