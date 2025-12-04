
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PackageReplacement {
  oldName: string;
  newName: string;
  versionMapping: { [oldVersion: string]: string };
  requiresCodeChanges: boolean;
}

export interface PackageReplacementResult {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  requiresManualReview: boolean;
}

export interface IPackageReplacementExecutor {
  executeReplacement(
    replacements: PackageReplacement[],
  ): Promise<PackageReplacementResult[]>;
}

export class PackageReplacementExecutor implements IPackageReplacementExecutor {
  constructor(private projectPath: string) {}

  // Internal wrappers for fs/promises methods to allow easier stubbing in tests
  private async _readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fs.readFile(filePath, encoding);
  }

  private async _writeFile(filePath: string, content: string): Promise<void> {
    return fs.writeFile(filePath, content);
  }

  public async executeReplacement(
    replacements: PackageReplacement[],
  ): Promise<PackageReplacementResult[]> {
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    const packageJsonContent = await this._readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    const results: PackageReplacementResult[] = [];

    for (const replacement of replacements) {
      // Handle dependencies
      if (packageJson.dependencies?.[replacement.oldName]) {
        const oldVersion = packageJson.dependencies[replacement.oldName];
        const newVersion = replacement.versionMapping[oldVersion] || replacement.versionMapping['*'] || oldVersion;
        
        if (!packageJson.dependencies) {
          packageJson.dependencies = {};
        }
        
        packageJson.dependencies[replacement.newName] = newVersion;
        if (replacement.oldName !== replacement.newName) {
          delete packageJson.dependencies[replacement.oldName];
        }
        results.push({
          packageName: replacement.newName,
          oldVersion: oldVersion,
          newVersion: newVersion,
          requiresManualReview: replacement.requiresCodeChanges,
        });
      }

      // Handle devDependencies
      if (packageJson.devDependencies?.[replacement.oldName]) {
        const oldVersion = packageJson.devDependencies[replacement.oldName];
        const newVersion = replacement.versionMapping[oldVersion] || replacement.versionMapping['*'] || oldVersion;

        if (!packageJson.devDependencies) {
          packageJson.devDependencies = {};
        }

        packageJson.devDependencies[replacement.newName] = newVersion;
        if (replacement.oldName !== replacement.newName) {
          delete packageJson.devDependencies[replacement.oldName];
        }
        results.push({
          packageName: replacement.newName,
          oldVersion: oldVersion,
          newVersion: newVersion,
          requiresManualReview: replacement.requiresCodeChanges,
        });
      }
    }

    await this._writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    return results;
  }
}
