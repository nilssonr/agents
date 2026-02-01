import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
});
