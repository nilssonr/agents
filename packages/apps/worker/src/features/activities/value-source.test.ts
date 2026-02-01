import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { resolveValue, valueSourceSchema, type ValueSource } from './value-source.js';

describe('valueSourceSchema', () => {
    it('accepts explicit literal form', () => {
        const schema = valueSourceSchema(z.string());
        const result = schema.parse({ type: 'literal', value: 'hello' });
        expect(result).toEqual({ type: 'literal', value: 'hello' });
    });

    it('accepts explicit context form', () => {
        const schema = valueSourceSchema(z.string());
        const result = schema.parse({ type: 'context', ref: 'foo.bar' });
        expect(result).toEqual({ type: 'context', ref: 'foo.bar' });
    });

    it('coerces plain string to literal form', () => {
        const schema = valueSourceSchema(z.string());
        const result = schema.parse('hello');
        expect(result).toEqual({ type: 'literal', value: 'hello' });
    });

    it('coerces plain number to literal form', () => {
        const schema = valueSourceSchema(z.number());
        const result = schema.parse(42);
        expect(result).toEqual({ type: 'literal', value: 42 });
    });

    it('coerces plain object to literal form when no type field', () => {
        const schema = valueSourceSchema(z.record(z.string()));
        const result = schema.parse({ foo: 'bar' });
        expect(result).toEqual({ type: 'literal', value: { foo: 'bar' } });
    });
});

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
