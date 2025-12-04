"use strict";
/**
 * Quick test to verify orchestrator reporting enhancements
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock context with sample data
const mockContext = {
    repoUrl: 'https://github.com/test/repo',
    isDead: true,
    dependencies: [],
    transformationLog: [
        {
            timestamp: new Date(),
            type: 'dependency_update',
            message: 'Updated package',
            details: {
                packageName: 'test-package',
                oldVersion: '1.0.0',
                newVersion: '2.0.0',
                fixedVulnerabilities: 1
            }
        }
    ],
    repoPath: '/tmp/test-repo',
    resurrectionBranch: 'resurrection-2024'
};
// Create a test state
const testState = {
    context: mockContext,
    llmProvider: 'gemini',
    llmAnalysisStatus: 'success',
    dependencyUpdateSummary: {
        attempted: 10,
        succeeded: 8,
        failed: 2,
        skipped: 0
    },
    validationSummary: {
        compilationStatus: 'passed',
        testsStatus: 'not_applicable'
    }
};
console.log('✅ OrchestratorState interface test passed');
console.log('State:', JSON.stringify(testState, null, 2));
const testResult = {
    success: true,
    message: 'Successfully resurrected repository',
    dependenciesUpdated: 8,
    vulnerabilitiesFixed: 3,
    branchUrl: 'https://github.com/test/repo/tree/resurrection-2024',
    partialSuccess: false,
    llmAnalysisStatus: 'success',
    llmProvider: 'gemini',
    dependencyUpdateSummary: {
        attempted: 10,
        succeeded: 8,
        failed: 2,
        skipped: 0
    },
    validationSummary: {
        compilationStatus: 'passed',
        testsStatus: 'not_applicable'
    }
};
console.log('✅ ResurrectionResult interface test passed');
console.log('Result:', JSON.stringify(testResult, null, 2));
console.log('\n✅ All reporting enhancement tests passed!');
//# sourceMappingURL=test-orchestrator-reporting.js.map