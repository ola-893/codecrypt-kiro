#!/usr/bin/env node

/**
 * Gemini Configuration Verification Script
 * 
 * This script helps verify that the Gemini API configuration is correct
 * and that no old model names remain in the codebase.
 * 
 * Usage: node verify-gemini-config.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logHeader(message) {
  log(`\n${colors.bold}${message}${colors.reset}`, 'blue');
}

// Old model names that should NOT appear in the codebase
const OLD_MODEL_NAMES = [
  'gemini-pro',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'models/gemini-pro',
  'models/gemini-1.5-pro'
];

// Correct model name
const CORRECT_MODEL = 'gemini-3-pro-preview';

// Files to check
const FILES_TO_CHECK = [
  'src/services/llmAnalysis.ts',
  'src/services/resurrectionOrchestrator.ts',
  'package.json',
  'QUICK_REFERENCE.md',
  'ANALYSIS_FINDINGS.md',
  'FIXES_NEEDED.md',
  'DEMO_VERIFICATION_REPORT.md',
  'src/test/demoCriticalFixes.integration.test.ts',
  'src/test/geminiApi.integration.test.ts',
  '.kiro/specs/gemini-api-fix/tasks.md',
  '.kiro/specs/demo-critical-fixes/tasks.md',
  '.kiro/specs/critical-dependency-fixes/tasks.md'
];

let hasErrors = false;
let hasWarnings = false;

/**
 * Check if a file contains old model names
 */
