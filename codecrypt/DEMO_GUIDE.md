# 🧟 CodeCrypt Demo Guide

## Live Demo URL
**https://codecrypt-demo.netlify.app**

## Overview
CodeCrypt is an AI-powered VS Code extension that resurrects abandoned GitHub repositories by automatically modernizing dependencies, fixing vulnerabilities, and providing a stunning multi-sensory visualization of the resurrection process.

## Demo Flow

### 1. Frontend Demo (Netlify - No Setup Required)
Visit **https://codecrypt-demo.netlify.app** to see the live dashboard.

#### What You'll See:
- **Demo Mode Banner** - Indicates you're viewing sample data
- **Live Metrics Dashboard** - Animated charts showing:
  - Code complexity trends
  - Test coverage improvements
  - Dependencies updated over time
  - Vulnerabilities fixed
- **Real-time Updates** - Events stream in automatically every 1.5 seconds
- **Connection Status** - Shows "Demo Mode" in purple

#### Features to Highlight:
1. **Animated Counters** - Watch metrics increment in real-time
2. **Chart Visualizations** - Multiple chart types (line, bar, doughnut)
3. **Gothic Theme** - Spooky resurrection aesthetic
4. **Responsive Design** - Works on all screen sizes

### 2. Full Extension Demo (VS Code)

#### Prerequisites:
- VS Code installed
- Node.js 18+ installed
- GitHub token (for API access)
- Gemini API key (for LLM analysis)

#### Setup Steps:

1. **Open the Extension in VS Code**
   ```bash
   cd codecrypt
   code .
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "CodeCrypt: Configure GitHub Token"
   - Enter your GitHub personal access token
   - Type "CodeCrypt: Configure Gemini API Key"
   - Enter your Gemini API key

4. **Run the Extension**
   - Press `F5` to launch Extension Development Host
   - A new VS Code window will open with the extension loaded

5. **Start a Resurrection**
   - In the new window, press `Cmd+Shift+P` / `Ctrl+Shift+P`
   - Type "CodeCrypt: Resurrect Repository"
   - Enter a GitHub URL (e.g., `https://github.com/zcourts/jison`)
   - Watch the magic happen!

#### What Happens:

**Stage 1: Death Detection**
- Clones the repository
- Analyzes commit history
- Generates a "Death Certificate" with cause of death

**Stage 2: Dependency Analysis**
- Scans package.json
- Checks for outdated dependencies
- Identifies security vulnerabilities
- Detects dead URLs in dependencies

**Stage 3: Resurrection Planning**
- Creates a modernization plan
- Prioritizes security patches
- Plans dependency updates
- Creates a resurrection branch

**Stage 4: Execution**
- Updates dependencies intelligently
- Fixes breaking changes
- Runs compilation checks
- Streams events to frontend

**Stage 5: Validation**
- Runs tests
- Validates compilation
- Generates resurrection report

### 3. Frontend + Backend Demo (Full Experience)

#### Terminal 1 - Start Backend (Extension)
```bash
cd codecrypt
npm run compile
# Then press F5 in VS Code to start extension
# Run a resurrection to start the SSE server
```

#### Terminal 2 - Start Frontend (Development)
```bash
cd codecrypt/frontend
npm install --legacy-peer-deps
npm run dev
```

#### Terminal 3 - Open Frontend
```bash
open http://localhost:3000
```

Now when you run a resurrection from VS Code, you'll see:
- Real-time events streaming to the frontend
- Live metric updates
- AI narrator speaking the events (enable audio)
- Resurrection symphony playing (enable audio)
- 3D Ghost Tour visualization (if implemented)

## Demo Talking Points

### Problem Statement
"Thousands of valuable open-source projects die every year. They become unmaintainable due to outdated dependencies, security vulnerabilities, and breaking changes. CodeCrypt brings them back to life."

### Key Features

#### 1. Intelligent Dependency Analysis
- Detects outdated packages
- Identifies security vulnerabilities
- Finds dead URLs and suggests replacements
- Uses package replacement registry for known migrations

#### 2. Smart Modernization
- Hybrid AST + LLM analysis
- Understands developer intent
- Preserves functionality while modernizing
- Handles breaking changes automatically

#### 3. Multi-Sensory Visualization
- **Dashboard**: Real-time metrics and charts
- **AI Narrator**: Voice narration of the process
- **Symphony**: Musical representation of code quality
- **Ghost Tour**: 3D visualization of code evolution (planned)

#### 4. Safety First
- Creates resurrection branch (never touches main)
- Compilation proof at each step
- Rollback capability
- Comprehensive validation

### Technical Highlights

#### Architecture
- **Backend**: TypeScript VS Code Extension
- **Frontend**: React + Vite + TypeScript
- **Communication**: Server-Sent Events (SSE)
- **Visualization**: Chart.js, Three.js, Tone.js
- **AI**: Gemini API for semantic analysis

#### Property-Based Testing
- Extensive test coverage
- Property-based tests for correctness
- Integration tests for real scenarios
- Manual verification scripts

#### Production Ready
- Error handling and recovery
- Logging and debugging
- Security best practices
- Performance optimized

## Demo Scenarios

### Scenario 1: Simple Outdated Project
**Repository**: `https://github.com/zcourts/jison`
- 11 dependencies
- 10 outdated
- Last commit: 2013
- **Result**: Successfully modernized in ~2 minutes

### Scenario 2: Complex Project with Dead URLs
**Repository**: Any project with deprecated packages
- Detects dead npm URLs
- Suggests modern replacements
- Updates package.json automatically
- **Result**: Fully functional with modern dependencies

### Scenario 3: Security Vulnerabilities
**Repository**: Any project with known CVEs
- Scans for vulnerabilities
- Prioritizes security patches
- Updates to safe versions
- **Result**: Zero vulnerabilities

## Troubleshooting

### Frontend Not Connecting
- **Solution**: The deployed version uses demo mode automatically
- For local development, ensure the extension is running first

### Extension Not Loading
- Check VS Code version (1.85.0+)
- Run `npm install` in codecrypt directory
- Check Output panel for errors

### API Keys Not Working
- Verify GitHub token has repo access
- Verify Gemini API key is valid
- Check VS Code secret storage

## Next Steps

### Immediate Improvements
- [ ] Deploy backend API for live demo
- [ ] Add more demo data scenarios
- [ ] Implement 3D Ghost Tour
- [ ] Add export/share functionality

### Future Features
- [ ] Support for Python, Ruby, Java projects
- [ ] GitHub App integration
- [ ] Batch resurrection for organizations
- [ ] AI-powered code modernization suggestions
- [ ] Community package replacement registry

## Resources

- **Live Demo**: https://codecrypt-demo.netlify.app
- **GitHub**: https://github.com/ola-893/codecrypt-kiro
- **Documentation**: See README.md files in each directory
- **Specs**: See `.kiro/specs/` for detailed specifications

## Contact

For questions or demo requests, reach out to the development team.

---

**Built with ❤️ for the Kiroween Hackathon**
