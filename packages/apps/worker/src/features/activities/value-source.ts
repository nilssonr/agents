import { z, type ZodTypeAny } from 'zod';

/** A value that is either provided literally or resolved from flow context via a dot-path reference. */
export type ValueSource<T> = { type: 'literal'; value: T } | { type: 'context'; ref: string };

/**
 * Creates a Zod schema for a {@link ValueSource} whose literal branch validates against `innerSchema`.
 */
export function valueSourceSchema<T extends ZodTypeAny>(innerSchema: T) {
    return z.discriminatedUnion('type', [
        z.object({ type: z.literal('literal'), value: innerSchema }),
        z.object({ type: z.literal('context'), ref: z.string() }),
    ]);
}

/**
 * Resolves a {@link ValueSource} against a flow context object.
 *
 * - Literal sources return the value directly.
 * - Context sources perform a dot-path lookup (e.g. `"response.data.id"`) on the context.
 *
 * @throws {Error} If the context ref path cannot be resolved.
 */
export function resolveValue<T>(source: ValueSource<T>, context: unknown): T {
    if (source.type === 'literal') {
        return source.value;
    }

    const parts = source.ref.split('.');
    let current: unknown = context;

    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            throw new Error(
                `Cannot resolve context ref "${source.ref}": "${part}" is not accessible on ${JSON.stringify(current)}`,
            );
        }
        current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
        throw new Error(`Cannot resolve context ref "${source.ref}": value is undefined`);
    }

    return current as T;
}
