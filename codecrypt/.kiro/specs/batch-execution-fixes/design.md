# Batch Execution and Validation Fixes: Design Document

## Overview

This design addresses critical failures in the batch execution and validation systems. The core issues are:
1. Batch executor creates batches but never executes the actual npm updates
2. Validation system loops infinitely applying the same ineffective fix
3. LLM timeouts block analysis progress
4. Lack of progress visibility makes debugging difficult

## Architecture

### Current Flow (Broken)
```
BatchPlanner.createBatches() → [batches created]
  ↓
ResurrectionOrchestrator.executePlan() → [???]
  ↓
PostResurrectionValidator.validate() → [infinite loop]
  ↓
Report: 0 updates, 0 successful
```

### Fixed Flow
```
BatchPlanner.createBatches() → [batches created]
  ↓
BatchExecutor.executeBatches() → [actually runs npm install for each batch]
  ├→ emit batch_started
  ├→ DependencyUpdater.updateDependency() for each package
  ├→ npm install with captured output
  ├→ emit package_updated
  └→ emit batch_completed
  ↓
PostResurrectionValidator.validate() → [smart fix selection with loop prevention]
  ├→ Track attempted fixes
  ├→ Detect no-progress scenarios
  ├→ Try diverse fix strategies
  └→ Terminate intelligently
  ↓
Report: X updates, Y successful, Z failed
```

## Components and Interfaces

### 1. BatchExecutor Enhancement

**Current Problem:** The `BatchExecutor` exists but doesn't actually execute batches.

**Solution:** Implement the missing execution logic.

```typescript
interface BatchExecutionResult {
  batchId: string;
  packagesAttempted: number;
  packagesSucceeded: number;
  packagesFailed: number;
  results: PackageUpdateResult[];
  duration: number;
}

interface PackageUpdateResult {
  packageName: string;
  fromVersion: string;
  toVersion: string;
  success: boolean;
  error?: string;
  validationPassed?: boolean;
}

class BatchExecutor {
  async executeBatches(
    batches: Batch[],
    repoPath: string,
    eventEmitter: EventEmitter
  ): Promise<BatchExecutionResult[]> {
    const results: BatchExecutionResult[] = [];
    
    for (const batch of batches) {
      logger.info(`Executing batch ${batch.id} with ${batch.packages.length} packages`);
      eventEmitter.emit('batch_started', { 
        batchId: batch.id, 
        packages: batch.packages 
      });
      
      const batchResult = await this.executeBatch(batch, repoPath, eventEmitter);
      results.push(batchResult);
      
      eventEmitter.emit('batch_completed', batchResult);
    }
    
    return results;
  }
  
  private async executeBatch(
    batch: Batch,
    repoPath: string,
    eventEmitter: EventEmitter
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    const results: PackageUpdateResult[] = [];
    
    for (const pkg of batch.packages) {
      logger.info(`Updating ${pkg.name} from ${pkg.currentVersion} to ${pkg.targetVersion}`);
      eventEmitter.emit('package_update_started', { 
        packageName: pkg.name,
        fromVersion: pkg.currentVersion,
        toVersion: pkg.targetVersion
      });
      
      try {
        // Actually update package.json
        await this.updatePackageJson(repoPath, pkg.name, pkg.targetVersion);
        
        // Run npm install with captured output
        const installResult = await this.runNpmInstall(repoPath);
        
        if (!installResult.success) {
          results.push({
            packageName: pkg.name,
            fromVersion: pkg.currentVersion,
            toVersion: pkg.targetVersion,
            success: false,
            error: installResult.error
          });
          continue;
        }
        
        // Validate the update
        const validationResult = await this.validateUpdate(repoPath);
        
        results.push({
          packageName: pkg.name,
          fromVersion: pkg.currentVersion,
          toVersion: pkg.targetVersion,
          success: true,
          validationPassed: validationResult.success
        });
        
        eventEmitter.emit('package_updated', {
          packageName: pkg.name,
          success: true,
          validationPassed: validationResult.success
        });
        
      } catch (error) {
        logger.error(`Failed to update ${pkg.name}:`, error);
        results.push({
          packageName: pkg.name,
          fromVersion: pkg.currentVersion,
          toVersion: pkg.targetVersion,
          success: false,
          error: error.message
        });
        
        eventEmitter.emit('package_updated', {
          packageName: pkg.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      batchId: batch.id,
      packagesAttempted: batch.packages.length,
      packagesSucceeded: results.filter(r => r.success).length,
      packagesFailed: results.filter(r => !r.success).length,
      results,
      duration: Date.now() - startTime
    };
  }
  
  private async updatePackageJson(
    repoPath: string,
    packageName: string,
    version: string
  ): Promise<void> {
    const pkgPath = path.join(repoPath, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    
    if (pkg.dependencies?.[packageName]) {
      pkg.dependencies[packageName] = version;
    }
    if (pkg.devDependencies?.[packageName]) {
      pkg.devDependencies[packageName] = version;
    }
    
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  }
  
  private async runNpmInstall(repoPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('npm install --legacy-peer-deps', {
        cwd: repoPath,
        timeout: 120000 // 2 minutes
      });
      
      logger.info('npm install output:', stdout);
      if (stderr) {
        logger.warn('npm install stderr:', stderr);
      }
      
      return { success: true };
    } catch (error) {
      logger.error('npm install failed:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### 2. Validation Loop Prevention

**Current Problem:** Validator applies "Enabling force install mode" 10 times in a row without checking if it worked.

**Solution:** Track attempted fixes and detect no-progress scenarios.

```typescript
interface FixAttempt {
  strategy: FixStrategy;
  iteration: number;
  errorsBefore: number;
  errorsAfter: number;
  timestamp: number;
}

