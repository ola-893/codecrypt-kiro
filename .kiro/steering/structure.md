# Project Structure

## Directory Layout

```
codecrypt/
├── src/                    # Source code
│   ├── extension.ts       # Main extension entry point
│   └── test/              # Test files
│       └── extension.test.ts
├── dist/                  # Webpack build output (gitignored)
├── out/                   # Test compilation output (gitignored)
├── node_modules/          # Dependencies (gitignored)
├── package.json           # Extension manifest and dependencies
├── tsconfig.json          # TypeScript configuration
├── webpack.config.js      # Webpack bundler configuration
├── eslint.config.mjs      # ESLint configuration
└── README.md              # Extension documentation
```

## Key Files

### Extension Entry Point

- `src/extension.ts` - Contains `activate()` and `deactivate()` lifecycle methods
- Commands registered in `activate()` must match `package.json` contributions

### Configuration Files

- `package.json` - Extension manifest with commands, activation events, and scripts
- `tsconfig.json` - TypeScript compiler options
- `webpack.config.js` - Bundles extension for distribution
- `eslint.config.mjs` - Linting rules and configuration

## Conventions

### File Organization

- All source code in `src/` directory
- Tests colocated in `src/test/` subdirectory
- Entry point must be `src/extension.ts`

### Extension Structure

- Commands defined in `package.json` under `contributes.commands`
- Command handlers registered in `activate()` function
- Disposables added to `context.subscriptions` for proper cleanup
- Use `vscode.window.showInformationMessage()` for user notifications

### Naming

- Extension files use lowercase with hyphens (e.g., `extension.ts`)
- Follow TypeScript naming conventions (camelCase for variables/functions, PascalCase for classes)
