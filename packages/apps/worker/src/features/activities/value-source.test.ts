import { describe, expect, it } from 'vitest';

import { resolveValue, type ValueSource } from './value-source.js';

describe('resolveValue', () => {
    it('returns literal value directly', () => {
        const source: ValueSource<string> = { type: 'literal', value: 'hello' };
        expect(resolveValue(source, {})).toBe('hello');
    });

    it('resolves top-level context ref', () => {
        const source: ValueSource<string> = { type: 'context', ref: 'name' };
        expect(resolveValue(source, { name: 'Alice' })).toBe('Alice');
    });

    it('resolves nested dot-path context ref', () => {
        const source: ValueSource<number> = { type: 'context', ref: 'response.data.id' };
        const context = { response: { data: { id: 42 } } };
        expect(resolveValue(source, context)).toBe(42);
    });

    it('throws descriptive error for missing context ref', () => {
        const source: ValueSource<string> = { type: 'context', ref: 'missing.path' };
        expect(() => resolveValue(source, { other: 1 })).toThrow('Cannot resolve context ref "missing.path"');
    });

    it('throws when traversing through a non-object', () => {
        const source: ValueSource<string> = { type: 'context', ref: 'a.b.c' };
        expect(() => resolveValue(source, { a: 'string' })).toThrow('Cannot resolve context ref "a.b.c"');
    });
});
