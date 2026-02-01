import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';
import swagger from '@fastify/swagger';

import { registerAgentRoutes } from '../src/api/rest/agents.js';
import { registerHealthRoutes } from '../src/api/rest/health.js';
import { registerJobRoutes } from '../src/api/rest/jobs.js';
import { registerWebhookRoutes } from '../src/api/rest/webhooks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
    const app = Fastify();

    await app.register(swagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'Agents Control Plane API',
                version: '1.0.0',
                description: 'REST API for managing agents, jobs, triggers, and webhooks.',
            },
            tags: [
                { name: 'Agents', description: 'Agent CRUD and lifecycle' },
                { name: 'Jobs', description: 'Job logs and data' },
                {
                    name: 'Webhooks',
                    description: 'External trigger endpoints',
                },
                {
                    name: 'Health',
                    description: 'Liveness and readiness probes',
                },
            ],
        },
    });

    // Register routes with stub deps — we only need the schema, not real services
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    const stub: any = new Proxy({}, { get: () => () => Promise.resolve({}) });

    registerAgentRoutes(app, stub);
    registerJobRoutes(app, stub);
    registerWebhookRoutes(app, stub);
    registerHealthRoutes(app, { checkDb: async () => {} });

    await app.ready();
    const spec = app.swagger();
    const outPath = resolve(__dirname, '../../../libs/sdk/openapi.json');
    writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n');
    console.log(`OpenAPI spec written to ${outPath}`);
    await app.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
