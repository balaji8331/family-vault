import type { BinaryLike, BufferLike, JWK, KeyUsage } from './types';
export declare function validateFunction(f: unknown): boolean;
export declare function isStringOrBuffer(val: unknown): val is string | ArrayBuffer;
export declare function validateObject<T>(value: unknown, name: string, options?: {
    allowArray: boolean;
    allowFunction: boolean;
    nullable: boolean;
} | null): value is T;
export declare const validateMaxBufferLength: (data: BinaryLike | BufferLike, name: string) => void;
export declare const getUsagesUnion: (usageSet: KeyUsage[], ...usages: KeyUsage[]) => KeyUsage[];
export declare function getSortedUsages(usages: KeyUsage[]): KeyUsage[];
export declare const validateKeyOps: (keyOps: KeyUsage[] | undefined, usagesSet: KeyUsage[]) => void;
export declare function validateJwkStructure(jwk: JWK, extractable: boolean, keyUsages: KeyUsage[], expectedUse: 'sig' | 'enc'): void;
export declare function hasAnyNotIn(set: string[], checks: string[]): boolean;
//# sourceMappingURL=validation.d.ts.map