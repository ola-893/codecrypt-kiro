# 🧟 CodeCrypt - AI-Powered Code Resurrection

> Bring dead code back to life with intelligent modernization, dependency resurrection, and real-time visualization.

[![Netlify Status](https://api.netlify.com/api/v1/badges/9392d745-de0d-44c4-ae33-e176d63199ae/deploy-status)](https://app.netlify.com/sites/codecrypt-demo/deploys)

**Live Demo**: [https://codecrypt-demo.netlify.app](https://codecrypt-demo.netlify.app)

## 🎯 What is CodeCrypt?

CodeCrypt is an autonomous AI agent that resurrects abandoned software projects. It combines deep code analysis with cutting-edge visualization to transform the complex process of modernizing legacy code into an engaging, interactive experience.

### Key Features

- 🔍 **Death Detection**: Identifies outdated dependencies, security vulnerabilities, and deprecated APIs
- 🤖 **Hybrid Analysis**: Combines AST parsing with LLM semantic understanding
- 🔄 **Smart Updates**: Intelligently resolves dependencies with dead URL detection and replacement
- 📊 **Live Dashboard**: Real-time metrics with animated charts
- 🏙️ **3D Ghost Tour**: Interactive code city visualization showing project evolution
- 🎵 **Resurrection Symphony**: Music that evolves with code quality
- 🗣️ **AI Narration**: Voice commentary explaining each step
- 🐳 **Time Machine Validation**: Docker-based testing proving functional equivalence

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- VS Code 1.106.1+
- Docker (optional, for Time Machine validation)
- API key for [Anthropic Claude](https://console.anthropic.com/) or [Google Gemini](https://makersuite.google.com/app/apikey)

### Installation

1. **Install the VS Code Extension**
   ```bash
   cd codecrypt
   npm install
   npm run compile
   ```

2. **Configure LLM Provider**
   - Open VS Code Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Run: `CodeCrypt: Configure Anthropic API Key` or `CodeCrypt: Configure Gemini API Key`
   - Enter your API key

3. **Start a Resurrection**
   - Command Palette → `CodeCrypt: Resurrect Repository`
   - Enter a GitHub repository URL
   - Watch the resurrection happen in real-time!

4. **View the Dashboard**
   - **Local**: http://localhost:3001 (when backend is running)
   - **Production**: https://codecrypt-demo.netlify.app

## 📁 Project Structure

```
codecrypt-kiro/
├── codecrypt/                    # VS Code Extension (Backend)
│   ├── src/
│   │   ├── extension.ts         # Extension entry point
│   │   ├── services/            # Core resurrection services
│   │   │   ├── resurrectionOrchestrator.ts
│   │   │   ├── dependencyAnalysis.ts
│   │   │   ├── hybridAnalysis.ts
│   │   │   ├── sseServer.ts     # Real-time event streaming
│   │   │   └── ...
│   │   └── test/                # Comprehensive test suite
│   ├── frontend/                # React Dashboard (Frontend)
│   │   ├── src/
│   │   │   ├── components/      # Dashboard, GhostTour, Symphony, Narrator
│   │   │   ├── context/         # State management
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   └── utils/           # Visualization utilities
│   │   ├── dist/                # Production build
│   │   └── netlify.toml         # Netlify deployment config
│   ├── data/                    # Package replacement registry
│   └── package.json
├── .kiro/
│   ├── specs/                   # Feature specifications
│   └── steering/                # Development guidelines
└── README.md                    # This file
```

## 🎮 How to Use

### For Users

1. **Start Resurrection**
   ```
   VS Code → Command Palette → CodeCrypt: Resurrect Repository
   ```

2. **Monitor Progress**
   - Watch the VS Code progress indicator
   - Open http://localhost:3001 for live dashboard
   - Listen to AI narration explaining each step
   - Explore the 3D Ghost Tour visualization

3. **Review Results**
   - Check the resurrection report
   - Review updated dependencies
   - Validate with Time Machine tests
   - Commit the modernized code

### For Developers

#### Backend Development

```bash
cd codecrypt
npm install
npm run compile        # Compile TypeScript
npm test              # Run tests
npm run watch         # Watch mode for development
```

#### Frontend Development

```bash
cd codecrypt/frontend
npm install
npm run dev           # Start dev server on http://localhost:5173
npm run build         # Production build
npm test              # Run tests
```

#### Deploy Frontend to Netlify

```bash
cd codecrypt/frontend
npm run build
netlify deploy --prod
```

## 🏗️ Architecture

CodeCrypt uses a dual-stream architecture:

### Core Pipeline (Backend)
```
Death Detection → Hybrid Analysis → Planning → Resurrection → Validation
```

### Live Experience Layer (Frontend)
```
SSE Events → State Management → Real-time Visualization
```

### Technology Stack

**Backend (VS Code Extension)**
- TypeScript
- Octokit (GitHub API)
- Anthropic SDK / Google Generative AI
- Babel & ts-morph (AST parsing)
- Docker SDK

**Frontend (Dashboard)**
- React 18
- Three.js (3D visualization)
- Chart.js (metrics dashboard)
- Tone.js (audio synthesis)
- Web Speech API (narration)
- Vite (build tool)

## 📊 Dashboard Components

### Metrics Dashboard
Real-time animated charts showing:
- Dependencies updated
- Vulnerabilities fixed
- Code complexity trends
- Test coverage
- Lines of code changes

### 3D Ghost Tour
Interactive code city where:
- Files are buildings (height = LOC)
- Colors indicate change frequency
- Timeline slider shows evolution
- Click buildings to see details

### AI Narrator
Voice commentary that explains:
- Current resurrection step
- Why changes are needed
- Progress and status
- Errors and warnings

### Resurrection Symphony
Dynamic music that reflects:
- Code quality metrics
- Complexity reduction
- Test coverage increase
- Overall project health

### Compilation Status
Before/after comparison showing:
- Original compilation state
- Modernized compilation state
- Build success/failure
- Error counts

## 🔒 Security & Privacy

- API keys stored securely using VS Code SecretStorage
- Keys never logged or exposed in code
- Environment variables sanitized
- MCP server credentials validated
- No data sent to external services except configured LLM providers

## 🐛 Troubleshooting

### Dashboard shows "Backend Not Connected"
- Ensure you've started a resurrection in VS Code
- The backend SSE server runs on port 3000 when resurrection is active
- Frontend connects to http://localhost:3000/events

### "No LLM provider configured" error
1. Run `CodeCrypt: Configure Anthropic API Key` or `CodeCrypt: Configure Gemini API Key`
2. Enter your API key
3. Restart VS Code

### Build fails after resurrection
1. Review the resurrection report for errors
2. Check removed/updated dependencies
3. Run `npm install` manually
4. Review breaking changes in updated packages

### Frontend not updating in real-time
- Check browser console for connection errors
- Verify backend is running (extension is active)
- Ensure no firewall blocking localhost:3000

## 📚 Documentation

- [VS Code Extension README](./codecrypt/README.md)
- [Frontend README](./codecrypt/frontend/README.md)
- [Development Strategy](./codecrypt/.kiro/DEVELOPMENT_STRATEGY.md)
- [Spec Overview](./codecrypt/.kiro/SPEC_OVERVIEW.md)
- [Demo Guide](./codecrypt/DEMO_GUIDE.md)

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow the spooky/gothic theme 🎃
- Use async/await for async operations
- Add JSDoc comments for public APIs

## 📄 License

MIT License - see LICENSE file for details

## 🎃 Kiroween Hackathon

CodeCrypt was created for the Kiroween Hackathon with a "resurrection" theme. The project embraces a spooky/gothic aesthetic throughout its naming, UI/UX, and documentation.

## 🙏 Acknowledgments

- Built with [Kiro](https://kiro.dev) - AI-powered development environment
- Powered by [Anthropic Claude](https://www.anthropic.com/) and [Google Gemini](https://deepmind.google/technologies/gemini/)
- Visualization powered by [Three.js](https://threejs.org/), [Chart.js](https://www.chartjs.org/), and [Tone.js](https://tonejs.github.io/)
- Deployed on [Netlify](https://www.netlify.com/)

## 📞 Support

- 🐛 [Report a Bug](https://github.com/yourusername/codecrypt-kiro/issues)
- 💡 [Request a Feature](https://github.com/yourusername/codecrypt-kiro/issues)
- 📧 Contact: olaoluwamercydeborah@gmail.com

---

**Made with 💀 and ❤️ for the Kiroween Hackathon**

*Bringing dead code back to life, one repository at a time.*
