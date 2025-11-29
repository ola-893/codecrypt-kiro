/**
 * Tests for Docker service
 */

import * as assert from 'assert';
import { DockerService } from '../services/docker';

suite('Docker Service Tests', () => {
  let dockerService: DockerService;

  setup(() => {
    dockerService = new DockerService();
  });

  test('should create Docker service instance', () => {
    assert.ok(dockerService);
  });

  test('should check Docker availability', async () => {
    const isAvailable = await dockerService.checkDockerAvailable();
    assert.strictEqual(typeof isAvailable, 'boolean');
  });

  test('should get availability status', async () => {
    await dockerService.checkDockerAvailable();
    const status = dockerService.getAvailability();
    assert.strictEqual(typeof status, 'boolean');
  });

  test('should handle Docker unavailable gracefully', async () => {
    // This method shows a dialog which we can't easily test in unit tests
    // Just verify the method exists and is callable
    assert.ok(typeof dockerService.handleDockerUnavailable === 'function');
  });

  // Note: The following tests require Docker to be running
  // They will be skipped if Docker is not available

  test('should pull Docker image if Docker is available', async function() {
    const isAvailable = await dockerService.checkDockerAvailable();
    
    if (!isAvailable) {
      this.skip();
      return;
    }

    // Use a small, commonly available image
    await dockerService.pullImage('node:18-alpine');
  }).timeout(60000); // Pulling images can take time

  test('should create and manage container lifecycle if Docker is available', async function() {
    const isAvailable = await dockerService.checkDockerAvailable();
    
    if (!isAvailable) {
      this.skip();
      return;
    }

    const config = {
      image: 'node:18-alpine',
      name: 'codecrypt-test-container',
      workDir: '/app',
      volumes: [],
      cmd: ['node', '--version'],
    };

    try {
      // Create container
      const container = await dockerService.createContainer(config);
      assert.ok(container);

      // Start container
      await dockerService.startContainer(container);

      // Wait a bit for command to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stop container
      await dockerService.stopContainer(container);

      // Remove container
      await dockerService.removeContainer(container);
    } catch (error) {
      // Clean up on error
      await dockerService.cleanupContainers('codecrypt-test-container');
      throw error;
    }
  }).timeout(30000);

  test('should execute command in container if Docker is available', async function() {
    const isAvailable = await dockerService.checkDockerAvailable();
    
    if (!isAvailable) {
      this.skip();
      return;
    }

    const config = {
      image: 'node:18-alpine',
      name: 'codecrypt-exec-test',
      workDir: '/app',
      volumes: [],
    };

    try {
      // Create and start container
      const container = await dockerService.createContainer(config);
      await dockerService.startContainer(container);

      // Execute command
      const result = await dockerService.execInContainer(container, ['node', '--version']);
      
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('v18'));
      assert.strictEqual(typeof result.executionTime, 'number');

      // Cleanup
      await dockerService.stopContainer(container);
      await dockerService.removeContainer(container);
    } catch (error) {
      await dockerService.cleanupContainers('codecrypt-exec-test');
      throw error;
    }
  }).timeout(30000);

  test('should cleanup containers with prefix', async function() {
    const isAvailable = await dockerService.checkDockerAvailable();
    
    if (!isAvailable) {
      this.skip();
      return;
    }

    // This should not throw even if no containers exist
    await dockerService.cleanupContainers('codecrypt-cleanup-test');
  });
});
