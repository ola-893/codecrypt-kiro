/**
 * Docker integration service for Time Machine validation
 * Provides container management for running tests in historical environments
 */

import Docker from 'dockerode';
import * as vscode from 'vscode';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Docker container configuration
 */
export interface DockerContainerConfig {
  /** Docker image to use (e.g., 'node:12.22.0') */
  image: string;
  /** Container name */
  name: string;
  /** Working directory inside container */
  workDir: string;
  /** Volume mounts */
  volumes: Array<{
    host: string;
    container: string;
    mode?: 'ro' | 'rw';
  }>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Command to run */
  cmd?: string[];
}

/**
 * Result of a command execution in a container
 */
export interface ContainerExecResult {
  /** Exit code of the command */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Docker service for managing containers
 */
export class DockerService {
  private docker: Docker | null = null;
  private isAvailable: boolean = false;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Check if Docker daemon is available
   */
  async checkDockerAvailable(): Promise<boolean> {
    try {
      if (!this.docker) {
        return false;
      }

      await this.docker.ping();
      this.isAvailable = true;
      logger.info('Docker daemon is available');
      return true;
    } catch (error) {
      this.isAvailable = false;
      logger.warn('Docker daemon is not available', error);
      return false;
    }
  }

  /**
   * Get Docker availability status
   */
  getAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Handle Docker unavailable gracefully
   */
  async handleDockerUnavailable(): Promise<void> {
    const message = 'Docker is not available. Time Machine validation will be skipped.';
    logger.warn(message);
    
    await vscode.window.showWarningMessage(
      message + ' Install Docker to enable historical environment testing.',
      'Learn More'
    ).then(selection => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://docs.docker.com/get-docker/'));
      }
    });
  }

  /**
   * Pull a Docker image if not already present
   */
  async pullImage(imageName: string): Promise<void> {
    if (!this.docker || !this.isAvailable) {
      throw new Error('Docker is not available');
    }

    try {
      logger.info(`Checking for Docker image: ${imageName}`);
      
      // Check if image exists locally
      const images = await this.docker.listImages();
      const imageExists = images.some(img => 
        img.RepoTags && img.RepoTags.includes(imageName)
      );

      if (imageExists) {
        logger.info(`Image ${imageName} already exists locally`);
        return;
      }

      // Pull the image
      logger.info(`Pulling Docker image: ${imageName}`);
      
      return new Promise((resolve, reject) => {
        this.docker!.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            reject(err);
            return;
          }

          this.docker!.modem.followProgress(stream, (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              logger.info(`Successfully pulled image: ${imageName}`);
              resolve();
            }
          });
        });
      });
    } catch (error) {
      logger.error(`Failed to pull Docker image: ${imageName}`, error);
      throw error;
    }
  }

  /**
   * Create a Docker container
   */
  async createContainer(config: DockerContainerConfig): Promise<Docker.Container> {
    if (!this.docker || !this.isAvailable) {
      throw new Error('Docker is not available');
    }

    try {
      logger.info(`Creating Docker container: ${config.name}`);

      // Ensure image is available
      await this.pullImage(config.image);

      // Prepare volume binds
      const binds = config.volumes.map(vol => 
        `${vol.host}:${vol.container}${vol.mode ? ':' + vol.mode : ''}`
      );

      // Prepare environment variables
      const env = config.env 
        ? Object.entries(config.env).map(([key, value]) => `${key}=${value}`)
        : [];

      // Create container
      const container = await this.docker.createContainer({
        Image: config.image,
        name: config.name,
        WorkingDir: config.workDir,
        Cmd: config.cmd,
        Env: env,
        HostConfig: {
          Binds: binds,
          AutoRemove: false, // We'll remove manually for better control
        },
        Tty: false,
        AttachStdout: true,
        AttachStderr: true,
      });

      logger.info(`Container created: ${config.name}`);
      return container;
    } catch (error) {
      logger.error(`Failed to create container: ${config.name}`, error);
      throw error;
    }
  }

  /**
   * Start a container
   */
  async startContainer(container: Docker.Container): Promise<void> {
    try {
      const info = await container.inspect();
      logger.info(`Starting container: ${info.Name}`);
      
      await container.start();
      logger.info(`Container started: ${info.Name}`);
    } catch (error) {
      logger.error('Failed to start container', error);
      throw error;
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(container: Docker.Container): Promise<void> {
    try {
      const info = await container.inspect();
      logger.info(`Stopping container: ${info.Name}`);
      
      await container.stop({ t: 10 }); // 10 second timeout
      logger.info(`Container stopped: ${info.Name}`);
    } catch (error) {
      // Container might already be stopped
      logger.warn('Failed to stop container (might already be stopped)', error);
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(container: Docker.Container): Promise<void> {
    try {
      const info = await container.inspect();
      logger.info(`Removing container: ${info.Name}`);
      
      await container.remove({ force: true });
      logger.info(`Container removed: ${info.Name}`);
    } catch (error) {
      logger.error('Failed to remove container', error);
      throw error;
    }
  }

  /**
   * Execute a command in a running container
   */
  async execInContainer(
    container: Docker.Container,
    command: string[]
  ): Promise<ContainerExecResult> {
    try {
      const info = await container.inspect();
      logger.info(`Executing command in container ${info.Name}: ${command.join(' ')}`);

      const startTime = Date.now();

      // Create exec instance
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
      });

      // Start exec and capture output
      const stream = await exec.start({ Detach: false });

      let stdout = '';
      let stderr = '';

      // Collect output
      await new Promise<void>((resolve, reject) => {
        if (this.docker) {
          this.docker.modem.demuxStream(
            stream,
            {
              write: (chunk: Buffer) => {
                stdout += chunk.toString();
              }
            } as NodeJS.WritableStream,
            {
              write: (chunk: Buffer) => {
                stderr += chunk.toString();
              }
            } as NodeJS.WritableStream
          );
        }

        stream.on('end', () => {
          // Add a small delay to ensure exec info is updated
          setTimeout(resolve, 100);
        });
        stream.on('error', reject);
      });

      // Get exit code - wait a bit more to ensure it's set
      const execInfo = await exec.inspect();
      const exitCode = execInfo.ExitCode ?? 0;
      const executionTime = Date.now() - startTime;

      logger.info(`Command completed with exit code ${exitCode} in ${executionTime}ms`);

      return {
        exitCode,
        stdout,
        stderr,
        executionTime,
      };
    } catch (error) {
      logger.error('Failed to execute command in container', error);
      throw error;
    }
  }

  /**
   * Clean up all containers with a specific name prefix
   */
  async cleanupContainers(namePrefix: string): Promise<void> {
    if (!this.docker || !this.isAvailable) {
      return;
    }

    try {
      logger.info(`Cleaning up containers with prefix: ${namePrefix}`);
      
      const containers = await this.docker.listContainers({ all: true });
      const matchingContainers = containers.filter(c => 
        c.Names.some(name => name.includes(namePrefix))
      );

      for (const containerInfo of matchingContainers) {
        const container = this.docker.getContainer(containerInfo.Id);
        await this.stopContainer(container);
        await this.removeContainer(container);
      }

      logger.info(`Cleaned up ${matchingContainers.length} containers`);
    } catch (error) {
      logger.error('Failed to cleanup containers', error);
    }
  }
}

/**
 * Singleton instance of Docker service
 */
export const dockerService = new DockerService();
