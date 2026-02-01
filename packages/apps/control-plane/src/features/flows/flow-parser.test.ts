import { describe, expect, it } from 'vitest';

import { parseFlowSteps, findStepById } from './flow-parser.js';

describe('parseFlowSteps', () => {
    it('parses a single step with auto-generated ID', () => {
        const steps = parseFlowSteps([{ type: 'noop' }]);
        expect(steps).toHaveLength(1);
        expect(steps[0].id).toBe('step_0');
        expect(steps[0].type).toBe('noop');
    });

    it('parses multiple steps with explicit IDs', () => {
        const steps = parseFlowSteps([
            { id: 'fetch', type: 'http', params: { url: 'example.com' } },
            { id: 'transform', type: 'map', params: { field: 'data' } },
        ]);
        expect(steps).toHaveLength(2);
        expect(steps[0].id).toBe('fetch');
        expect(steps[1].id).toBe('transform');
    });

    it('auto-generates IDs for steps without them', () => {
        const steps = parseFlowSteps([{ type: 'a' }, { type: 'b' }, { type: 'c' }]);
        expect(steps.map((s) => s.id)).toEqual(['step_0', 'step_1', 'step_2']);
    });

    it('returns empty array for empty or non-array input', () => {
        expect(parseFlowSteps([])).toEqual([]);
        expect(parseFlowSteps(null)).toEqual([]);
        expect(parseFlowSteps(undefined)).toEqual([]);
    });

    it('throws on duplicate IDs', () => {
        expect(() =>
            parseFlowSteps([
                { id: 'dup', type: 'a' },
                { id: 'dup', type: 'b' },
            ]),
        ).toThrow('Duplicate step ID: dup');
    });

    it('throws on missing type', () => {
        expect(() => parseFlowSteps([{ id: 'x' }])).toThrow("missing a 'type' field");
    });

    it('throws on bad onError reference', () => {
        expect(() => parseFlowSteps([{ id: 'a', type: 'x', onError: { default: 'nonexistent' } }])).toThrow(
            "references unknown step 'nonexistent'",
        );
    });

    it('accepts valid onError references', () => {
        const steps = parseFlowSteps([
            { id: 'a', type: 'x', onError: { default: 'b' } },
            { id: 'b', type: 'error-handler' },
        ]);
        expect(steps[0].onError).toEqual({ default: 'b' });
    });
});

describe('findStepById', () => {
    it('returns the matching step', () => {
        const steps = parseFlowSteps([
            { id: 'a', type: 'x' },
            { id: 'b', type: 'y' },
        ]);
        expect(findStepById(steps, 'b')?.type).toBe('y');
    });

    it('returns null for unknown ID', () => {
        const steps = parseFlowSteps([{ id: 'a', type: 'x' }]);
        expect(findStepById(steps, 'z')).toBeNull();
    });
});
