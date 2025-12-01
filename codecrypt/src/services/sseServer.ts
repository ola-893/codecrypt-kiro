/**
 * Server-Sent Events (SSE) server for real-time event streaming to frontend
 */

import * as http from 'http';
import { ResurrectionEventEmitter } from './eventEmitter';
import {
  ResurrectionEventType,
  ResurrectionEvent,
  TransformationAppliedEventData,
  DependencyUpdatedEventData,
  TestCompletedEventData,
  MetricUpdatedEventData,
  NarrationEventData,
  ASTAnalysisCompleteEventData,
  LLMInsightEventData,
  ValidationCompleteEventData,
} from '../types';
import { getLogger } from '../utils/logger';

/**
 * SSE server configuration
 */
export interface SSEServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host?: string;
  /** CORS origin (default: '*') */
  corsOrigin?: string;
  /** Event types to forward (default: all) */
  eventTypes?: ResurrectionEventType[];
}

/**
 * SSE client connection
 */
interface SSEClient {
  /** Client ID */
  id: string;
  /** HTTP response object */
  response: http.ServerResponse;
  /** Event types this client is subscribed to */
  subscribedEvents: Set<ResurrectionEventType>;
}

/**
 * Server-Sent Events server for streaming resurrection events to frontend
 */
export class SSEServer {
  private server: http.Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private eventEmitter: ResurrectionEventEmitter;
  private config: Required<SSEServerConfig>;
  private logger = getLogger();
  private nextClientId = 1;

  constructor(eventEmitter: ResurrectionEventEmitter, config: SSEServerConfig) {
    this.eventEmitter = eventEmitter;
    this.config = {
      host: config.host || 'localhost',
      corsOrigin: config.corsOrigin || '*',
      eventTypes: config.eventTypes || [
        'transformation_applied',
        'dependency_updated',
        'test_completed',
        'metric_updated',
        'narration',
        'ast_analysis_complete',
        'llm_insight',
        'validation_complete',
        'baseline_compilation_complete',
        'final_compilation_complete',
        'resurrection_verdict',
        // Post-resurrection validation events
        'validation_iteration_start',
        'validation_error_analysis',
        'validation_fix_applied',
        'validation_fix_outcome',
      ],
      ...config,
    };
  }

  /**
   * Start the SSE server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('SSE server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.logger.error('SSE server error', error);
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.logger.info(`SSE server listening on ${this.config.host}:${this.config.port}`);
        this.setupEventForwarding();
        resolve();
      });
    });
  }

  /**
   * Stop the SSE server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.response.end();
    }
    this.clients.clear();

    // Remove event listeners
    this.removeEventForwarding();

    // Close the server
    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          this.logger.error('Error closing SSE server', error);
          reject(error);
        } else {
          this.logger.info('SSE server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only handle GET requests to /events
    if (req.method !== 'GET' || req.url !== '/events') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Set up SSE connection
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Create client
    const clientId = `client-${this.nextClientId++}`;
    const client: SSEClient = {
      id: clientId,
      response: res,
      subscribedEvents: new Set(this.config.eventTypes),
    };

    this.clients.set(clientId, client);
    this.logger.info(`SSE client connected: ${clientId}`);

    // Send initial connection message
    this.sendEvent(client, 'connected', { clientId, timestamp: Date.now() });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      this.logger.info(`SSE client disconnected: ${clientId}`);
    });
  }

  /**
   * Set up event forwarding from event emitter to SSE clients
   */
  private setupEventForwarding(): void {
    // Forward transformation_applied events
    this.eventEmitter.onTransformationApplied((event) => {
      this.broadcastEvent('transformation_applied', event);
    });

    // Forward dependency_updated events
    this.eventEmitter.onDependencyUpdated((event) => {
      this.broadcastEvent('dependency_updated', event);
    });

    // Forward test_completed events
    this.eventEmitter.onTestCompleted((event) => {
      this.broadcastEvent('test_completed', event);
    });

    // Forward metric_updated events
    this.eventEmitter.onMetricUpdated((event) => {
      this.broadcastEvent('metric_updated', event);
    });

    // Forward narration events
    this.eventEmitter.onNarration((event) => {
      this.broadcastEvent('narration', event);
    });

    // Forward ast_analysis_complete events
    this.eventEmitter.onASTAnalysisComplete((event) => {
      this.broadcastEvent('ast_analysis_complete', event);
    });

    // Forward llm_insight events
    this.eventEmitter.onLLMInsight((event) => {
      this.broadcastEvent('llm_insight', event);
    });

    // Forward validation_complete events
    this.eventEmitter.onValidationComplete((event) => {
      this.broadcastEvent('validation_complete', event);
    });

    // Forward baseline_compilation_complete events
    this.eventEmitter.onBaselineCompilationComplete((event) => {
      this.broadcastEvent('baseline_compilation_complete', event);
    });

    // Forward final_compilation_complete events
    this.eventEmitter.onFinalCompilationComplete((event) => {
      this.broadcastEvent('final_compilation_complete', event);
    });

    // Forward resurrection_verdict events
    this.eventEmitter.onResurrectionVerdict((event) => {
      this.broadcastEvent('resurrection_verdict', event);
    });

    // Forward post-resurrection validation events
    this.eventEmitter.onValidationIterationStart((event) => {
      this.broadcastEvent('validation_iteration_start', event);
    });

    this.eventEmitter.onValidationErrorAnalysis((event) => {
      this.broadcastEvent('validation_error_analysis', event);
    });

    this.eventEmitter.onValidationFixApplied((event) => {
      this.broadcastEvent('validation_fix_applied', event);
    });

    this.eventEmitter.onValidationFixOutcome((event) => {
      this.broadcastEvent('validation_fix_outcome', event);
    });
  }

  /**
   * Remove event forwarding listeners
   */
  private removeEventForwarding(): void {
    for (const eventType of this.config.eventTypes) {
      this.eventEmitter.removeAllListenersForType(eventType);
    }
  }

  /**
   * Broadcast an event to all subscribed clients
   */
  private broadcastEvent(eventType: ResurrectionEventType, event: ResurrectionEvent<any>): void {
    for (const client of this.clients.values()) {
      if (client.subscribedEvents.has(eventType)) {
        this.sendEvent(client, eventType, event);
      }
    }
  }

  /**
   * Send an event to a specific client
   */
  private sendEvent(client: SSEClient, eventType: string, data: any): void {
    try {
      const eventData = JSON.stringify(data);
      client.response.write(`event: ${eventType}\n`);
      client.response.write(`data: ${eventData}\n\n`);
    } catch (error) {
      this.logger.error(`Failed to send event to client ${client.id}`, error);
      // Remove client if sending fails
      this.clients.delete(client.id);
      client.response.end();
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if the server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get server address
   */
  getAddress(): { host: string; port: number } | null {
    if (!this.server || !this.server.listening) {
      return null;
    }
    return {
      host: this.config.host,
      port: this.config.port,
    };
  }
}

/**
 * Create and start an SSE server
 */
export async function createSSEServer(
  eventEmitter: ResurrectionEventEmitter,
  config: SSEServerConfig
): Promise<SSEServer> {
  const server = new SSEServer(eventEmitter, config);
  await server.start();
  return server;
}
