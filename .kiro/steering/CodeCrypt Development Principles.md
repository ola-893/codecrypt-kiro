<!-- .kiro/steering/codecrypt-principles.md -->
# CodeCrypt Development Principles

## Project Theme
This is a Kiroween Hackathon project with a "resurrection" theme.
All naming, UI/UX, and documentation should embrace the spooky/gothic aesthetic.

## Technology Stack
- TypeScript for type safety
- VS Code Extension API
- Octokit for GitHub integration
- Anthropic SDK for AI features
- MCP SDK for tool integration

## Code Standards
- Use async/await for all asynchronous operations
- Implement proper error handling with try-catch
- Use VS Code's Progress API for long-running operations
- Follow VS Code extension best practices
- Add JSDoc comments for public APIs

## VS Code Extension Patterns
- Register all commands in package.json
- Use workspace configuration for settings
- Implement proper activation/deactivation
- Use WebView panels for rich UI

## Resurrection Workflow Priority
1. Death detection (repo analysis)
2. Dependency analysis (package.json, requirements.txt)
3. Code modernization (deprecated APIs)
4. Test generation
5. Documentation update