enum FixStrategy {
  FORCE_INSTALL = 'force_install',
  LEGACY_PEER_DEPS = 'legacy_peer_deps',
  CLEAN_INSTALL = 'clean_install',
  DELETE_LOCKFILE = 'delete_lockfile',
  UPDATE_DEPENDENCIES = 'update_dependencies',
  TYPE_FIXES = 'type_fixes',
  IMPORT_FIXES = 'import_fixes'
}

class PostResurrectionValidator {
  private attemptedFixes: Map<string, FixAttempt[]> = new Map();
  private readonly MAX_ITERATIONS = 10;
  private readonly NO_PROGRESS_THRESHOLD = 3;
  
  async validate(repoPath: string): Promise<ValidationResult> {
    let iteration = 0;
    let previousErrorCount = -1;
    let noProgressCount = 0;
    
    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      logger.info(`[Validation] Starting iteration ${iteration}/${this.MAX_ITERATIONS}`);
      
      // Run compilation check
      const compilationResult = await this.runCompilation(repoPath);
      const currentErrorCount = compilationResult.errors.length;
      
      logger.info(`[Validation] Found ${currentErrorCount} errors`);
      
      // Check for completion
      if (currentErrorCount === 0) {
        logger.info('[Validation] No errors found - validation complete!');
        return { success: true, iterations: iteration };
      }
      
      // Check for no progress
      if (currentErrorCount === previousErrorCount) {
        noProgressCount++;
        logger.warn(`[Validation] No progress detected (${noProgressCount}/${this.NO_PROGRESS_THRESHOLD})`);
        
        if (noProgressCount >= this.NO_PROGRESS_THRESHOLD) {
          logger.error('[Validation] No progress after 3 iterations - terminating');
          return {
            success: false,
            iterations: iteration,
            remainingErrors: currentErrorCount,
            reason: 'No progress detected after multiple fix attempts'
          };
        }
      } else {
        noProgressCount = 0; // Reset if we made progress
      }
      
      // Select next fix strategy
      const fixStrategy = this.selectFixStrategy(compilationResult.errors);
      
      // Check if we've already tried this strategy
      if (this.hasAttemptedFix(fixStrategy, iteration)) {
        logger.warn(`[Validation] Already attempted ${fixStrategy} - trying next strategy`);
        const alternativeStrategy = this.selectAlternativeStrategy(fixStrategy);
        
        if (!alternativeStrategy) {
          logger.error('[Validation] No more fix strategies available');
          return {
            success: false,
            iterations: iteration,
            remainingErrors: currentErrorCount,
            reason: 'Exhausted all fix strategies'
          };
        }
        
        fixStrategy = alternativeStrategy;
      }
      
      // Apply fix
      logger.info(`[Validation] Applying fix: ${fixStrategy}`);
      const fixResult = await this.applyFix(fixStrategy, repoPath, compilationResult.errors);
      
      // Record attempt
      this.recordFixAttempt(fixStrategy, iteration, previousErrorCount, currentErrorCount);
      
      if (!fixResult.success) {
        logger.error(`[Validation] Fix failed: ${fixResult.error}`);
      }
      
      previousErrorCount = currentErrorCount;
    }
    
