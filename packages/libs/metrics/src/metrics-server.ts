import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Registry } from 'prom-client';

/** A standalone HTTP server that serves Prometheus metrics on a dedicated port. */
export interface MetricsServer {
    /** Starts the HTTP server on the configured port. */
    start(): Promise<void>;
    /** Stops the HTTP server. */
    stop(): Promise<void>;
    /** Returns the bound address info, useful when started on port 0. */
    address(): AddressInfo | null;
}

/**
 * Creates a standalone HTTP metrics server that serves Prometheus-formatted
 * metrics on `GET /metrics` and returns 404 for all other paths.
 */
export function createMetricsServer(registry: Registry, port: number): MetricsServer {
    let server: Server | null = null;

    return {
        start(): Promise<void> {
            return new Promise((resolve, reject) => {
                server = createServer((req, res) => {
                    if (req.url === '/metrics' && req.method === 'GET') {
                        void registry.metrics().then((output) => {
                            res.writeHead(200, { 'content-type': registry.contentType });
                            res.end(output);
                        });
                    } else {
                        res.writeHead(404);
                        res.end();
                    }
                });
                server.on('error', reject);
                server.listen(port, () => { resolve(); });
            });
        },
        stop(): Promise<void> {
            return new Promise((resolve, reject) => {
                if (!server) {
                    resolve();
                    return;
                }
                server.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        },
        address(): AddressInfo | null {
            if (!server) return null;
            const addr = server.address();
            if (typeof addr === 'string' || addr === null) return null;
            return addr;
        },
    };
}
