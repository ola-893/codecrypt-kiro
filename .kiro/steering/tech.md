# Technology Stack

## Core Technologies

- **Language**: TypeScript (ES2022 target, Node16 module system)
- **Platform**: VS Code Extension API
- **Build Tool**: Webpack 5
- **Package Manager**: npm

## Key Dependencies

- `vscode` - VS Code extensibility API
- `typescript` - TypeScript compiler (v5.9.3)
- `webpack` - Module bundler with ts-loader
- `eslint` with `typescript-eslint` - Linting
- `@vscode/test-electron` - Testing framework

## TypeScript Configuration

- Strict mode enabled
- ES2022 lib and target
- Node16 module resolution
- Source maps enabled for debugging

## Build System

### Common Commands

```bash
# Development
npm run compile          # Build extension with webpack
npm run watch           # Watch mode for development

# Testing
npm run compile-tests   # Compile test files
npm run test           # Run full test suite
npm run lint           # Run ESLint

# Production
npm run package        # Production build with optimizations
npm run vscode:prepublish  # Pre-publish build step
```

### Build Output

- Source: `src/`
- Compiled output: `dist/extension.js` (webpack bundle)
- Test output: `out/` (compiled tests)

## Code Quality

### ESLint Rules

- Naming conventions enforced (camelCase/PascalCase for imports)
- Curly braces required
- Strict equality (`===`) required
- No throw literals
- Semicolons required