    logger.error(`[Validation] Validation failed after ${this.MAX_ITERATIONS} iterations`);
    return {
      success: false,
      iterations: this.MAX_ITERATIONS,
      remainingErrors: previousErrorCount,
      reason: 'Maximum iterations reached'
    };
  }
  
  private selectFixStrategy(errors: CompilationError[]): FixStrategy {
    // Analyze error types and select appropriate strategy
    const errorCategories = this.categorizeErrors(errors);
    
    if (errorCategories.dependency > 0) {
      return FixStrategy.LEGACY_PEER_DEPS;
    }
    if (errorCategories.import > 0) {
      return FixStrategy.UPDATE_DEPENDENCIES;
    }
    if (errorCategories.type > 0) {
      return FixStrategy.TYPE_FIXES;
    }
    
    return FixStrategy.CLEAN_INSTALL;
  }
  
  private selectAlternativeStrategy(currentStrategy: FixStrategy): FixStrategy | null {
    const strategies = [
      FixStrategy.LEGACY_PEER_DEPS,
      FixStrategy.DELETE_LOCKFILE,
      FixStrategy.CLEAN_INSTALL,
      FixStrategy.UPDATE_DEPENDENCIES,
      FixStrategy.FORCE_INSTALL
    ];
    
    const currentIndex = strategies.indexOf(currentStrategy);
    const unattempted = strategies.filter(s => !this.hasAttemptedFix(s, -1));
    
    return unattempted[0] || null;
  }
  
  private hasAttemptedFix(strategy: FixStrategy, currentIteration: number): boolean {
    const attempts = this.attemptedFixes.get(strategy) || [];
    return attempts.some(a => a.iteration < currentIteration);
  }
  
  private recordFixAttempt(
    strategy: FixStrategy,
    iteration: number,
    errorsBefore: number,
    errorsAfter: number
  ): void {
    const attempts = this.attemptedFixes.get(strategy) || [];
    attempts.push({
      strategy,
      iteration,
      errorsBefore,
      errorsAfter,
      timestamp: Date.now()
    });
    this.attemptedFixes.set(strategy, attempts);
  }
  
  private async applyFix(
    strategy: FixStrategy,
    repoPath: string,
    errors: CompilationError[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (strategy) {
        case FixStrategy.LEGACY_PEER_DEPS:
          await execAsync('npm install --legacy-peer-deps', { cwd: repoPath });
          break;
          
        case FixStrategy.DELETE_LOCKFILE:
          await fs.unlink(path.join(repoPath, 'package-lock.json'));
          await execAsync('npm install', { cwd: repoPath });
          break;
          
        case FixStrategy.CLEAN_INSTALL:
          await fs.rm(path.join(repoPath, 'node_modules'), { recursive: true, force: true });
          await execAsync('npm install', { cwd: repoPath });
          break;
          
        case FixStrategy.UPDATE_DEPENDENCIES:
          // Update packages that are causing import errors
          const missingPackages = this.extractMissingPackages(errors);
          for (const pkg of missingPackages) {
            await execAsync(`npm install ${pkg}@latest`, { cwd: repoPath });
          }
          break;
          
        case FixStrategy.FORCE_INSTALL:
          await execAsync('npm install --force', { cwd: repoPath });
          break;
          
        default:
          return { success: false, error: 'Unknown fix strategy' };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

### 3. LLM Timeout Handling

**Current Problem:** LLM requests timeout after 30s and block progress.

**Solution:** Implement smarter retry logic and graceful degradation.

```typescript
class LLMAnalysisService {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_TIMEOUT = 30000; // 30s
  private readonly MAX_TIMEOUT = 60000; // 60s
  
  async analyzeFile(
    filePath: string,
    content: string,
    attempt: number = 1
  ): Promise<LLMInsight | null> {
    const timeout = Math.min(
      this.BASE_TIMEOUT * Math.pow(1.5, attempt - 1),
      this.MAX_TIMEOUT
    );
    
    try {
      logger.info(`Analyzing ${filePath} (attempt ${attempt}/${this.MAX_RETRIES}, timeout: ${timeout}ms)`);
      
      const result = await Promise.race([
        this.llmClient.analyze(content),
        this.timeoutPromise(timeout)
      ]);
      
      return result;
      
    } catch (error) {
      if (error.message.includes('timeout') && attempt < this.MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 1000;
        logger.warn(`LLM timeout, retrying in ${backoff}ms (attempt ${attempt}/${this.MAX_RETRIES})`);
        await this.sleep(backoff);
        return this.analyzeFile(filePath, content, attempt + 1);
      }
      
      logger.error(`LLM analysis failed for ${filePath} after ${attempt} attempts:`, error);
      return null; // Return null instead of throwing - allow analysis to continue
    }
  }
  
  async analyzeRepository(files: string[]): Promise<LLMInsight[]> {
    const insights: LLMInsight[] = [];
    let timeoutCount = 0;
    const TIMEOUT_THRESHOLD = 3;
    
    for (const file of files) {
      const insight = await this.analyzeFile(file, await fs.readFile(file, 'utf-8'));
      
      if (insight) {
        insights.push(insight);
      } else {
        timeoutCount++;
        
        if (timeoutCount >= TIMEOUT_THRESHOLD) {
          logger.warn(`${timeoutCount} LLM timeouts detected - skipping remaining files`);
          break;
        }
      }
    }
    
    logger.info(`LLM analysis complete: ${insights.length}/${files.length} files analyzed`);
    return insights;
  }
  
  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms);
    });
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Data Models

### BatchExecutionResult
```typescript
interface BatchExecutionResult {
  batchId: string;
  packagesAttempted: number;
  packagesSucceeded: number;
  packagesFailed: number;
  results: PackageUpdateResult[];
  duration: number;
}
```

### FixAttempt
```typescript
interface FixAttempt {
  strategy: FixStrategy;
  iteration: number;
  errorsBefore: number;
  errorsAfter: number;
  timestamp: number;
}
```

## Error Handling

### Batch Execution Errors
- Capture npm install failures and continue to next package
- Log full error context for debugging
- Don't fail entire batch if one package fails

### Validation Errors
- Detect infinite loops and terminate gracefully
- Provide clear error messages about what was attempted
- Don't retry the same fix repeatedly

### LLM Errors
- Retry with exponential backoff
- Skip files that consistently timeout
- Fall back to AST-only analysis if LLM unavailable

## Testing Strategy

### Unit Tests
- Test batch executor with mock npm commands
- Test validation loop prevention logic
- Test fix strategy selection
- Test LLM timeout handling

### Integration Tests
- Test full batch execution with real repository
- Test validation with various error scenarios
- Test LLM analysis with timeout simulation

### Property-Based Tests
None required for this spec - these are bug fixes to existing functionality.
