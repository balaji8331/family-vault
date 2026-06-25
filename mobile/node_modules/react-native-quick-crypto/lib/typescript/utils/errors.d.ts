type DOMName = string | {
    name: string;
    cause: unknown;
};
declare class FallbackDOMException extends Error {
    readonly code: number;
    constructor(message: string, name: string);
}
export declare function lazyDOMException(message: string, domName: DOMName): Error;
export declare class QuotaExceededError extends FallbackDOMException {
    readonly quota: number | null;
    readonly requested: number | null;
    constructor(message: string, options?: {
        quota?: number;
        requested?: number;
    });
}
export {};
//# sourceMappingURL=errors.d.ts.map