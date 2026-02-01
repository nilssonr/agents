import { describe, it, expect } from 'vitest';

import { createClient } from './client.js';

describe('createClient', () => {
    it('returns an openapi-fetch client with GET and POST methods', () => {
        const client = createClient({ baseUrl: 'http://localhost:3000' });
        expect(client).toBeDefined();
        expect(typeof client.GET).toBe('function');
        expect(typeof client.POST).toBe('function');
        expect(typeof client.DELETE).toBe('function');
    });
});