function checkFileForOldModels(filePath) {
  const fullPath = path.join(__dirname, '../../..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    logWarning(`File not found: ${filePath}`);
    hasWarnings = true;
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const foundIssues = [];

  // Check for old model names
  for (const oldModel of OLD_MODEL_NAMES) {
    // Case-insensitive search, but exclude comments explaining the old names
    const regex = new RegExp(oldModel, 'gi');
    const matches = content.match(regex);
    
    if (matches) {
      // Check if it's in a comment explaining the change
      const lines = content.split('\n');
      let isInComment = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(oldModel)) {
          // Check if it's in a comment or documentation about the old name
          if (line.includes('//') || line.includes('*') || line.includes('#')) {
            const commentPart = line.substring(line.search(/\/\/|\*|#/));
            if (commentPart.includes(oldModel) && 
                (commentPart.includes('old') || commentPart.includes('previous') || 
                 commentPart.includes('was') || commentPart.includes('deprecated'))) {
              isInComment = true;
              continue;
            }
          }
          
          foundIssues.push({
            model: oldModel,
            line: i + 1,
            content: line.trim()
          });
        }
      }
    }
  }

  if (foundIssues.length > 0) {
    logError(`Found old model names in ${filePath}:`);
    foundIssues.forEach(issue => {
      console.log(`  Line ${issue.line}: ${issue.model}`);
      console.log(`    ${issue.content.substring(0, 80)}...`);
    });
    hasErrors = true;
  } else {
    logSuccess(`${filePath} - No old model names found`);
  }

  // Check if correct model is present (for relevant files)
  if (filePath.includes('llmAnalysis') || filePath.includes('resurrectionOrchestrator') || 
      filePath.includes('package.json')) {
    if (!content.includes(CORRECT_MODEL)) {
      logWarning(`${filePath} - Correct model '${CORRECT_MODEL}' not found`);
      hasWarnings = true;
    }
  }
}

/**
 * Check package.json for correct Gemini model configuration
 */
function checkPackageJson() {
  const packagePath = path.join(__dirname, '../../..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  // Check if geminiModel configuration exists
  const geminiModelConfig = packageJson.contributes?.configuration?.properties?.['codecrypt.geminiModel'];
  
  if (!geminiModelConfig) {
    logError('package.json - Missing codecrypt.geminiModel configuration');
    hasErrors = true;
    return;
  }

  if (geminiModelConfig.default !== CORRECT_MODEL) {
    logError(`package.json - Default model is '${geminiModelConfig.default}', should be '${CORRECT_MODEL}'`);
    hasErrors = true;
  } else {
    logSuccess('package.json - Default model is correct');
  }

  // Check examples
  if (geminiModelConfig.examples && !geminiModelConfig.examples.includes(CORRECT_MODEL)) {
    logWarning('package.json - Examples do not include correct model');
    hasWarnings = true;
  }
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  logHeader('Checking Environment Variables');

  if (process.env.GEMINI_API_KEY) {
    logSuccess('GEMINI_API_KEY environment variable is set');
    
    // Validate format
    if (process.env.GEMINI_API_KEY.startsWith('AIza')) {
      logSuccess('GEMINI_API_KEY format looks correct');
    } else {
      logWarning('GEMINI_API_KEY format may be incorrect (should start with AIza)');
      hasWarnings = true;
    }
  } else {
    logInfo('GEMINI_API_KEY environment variable not set (will need to configure in VS Code)');
  }
}

/**
 * Search for any remaining references to old models
 */
function searchCodebase() {
  logHeader('Searching Entire Codebase');

  const { execSync } = require('child_process');
  
  // Files to exclude from search (documentation about the old names is OK)
  const excludeFiles = [
    'verify-gemini-config.js',
    'VERIFICATION_REPORT.md',
    'MANUAL_VERIFICATION_GUIDE.md',
    'CHANGELOG.md',
    'FIXES_APPLIED.md'
  ];
  
  try {
    // Search for old model names in source files only
    for (const oldModel of OLD_MODEL_NAMES) {
      try {
        const result = execSync(
          `grep -r "${oldModel}" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=out .`,
          { cwd: path.join(__dirname, '../../..'), encoding: 'utf8' }
        );
        
        if (result) {
          // Filter out excluded files
          const lines = result.split('\n').filter(line => {
            return !excludeFiles.some(excludeFile => line.includes(excludeFile));
          });
          
          if (lines.length > 0 && lines.some(line => line.trim())) {
            logError(`Found references to '${oldModel}' in source code:`);
            lines.forEach(line => {
              if (line.trim()) console.log(`  ${line}`);
            });
            hasErrors = true;
          } else {
            logSuccess(`No references to '${oldModel}' found in source code`);
          }
        }
      } catch (error) {
        // grep returns non-zero exit code when no matches found, which is good
        if (error.status === 1) {
          logSuccess(`No references to '${oldModel}' found in source code`);
        } else {
          logWarning(`Error searching for '${oldModel}': ${error.message}`);
        }
      }
    }
  } catch (error) {
    logWarning('Could not perform codebase search (grep not available)');
    logInfo('Please manually search for old model names in src/ directory');
  }
}

/**
 * Main verification function
 */
function main() {
  log('\n' + '='.repeat(60), 'bold');
  log('Gemini Configuration Verification', 'bold');
  log('='.repeat(60) + '\n', 'bold');

  logInfo(`Checking for old model names: ${OLD_MODEL_NAMES.join(', ')}`);
  logInfo(`Correct model name: ${CORRECT_MODEL}\n`);

  // Check environment
  checkEnvironment();

  // Check package.json
  logHeader('Checking package.json Configuration');
  checkPackageJson();

  // Check specific files
  logHeader('Checking Source Files');
  FILES_TO_CHECK.forEach(file => {
    checkFileForOldModels(file);
  });

  // Search entire codebase
  searchCodebase();

  // Summary
  log('\n' + '='.repeat(60), 'bold');
  log('Verification Summary', 'bold');
  log('='.repeat(60) + '\n', 'bold');

  if (hasErrors) {
    logError('FAILED - Found issues that must be fixed');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('PASSED WITH WARNINGS - Review warnings above');
    process.exit(0);
  } else {
    logSuccess('PASSED - All checks successful!');
    logInfo('\nNext steps:');
    logInfo('1. Configure Gemini API key in VS Code');
    logInfo('2. Run manual end-to-end verification');
    logInfo('3. See MANUAL_VERIFICATION_GUIDE.md for details');
    process.exit(0);
  }
}

// Run verification
main();
