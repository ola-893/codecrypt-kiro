/**
 * Tests for the SSE Server
 */

import * as assert from 'assert';
import * as http from 'http';
import { SSEServer, createSSEServer } from '../services/sseServer';
import { ResurrectionEventEmitter } from '../services/eventEmitter';
import {
  TransformationAppliedEventData,
  DependencyUpdatedEventData,
  MetricUpdatedEventData,
  NarrationEventData,
} from '../types';

suite('SSEServer Test Suite', () => {
  let eventEmitter: ResurrectionEventEmitter;
  let server: SSEServer;
  const testPort = 9876;

  setup(() => {
    eventEmitter = new ResurrectionEventEmitter();
  });

  teardown(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
    eventEmitter.removeAllListeners();
  });

  suite('Server Lifecycle', () => {
    test('should start the SSE server', async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();

      assert.strictEqual(server.isRunning(), true);
      const address = server.getAddress();
      assert.ok(address !== null);
      assert.strictEqual(address!.host, 'localhost');
      assert.strictEqual(address!.port, testPort);
    });

    test('should stop the SSE server', async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();
      assert.strictEqual(server.isRunning(), true);

      await server.stop();
      assert.strictEqual(server.isRunning(), false);
      assert.strictEqual(server.getAddress(), null);
    });

    test('should throw error if starting an already running server', async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();

      try {
        await server.start();
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.ok(error.message.includes('already running'));
      }
    });

    test('should handle stop when server is not running', async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.stop(); // Should not throw
      assert.ok(true);
    });
  });

  suite('Client Connections', () => {
    setup(async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();
    });

    test('should accept client connections', function (done) {
      this.timeout(5000);
      assert.strictEqual(server.getClientCount(), 0);

      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], 'text/event-stream');
        assert.strictEqual(res.headers['cache-control'], 'no-cache');
        assert.strictEqual(res.headers['connection'], 'keep-alive');

        // Wait a bit for the client to be registered
        setTimeout(() => {
          assert.strictEqual(server.getClientCount(), 1);
          req.destroy();
          done();
        }, 100);
      });
    });

    test('should send connection event to new clients', function (done) {
      this.timeout(5000);
      let completed = false;
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          // Check for connection event
          if (!completed && data.includes('event: connected') && data.includes('clientId')) {
            completed = true;
            assert.ok(data.includes('event: connected'));
            assert.ok(data.includes('clientId'));
            req.destroy();
            done();
          }
        });
      });
    });

    test('should handle client disconnections', function (done) {
      this.timeout(5000);
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        setTimeout(() => {
          assert.strictEqual(server.getClientCount(), 1);
          req.destroy();

          // Wait for disconnect to be processed
          setTimeout(() => {
            assert.strictEqual(server.getClientCount(), 0);
            done();
          }, 100);
        }, 100);
      });
    });

    test('should handle multiple concurrent clients', function (done) {
      this.timeout(5000);
      const req1 = http.get(`http://localhost:${testPort}/events`);
      const req2 = http.get(`http://localhost:${testPort}/events`);
      const req3 = http.get(`http://localhost:${testPort}/events`);

      setTimeout(() => {
        assert.strictEqual(server.getClientCount(), 3);
        req1.destroy();
        req2.destroy();
        req3.destroy();
        done();
      }, 200);
    });

    test('should return 404 for non-events endpoints', function (done) {
      this.timeout(5000);
      http.get(`http://localhost:${testPort}/other`, (res) => {
        assert.strictEqual(res.statusCode, 404);
        done();
      });
    });

    test('should handle OPTIONS preflight requests', function (done) {
      this.timeout(5000);
      const req = http.request(
        {
          hostname: 'localhost',
          port: testPort,
          path: '/events',
          method: 'OPTIONS',
        },
        (res) => {
          assert.strictEqual(res.statusCode, 204);
          assert.strictEqual(res.headers['access-control-allow-origin'], '*');
          assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, OPTIONS');
          done();
        }
      );
      req.end();
    });
  });

  suite('Event Forwarding', () => {
    setup(async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();
    });

    test('should forward transformation_applied events to clients', function (done) {
      this.timeout(5000);
      let completed = false;
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          if (!completed && data.includes('event: transformation_applied') && data.includes('axios')) {
            completed = true;
            assert.ok(data.includes('event: transformation_applied'));
            assert.ok(data.includes('axios'));
            req.destroy();
            done();
          }
        });

        // Wait for connection, then emit event
        setTimeout(() => {
          const eventData: TransformationAppliedEventData = {
            transformationType: 'dependency_update',
            packageName: 'axios',
            version: { from: '0.21.0', to: '1.2.0' },
            details: {},
            success: true,
          };
          eventEmitter.emitTransformationApplied(eventData);
        }, 100);
      });
    });

    test('should forward dependency_updated events to clients', function (done) {
      this.timeout(5000);
      let completed = false;
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          if (!completed && data.includes('event: dependency_updated') && data.includes('react')) {
            completed = true;
            assert.ok(data.includes('event: dependency_updated'));
            assert.ok(data.includes('react'));
            req.destroy();
            done();
          }
        });

        setTimeout(() => {
          const eventData: DependencyUpdatedEventData = {
            packageName: 'react',
            previousVersion: '16.0.0',
            newVersion: '18.0.0',
            success: true,
            vulnerabilitiesFixed: 2,
          };
          eventEmitter.emitDependencyUpdated(eventData);
        }, 100);
      });
    });

    test('should forward metric_updated events to clients', function (done) {
      this.timeout(5000);
      let completed = false;
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          if (!completed && data.includes('event: metric_updated') && data.includes('complexity')) {
            completed = true;
            assert.ok(data.includes('event: metric_updated'));
            assert.ok(data.includes('complexity'));
            req.destroy();
            done();
          }
        });

        setTimeout(() => {
          const eventData: MetricUpdatedEventData = {
            timestamp: Date.now(),
            depsUpdated: 5,
            vulnsFixed: 3,
            complexity: 10,
            coverage: 80,
            loc: 1000,
            progress: 50,
          };
          eventEmitter.emitMetricUpdated(eventData);
        }, 100);
      });
    });

    test('should forward narration events to clients', function (done) {
      this.timeout(5000);
      let completed = false;
      const req = http.get(`http://localhost:${testPort}/events`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();

          if (!completed && data.includes('event: narration') && data.includes('Updating axios')) {
            completed = true;
            assert.ok(data.includes('event: narration'));
            assert.ok(data.includes('Updating axios'));
            req.destroy();
            done();
          }
        });

        setTimeout(() => {
          const eventData: NarrationEventData = {
            message: 'Updating axios from version 0.21 to 1.2',
            priority: 'medium',
            category: 'info',
          };
          eventEmitter.emitNarration(eventData);
        }, 100);
      });
    });

    test('should broadcast events to all connected clients', function (done) {
      this.timeout(5000);
      let client1Received = false;
      let client2Received = false;

      const req1 = http.get(`http://localhost:${testPort}/events`, (res) => {
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('event: narration')) {
            client1Received = true;
            if (client1Received && client2Received) {
              req1.destroy();
              req2.destroy();
              done();
            }
          }
        });
      });

      const req2 = http.get(`http://localhost:${testPort}/events`, (res) => {
        res.on('data', (chunk) => {
          const data = chunk.toString();
          if (data.includes('event: narration')) {
            client2Received = true;
            if (client1Received && client2Received) {
              req1.destroy();
              req2.destroy();
              done();
            }
          }
        });
      });

      setTimeout(() => {
        eventEmitter.emitNarration({ message: 'Test broadcast' });
      }, 200);
    });
  });

  suite('Event Filtering', () => {
    test('should only forward subscribed event types', async function () {
      this.timeout(5000);
      // Create server that only forwards narration events
      server = new SSEServer(eventEmitter, {
        port: testPort,
        eventTypes: ['narration'],
      });
      await server.start();

      const receivedEvents: string[] = [];

      return new Promise<void>((resolve) => {
        const req = http.get(`http://localhost:${testPort}/events`, (res) => {
          res.on('data', (chunk) => {
            const data = chunk.toString();
            const lines = data.split('\n');
            for (const line of lines) {
              if (line.startsWith('event:')) {
                const eventType = line.substring(7).trim();
                if (eventType !== 'connected') {
                  receivedEvents.push(eventType);
                }
              }
            }
          });
        });

        setTimeout(() => {
          // Emit various events
          eventEmitter.emitNarration({ message: 'Test' });
          eventEmitter.emitDependencyUpdated({
            packageName: 'test',
            previousVersion: '1.0.0',
            newVersion: '2.0.0',
            success: true,
            vulnerabilitiesFixed: 0,
          });
          eventEmitter.emitMetricUpdated({
            timestamp: Date.now(),
            depsUpdated: 1,
            vulnsFixed: 0,
            complexity: 5,
            coverage: 80,
            loc: 100,
            progress: 10,
          });

          setTimeout(() => {
            assert.ok(receivedEvents.includes('narration'));
            assert.ok(!receivedEvents.includes('dependency_updated'));
            assert.ok(!receivedEvents.includes('metric_updated'));
            req.destroy();
            resolve();
          }, 200);
        }, 100);
      });
    });
  });

  suite('Configuration', () => {
    test('should use custom host and port', async () => {
      server = new SSEServer(eventEmitter, {
        port: testPort + 1,
        host: '127.0.0.1',
      });
      await server.start();

      const address = server.getAddress();
      assert.ok(address !== null);
      assert.strictEqual(address!.host, '127.0.0.1');
      assert.strictEqual(address!.port, testPort + 1);
    });

    test('should use custom CORS origin', async function () {
      this.timeout(5000);
      server = new SSEServer(eventEmitter, {
        port: testPort,
        corsOrigin: 'http://example.com',
      });
      await server.start();

      return new Promise<void>((resolve) => {
        const req = http.get(`http://localhost:${testPort}/events`, (res) => {
          assert.strictEqual(res.headers['access-control-allow-origin'], 'http://example.com');
          req.destroy();
          resolve();
        });
      });
    });
  });

  suite('createSSEServer helper', () => {
    test('should create and start an SSE server', async () => {
      server = await createSSEServer(eventEmitter, { port: testPort });

      assert.strictEqual(server.isRunning(), true);
      const address = server.getAddress();
      assert.ok(address !== null);
      assert.strictEqual(address!.host, 'localhost');
      assert.strictEqual(address!.port, testPort);
    });
  });

  suite('Error Handling', () => {
    test('should handle port already in use', async () => {
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();

      const server2 = new SSEServer(eventEmitter, { port: testPort });
      try {
        await server2.start();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error);
      }
    });

    test('should clean up clients when server stops', async function () {
      this.timeout(5000);
      server = new SSEServer(eventEmitter, { port: testPort });
      await server.start();

      const req = http.get(`http://localhost:${testPort}/events`);

      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.strictEqual(server.getClientCount(), 1);

      await server.stop();
      assert.strictEqual(server.getClientCount(), 0);

      req.destroy();
    });
  });
});
