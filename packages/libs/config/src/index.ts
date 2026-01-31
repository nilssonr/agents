import { config } from 'dotenv';

config();

interface ConfigField {
    env: string;
    required?: boolean;
    default?: string;
}

export type ConfigSchema<T extends Record<string, ConfigField>> = T;

type ConfigResult<T extends Record<string, ConfigField>> = {
    [K in keyof T]: string;
};

export function loadConfig<T extends Record<string, ConfigField>>(schema: ConfigSchema<T>): ConfigResult<T> {
    const result: Record<string, string> = {};
    const missing: string[] = [];

    for (const [key, field] of Object.entries(schema)) {
        const value = process.env[field.env];

        if (value !== undefined && value !== '') {
            result[key] = value;
        } else if (field.default !== undefined) {
            result[key] = field.default;
        } else if (field.required !== false) {
            missing.push(field.env);
        }
    }

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return result as ConfigResult<T>;
}
