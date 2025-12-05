/**
 * Unit Tests for Error Reporting
 * Tests report generation scenarios, parent chain formatting, and status grouping
 * 
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
 */

import * as assert from 'assert';
import { 
  generateResurrectionReport,
  DeadUrlReportSummary,
  DeadUrlResultDetail,
  ReportGenerationOptions
} from '../services/reporting';
import { ResurrectionContext } from '../types';
import { DeadUrlHandlingSummary, DeadUrlHandlingResult } from '../services/deadUrlHandler';

suite('Error Reporting - Dead URL Resolution', () => {
  /**
   * Helper function to create a DeadUrlHandlingResult with required fields
   */
  function createDeadUrlResult(
    packageName: string,
    deadUrl: string,
    action: 'kept' | 'replaced' | 'removed',
    options: {
      npmAlternative?: string;
      warning?: string;
      parentChain?: string[];
      depth?: number;
    } = {}
  ): DeadUrlHandlingResult {
    return {
      packageName,
      deadUrl,
      isUrlDead: action !== 'kept',
      resolved: action === 'replaced',
      action,
      ...options
    };
  }

  /**
   * Test: Report generation with no dead URLs
   * Requirements: 5.1
   */
  test('should generate report with no dead URLs found', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 5,
      deadUrlsFound: 0,
      resolvedViaNpm: 0,
      removed: 0,
      results: []
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify report structure
    assert.ok(report.deadUrlSummary, 'Should have dead URL summary');
    assert.strictEqual(report.deadUrlSummary.totalChecked, 5);
    assert.strictEqual(report.deadUrlSummary.deadUrlsFound, 0);
    assert.strictEqual(report.deadUrlSummary.resolvedViaNpm, 0);
    assert.strictEqual(report.deadUrlSummary.removed, 0);
    
    // Verify markdown includes dead URL section showing no dead URLs found
    assert.ok(report.markdown.includes('## 🔗 Dead URL Resolution'));
    assert.ok(report.markdown.includes('**Total URL-based dependencies checked:** 5'));
    assert.ok(report.markdown.includes('**Dead URLs found:** 0'));
  });

  /**
   * Test: Report generation with resolved dead URLs
   * Requirements: 5.1, 5.3
   */
  test('should generate report with resolved dead URLs', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 3,
      deadUrlsFound: 2,
      resolvedViaNpm: 2,
      removed: 0,
      results: [
        createDeadUrlResult(
          'querystring',
          'https://github.com/substack/querystring/archive/0.2.0-ie8.tar.gz',
          'replaced',
          {
            npmAlternative: '^0.2.1',
            warning: 'Old GitHub tarball URL no longer accessible'
          }
        ),
        createDeadUrlResult(
          'old-package',
          'https://github.com/user/old-package/tarball/master',
          'replaced',
          {
            npmAlternative: '^1.0.0',
            warning: 'Package moved to npm registry'
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify summary
    assert.ok(report.deadUrlSummary);
    assert.strictEqual(report.deadUrlSummary.totalChecked, 3);
    assert.strictEqual(report.deadUrlSummary.deadUrlsFound, 2);
    assert.strictEqual(report.deadUrlSummary.resolvedViaNpm, 2);
    assert.strictEqual(report.deadUrlSummary.removed, 0);

    // Verify status grouping
    assert.strictEqual(report.deadUrlSummary.byStatus.replaced.length, 2);
    assert.strictEqual(report.deadUrlSummary.byStatus.removed.length, 0);
    assert.strictEqual(report.deadUrlSummary.byStatus.kept.length, 0);

    // Verify markdown includes dead URL section
    assert.ok(report.markdown.includes('## 🔗 Dead URL Resolution'));
    assert.ok(report.markdown.includes('**Total URL-based dependencies checked:** 3'));
    assert.ok(report.markdown.includes('**Dead URLs found:** 2'));
    assert.ok(report.markdown.includes('**Resolved via npm registry:** 2'));
    assert.ok(report.markdown.includes('### ✅ Resolved Dead URLs'));
    assert.ok(report.markdown.includes('querystring'));
    assert.ok(report.markdown.includes('^0.2.1'));
  });

  /**
   * Test: Report generation with removed dead URLs
   * Requirements: 5.1, 5.3
   */
  test('should generate report with removed dead URLs', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 3,
      deadUrlsFound: 1,
      resolvedViaNpm: 0,
      removed: 1,
      results: [
        createDeadUrlResult(
          'deprecated-package',
          'https://github.com/user/deprecated-package/archive/v1.0.0.tar.gz',
          'removed',
          {
            warning: 'No npm alternative found'
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify summary
    assert.ok(report.deadUrlSummary);
    assert.strictEqual(report.deadUrlSummary.removed, 1);

    // Verify status grouping
    assert.strictEqual(report.deadUrlSummary.byStatus.removed.length, 1);
    assert.strictEqual(report.deadUrlSummary.byStatus.replaced.length, 0);

    // Verify markdown includes removed section
    assert.ok(report.markdown.includes('### ❌ Unresolvable Dead URLs'));
    assert.ok(report.markdown.includes('deprecated-package'));
    assert.ok(report.markdown.includes('No npm alternative found'));
    
    // Verify helpful explanation is included
    assert.ok(report.markdown.includes('#### 💡 Common Dead URL Sources'));
    assert.ok(report.markdown.includes('**Recommended Actions:**'));
  });

  /**
   * Test: Report generation with kept (accessible) URLs
   * Requirements: 5.1, 5.3
   */
  test('should generate report with kept accessible URLs', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 3,
      deadUrlsFound: 0,
      resolvedViaNpm: 0,
      removed: 0,
      results: [
        createDeadUrlResult(
          'valid-package',
          'https://github.com/user/valid-package/tarball/v1.0.0',
          'kept'
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify status grouping
    assert.ok(report.deadUrlSummary);
    assert.strictEqual(report.deadUrlSummary.byStatus.kept.length, 1);

    // Verify markdown includes kept section
    assert.ok(report.markdown.includes('### ✓ Accessible URLs'));
    assert.ok(report.markdown.includes('1 URL-based dependency remains accessible'));
  });

  /**
   * Test: Parent chain formatting for transitive dependencies
   * Requirements: 5.2
   */
  test('should format parent chains for transitive dependencies', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 2,
      deadUrlsFound: 1,
      resolvedViaNpm: 1,
      removed: 0,
      results: [
        createDeadUrlResult(
          'transitive-dep',
          'https://github.com/user/transitive-dep/archive/v1.0.0.tar.gz',
          'replaced',
          {
            npmAlternative: '^1.0.0',
            parentChain: ['express', 'body-parser', 'transitive-dep'],
            depth: 2,
            warning: 'Transitive dependency with dead URL'
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify parent chain is included in summary
    assert.ok(report.deadUrlSummary);
    const replacedDep = report.deadUrlSummary.byStatus.replaced[0];
    assert.ok(replacedDep.parentChain);
    assert.strictEqual(replacedDep.parentChain.length, 3);
    assert.deepStrictEqual(replacedDep.parentChain, ['express', 'body-parser', 'transitive-dep']);
    assert.strictEqual(replacedDep.depth, 2);

    // Verify markdown includes parent chain formatting
    assert.ok(report.markdown.includes('#### Transitive Dependency Chains'));
    assert.ok(report.markdown.includes('**transitive-dep** (depth 2)'));
    assert.ok(report.markdown.includes('- Parent chain: express → body-parser → transitive-dep'));
  });

  /**
   * Test: Status grouping with mixed results
   * Requirements: 5.3, 5.4
   */
  test('should group results by status (kept, replaced, removed)', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 6,
      deadUrlsFound: 4,
      resolvedViaNpm: 2,
      removed: 2,
      results: [
        createDeadUrlResult(
          'kept-package',
          'https://github.com/user/kept-package/tarball/v1.0.0',
          'kept'
        ),
        createDeadUrlResult(
          'replaced-package-1',
          'https://github.com/user/replaced-package-1/archive/v1.0.0.tar.gz',
          'replaced',
          { npmAlternative: '^1.0.0' }
        ),
        createDeadUrlResult(
          'replaced-package-2',
          'https://github.com/user/replaced-package-2/archive/v2.0.0.tar.gz',
          'replaced',
          { npmAlternative: '^2.0.0' }
        ),
        createDeadUrlResult(
          'removed-package-1',
          'https://github.com/user/removed-package-1/archive/v1.0.0.tar.gz',
          'removed',
          { warning: 'No npm alternative found' }
        ),
        createDeadUrlResult(
          'removed-package-2',
          'https://github.com/user/removed-package-2/archive/v1.0.0.tar.gz',
          'removed',
          { warning: 'Package no longer maintained' }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify status grouping
    assert.ok(report.deadUrlSummary);
    assert.strictEqual(report.deadUrlSummary.byStatus.kept.length, 1);
    assert.strictEqual(report.deadUrlSummary.byStatus.replaced.length, 2);
    assert.strictEqual(report.deadUrlSummary.byStatus.removed.length, 2);

    // Verify each group contains correct packages
    assert.strictEqual(report.deadUrlSummary.byStatus.kept[0].packageName, 'kept-package');
    assert.strictEqual(report.deadUrlSummary.byStatus.replaced[0].packageName, 'replaced-package-1');
    assert.strictEqual(report.deadUrlSummary.byStatus.replaced[1].packageName, 'replaced-package-2');
    assert.strictEqual(report.deadUrlSummary.byStatus.removed[0].packageName, 'removed-package-1');
    assert.strictEqual(report.deadUrlSummary.byStatus.removed[1].packageName, 'removed-package-2');

    // Verify markdown includes all sections
    assert.ok(report.markdown.includes('### ✅ Resolved Dead URLs'));
    assert.ok(report.markdown.includes('### ❌ Unresolvable Dead URLs'));
    assert.ok(report.markdown.includes('### ✓ Accessible URLs'));
  });

  /**
   * Test: Helpful explanations for known problematic sources
   * Requirements: 5.5
   */
  test('should include helpful explanations for known problematic sources', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 1,
      deadUrlsFound: 1,
      resolvedViaNpm: 0,
      removed: 1,
      results: [
        createDeadUrlResult(
          'old-github-tarball',
          'https://github.com/substack/old-github-tarball/archive/v1.0.0.tar.gz',
          'removed',
          { warning: 'Old GitHub tarball URL no longer accessible' }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify helpful explanation section is included
    assert.ok(report.markdown.includes('#### 💡 Common Dead URL Sources'));
    assert.ok(report.markdown.includes('Dead URLs often come from:'));
    assert.ok(report.markdown.includes('**Old GitHub tarballs**'));
    assert.ok(report.markdown.includes('**Deprecated repositories**'));
    assert.ok(report.markdown.includes('**Changed URLs**'));
    
    // Verify recommended actions are included
    assert.ok(report.markdown.includes('**Recommended Actions:**'));
    assert.ok(report.markdown.includes('Check if removed packages are still needed'));
    assert.ok(report.markdown.includes('Search npm registry for alternative packages'));
    assert.ok(report.markdown.includes('Update parent dependencies'));
    assert.ok(report.markdown.includes('Consider adding entries to the package replacement registry'));
  });

  /**
   * Test: Multiple transitive dependencies with parent chains
   * Requirements: 5.2
   */
  test('should format multiple transitive dependencies with parent chains', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 3,
      deadUrlsFound: 2,
      resolvedViaNpm: 1,
      removed: 1,
      results: [
        createDeadUrlResult(
          'transitive-replaced',
          'https://github.com/user/transitive-replaced/archive/v1.0.0.tar.gz',
          'replaced',
          {
            npmAlternative: '^1.0.0',
            parentChain: ['express', 'transitive-replaced'],
            depth: 1,
            warning: 'Transitive dependency resolved'
          }
        ),
        createDeadUrlResult(
          'transitive-removed',
          'https://github.com/user/transitive-removed/archive/v1.0.0.tar.gz',
          'removed',
          {
            parentChain: ['lodash', 'deep-dep', 'transitive-removed'],
            depth: 2,
            warning: 'No npm alternative found'
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify both transitive dependencies are included
    assert.ok(report.deadUrlSummary);
    const replaced = report.deadUrlSummary.byStatus.replaced[0];
    const removed = report.deadUrlSummary.byStatus.removed[0];

    assert.ok(replaced.parentChain);
    assert.strictEqual(replaced.depth, 1);
    assert.ok(removed.parentChain);
    assert.strictEqual(removed.depth, 2);

    // Verify markdown includes both parent chains
    assert.ok(report.markdown.includes('**transitive-replaced** (depth 1)'));
    assert.ok(report.markdown.includes('- Parent chain: express → transitive-replaced'));
    assert.ok(report.markdown.includes('**transitive-removed** (depth 2)'));
    assert.ok(report.markdown.includes('- Parent chain: lodash → deep-dep → transitive-removed'));
  });

  /**
   * Test: Direct vs transitive dependency type indication
   * Requirements: 5.2
   */
  test('should indicate direct vs transitive dependency type', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 2,
      deadUrlsFound: 2,
      resolvedViaNpm: 2,
      removed: 0,
      results: [
        createDeadUrlResult(
          'direct-dep',
          'https://github.com/user/direct-dep/archive/v1.0.0.tar.gz',
          'replaced',
          { npmAlternative: '^1.0.0' }
        ),
        createDeadUrlResult(
          'transitive-dep',
          'https://github.com/user/transitive-dep/archive/v1.0.0.tar.gz',
          'replaced',
          {
            npmAlternative: '^1.0.0',
            parentChain: ['express', 'transitive-dep'],
            depth: 1
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify markdown includes type column in table
    assert.ok(report.markdown.includes('| Package | Dead URL | Replacement | Type |'));
    assert.ok(report.markdown.includes('| direct-dep |'));
    assert.ok(report.markdown.includes('| Direct |'));
    assert.ok(report.markdown.includes('| transitive-dep |'));
    assert.ok(report.markdown.includes('| Transitive |'));
  });

  /**
   * Test: URL truncation for long URLs
   * Requirements: 5.1
   */
  test('should truncate long URLs in report tables', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const longUrl = 'https://github.com/very-long-username/very-long-repository-name/archive/very-long-tag-name-v1.0.0-beta.1.tar.gz';

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 1,
      deadUrlsFound: 1,
      resolvedViaNpm: 1,
      removed: 0,
      results: [
        createDeadUrlResult(
          'long-url-package',
          longUrl,
          'replaced',
          { npmAlternative: '^1.0.0' }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify URL is truncated in markdown (max 50 chars + ...)
    if (longUrl.length > 50) {
      const truncated = longUrl.substring(0, 47) + '...';
      assert.ok(report.markdown.includes(truncated));
      assert.ok(!report.markdown.includes(longUrl)); // Full URL should not appear in table
    }
  });

  /**
   * Test: Empty results with non-zero checked count
   * Requirements: 5.1
   */
  test('should handle case where URLs were checked but none had issues', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 10,
      deadUrlsFound: 0,
      resolvedViaNpm: 0,
      removed: 0,
      results: []
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify summary is created and section is included showing no issues
    assert.ok(report.deadUrlSummary);
    assert.strictEqual(report.deadUrlSummary.totalChecked, 10);
    assert.strictEqual(report.deadUrlSummary.deadUrlsFound, 0);
    
    // Dead URL section should be in markdown showing no dead URLs found
    assert.ok(report.markdown.includes('## 🔗 Dead URL Resolution'));
    assert.ok(report.markdown.includes('**Total URL-based dependencies checked:** 10'));
    assert.ok(report.markdown.includes('**Dead URLs found:** 0'));
  });

  /**
   * Test: Warning messages are included in report
   * Requirements: 5.1, 5.5
   */
  test('should include warning messages in report details', () => {
    const context: ResurrectionContext = {
      repoUrl: 'https://github.com/test/repo',
      isDead: true,
      dependencies: [],
      transformationLog: []
    };

    const deadUrlSummary: DeadUrlHandlingSummary = {
      totalChecked: 2,
      deadUrlsFound: 2,
      resolvedViaNpm: 1,
      removed: 1,
      results: [
        createDeadUrlResult(
          'replaced-with-warning',
          'https://github.com/user/replaced-with-warning/archive/v1.0.0.tar.gz',
          'replaced',
          {
            npmAlternative: '^1.0.0',
            warning: 'Package moved to npm registry',
            parentChain: ['express', 'replaced-with-warning'],
            depth: 1
          }
        ),
        createDeadUrlResult(
          'removed-with-warning',
          'https://github.com/user/removed-with-warning/archive/v1.0.0.tar.gz',
          'removed',
          {
            warning: 'Package is deprecated and no longer maintained',
            parentChain: ['lodash', 'removed-with-warning'],
            depth: 1
          }
        )
      ]
    };

    const options: ReportGenerationOptions = {
      deadUrlHandlingSummary: deadUrlSummary
    };

    const report = generateResurrectionReport(context, options);

    // Verify warnings are included in transitive dependency chains section
    assert.ok(report.markdown.includes('- Package moved to npm registry'));
    assert.ok(report.markdown.includes('- Package is deprecated and no longer maintained'));
  });
});
