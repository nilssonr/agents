import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        root: '.',
        include: [
            'packages/apps/control-plane/src/**/*.test.ts',
            'packages/apps/worker/src/**/*.test.ts',
            'packages/libs/*/src/**/*.test.ts',
        ],
        exclude: ['packages/apps/web/**', '**/node_modules/**'],
    },
});
