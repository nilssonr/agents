import { describe, expect, it } from 'vitest';

import { createFlowService } from './flow-service.js';

describe('FlowService', () => {
    const service = createFlowService();

    it('returns the first step as the initial step', () => {
        const step = service.getInitialStep([{ id: 'a', type: 'noop' }]);
        expect(step?.id).toBe('a');
    });

    it('returns null for empty activities', () => {
        expect(service.getInitialStep([])).toBeNull();
    });

    describe('handleStepSuccess', () => {
        it('completes flow when result has no next', () => {
            const activities = [{ id: 'a', type: 'noop' }];
            const transition = service.handleStepSuccess(activities, 'a', { value: 42 }, {});
            expect(transition.nextStepId).toBeNull();
            expect(transition.updatedContext).toEqual({ a: { value: 42 } });
        });

        it('routes to next step when result has next', () => {
            const activities = [
                { id: 'a', type: 'fetch' },
                { id: 'b', type: 'transform' },
            ];
            const transition = service.handleStepSuccess(activities, 'a', { next: 'b', data: 1 }, {});
            expect(transition.nextStepId).toBe('b');
            expect(transition.updatedContext).toEqual({ a: { next: 'b', data: 1 } });
        });

        it('accumulates context across steps', () => {
            const activities = [
                { id: 'a', type: 'fetch' },
                { id: 'b', type: 'transform' },
                { id: 'c', type: 'store' },
            ];
            const ctx1 = service.handleStepSuccess(activities, 'a', { next: 'b', d: 1 }, {});
            const ctx2 = service.handleStepSuccess(activities, 'b', { next: 'c', d: 2 }, ctx1.updatedContext);
            expect(ctx2.updatedContext).toEqual({
                a: { next: 'b', d: 1 },
                b: { next: 'c', d: 2 },
            });
        });

        it('completes flow when next references unknown step', () => {
            const activities = [{ id: 'a', type: 'noop' }];
            const transition = service.handleStepSuccess(activities, 'a', { next: 'nonexistent' }, {});
            expect(transition.nextStepId).toBeNull();
        });
    });

    describe('handleStepFailure', () => {
        it('retries when under maxRetries', () => {
            const activities = [{ id: 'a', type: 'noop', maxRetries: 3 }];
            const result = service.handleStepFailure(activities, 'a', { message: 'fail' }, 1, {});
            expect(result.nextStepId).toBe('a');
            expect(result.retry).toBe(true);
        });

        it('does not retry when retries exhausted', () => {
            const activities = [{ id: 'a', type: 'noop', maxRetries: 2 }];
            const result = service.handleStepFailure(activities, 'a', { message: 'fail' }, 2, {});
            expect(result.nextStepId).toBeNull();
            expect(result.retry).toBe(false);
        });

        it('routes to onError handler by error type', () => {
            const activities = [
                { id: 'a', type: 'noop', onError: { TIMEOUT: 'b' } },
                { id: 'b', type: 'fallback' },
            ];
            const result = service.handleStepFailure(
                activities, 'a', { message: 'timed out', type: 'TIMEOUT' }, 0, {},
            );
            expect(result.nextStepId).toBe('b');
            expect(result.retry).toBe(false);
        });

        it('routes to onError default when type does not match', () => {
            const activities = [
                { id: 'a', type: 'noop', onError: { default: 'b' } },
                { id: 'b', type: 'fallback' },
            ];
            const result = service.handleStepFailure(
                activities, 'a', { message: 'fail' }, 0, {},
            );
            expect(result.nextStepId).toBe('b');
        });

        it('returns null when no recovery option exists', () => {
            const activities = [{ id: 'a', type: 'noop' }];
            const result = service.handleStepFailure(activities, 'a', { message: 'fail' }, 0, {});
            expect(result.nextStepId).toBeNull();
            expect(result.retry).toBe(false);
        });

        it('returns null for unknown step', () => {
            const activities = [{ id: 'a', type: 'noop' }];
            const result = service.handleStepFailure(activities, 'z', { message: 'fail' }, 0, {});
            expect(result.nextStepId).toBeNull();
        });
    });
});
