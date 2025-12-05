# Implementation Plan: Critical Dependency and API Configuration Fixes

- [x] 1. Analyze and fix querystring dependency
  - Search codebase for all references to `querystring` package
  - Determine if Node.js built-in module is sufficient
  - Update or remove dependency from package.json
  - Run `npm install` to verify fix
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 1.1 Write property test for dependency source validation
  - **Property 1: Valid Dependency Sources**
  - **Validates: Requirements 1.2, 1.4**

- [x] 2. Update Gemini model configuration in service files
  - Update `src/services/llmAnalysis.ts` default model to `gemini-3-pro-preview` (lines ~301, ~317, ~321)
  - Update `src/services/resurrectionOrchestrator.ts` model configuration (lines ~366, ~376, ~391, ~454)
  - Update all narration messages to reference correct model name
  - Ensure consistency across all initialization points
  - _Requirements: 3.1, 3.5_

- [x] 3. Improve error handling for API failures
  - Add specific error handling for Gemini 404 model errors in llmAnalysis.ts
  - Include attempted model name in error messages
  - Provide actionable guidance (suggest `gemini-3-pro-preview`)
  - Add error code `GEMINI_MODEL_NOT_FOUND`
  - _Requirements: 4.2, 4.4_

- [x] 4. Update all documentation files PROJECT-WIDE
  - Update `QUICK_REFERENCE.md`: Replace all old Gemini model references with `gemini-3-pro-preview`
  - Update `ANALYSIS_FINDINGS.md`: Update model recommendations
  - Update `FIXES_NEEDED.md`: Update error examples
  - Update `DEMO_VERIFICATION_REPORT.md`: Update expected model name
  - Search for any other docs mentioning old Gemini models
  - _Requirements: 3.5_

- [x] 5. Update test files
  - Update `src/test/demoCriticalFixes.integration.test.ts`: Update model assertions
  - Search for any other tests referencing Gemini models
  - Ensure tests use correct model name
  - _Requirements: 3.1, 3.5_

- [x] 6. Update spec documentation files
  - Update `.kiro/specs/gemini-api-fix/tasks.md`: Replace model references
  - Update `.kiro/specs/demo-critical-fixes/tasks.md`: Replace model references
  - Ensure all spec files reference `gemini-3-pro-preview`
  - _Requirements: 3.5_

- [x] 7. Verify no old model names remain
  - Run project-wide search for old Gemini model references
  - Update any remaining references found
  - Verify only `gemini-3-pro-preview` is used as default
  - _Requirements: 3.5_

- [x] 7.1 Write property test for non-registry URL detection
  - **Property 2: Non-Registry URL Detection**
  - **Validates: Requirements 5.3**

- [x] 8. Run comprehensive verification tests
  - Clean install: `rm -rf node_modules package-lock.json && npm install`
  - Verify npm install completes without 404 errors
  - Run build: `npm run compile`
  - Run test suite: `npm test`
  - Verify all tests pass
  - _Requirements: 1.1, 1.5, 2.4_

- [x] 8.1 Write integration test for Gemini API
  - Test GeminiClient initialization with `gemini-3-pro-preview`
  - Test successful API call (requires API key)
  - Test error handling for invalid model
  - Verify error messages include actionable guidance
  - _Requirements: 3.2, 4.2_

- [x] 9. Manual end-to-end verification
  - Configure Gemini API key in VS Code settings
  - Run resurrection on a test repository
  - Verify LLM analysis completes successfully
  - Check logs for any 404 errors
  - Verify resurrection report includes LLM insights
  - _Requirements: 3.3, 3.4_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
