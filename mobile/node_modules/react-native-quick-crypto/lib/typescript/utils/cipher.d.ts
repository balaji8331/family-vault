import type { Encoding } from './types';
export declare function setDefaultEncoding(encoding: Encoding): void;
export declare function getDefaultEncoding(): Encoding;
export declare function normalizeEncoding(enc: string): "ascii" | "utf8" | "utf16le" | "base64" | "latin1" | "hex" | undefined;
export declare function validateEncoding(data: string, encoding: string): void;
/**
 * Reads an unsigned-integer option from an options-like object.
 *
 * Returns `undefined` if the option is missing, `null`, or `undefined`.
 * Throws `RangeError` if the value is present but not a non-negative
 * 32-bit integer (NaN, Infinity, fractional, negative, or > 2^32 - 1).
 *
 * Replaces the previous `Record<string, any>` + sentinel-`-1` signature,
 * which defeated the type checker (audit Phase 1.4). Callers that used
 * `getUIntOption(opts ?? {}, key) !== -1 ? getUIntOption(...) : default`
 * collapse to `getUIntOption(opts, key) ?? default`.
 */
export declare function getUIntOption(options: Readonly<Record<string, unknown>> | undefined, key: string): number | undefined;
//# sourceMappingURL=cipher.d.ts.map