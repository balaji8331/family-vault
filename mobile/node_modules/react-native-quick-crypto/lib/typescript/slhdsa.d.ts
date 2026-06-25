import type { SlhDsaKeyPair } from './specs/slhDsaKeyPair.nitro';
import type { CryptoKeyPair, KeyUsage, SlhDsaAlgorithm } from './utils';
export type SlhDsaVariant = SlhDsaAlgorithm;
export declare const SLH_DSA_VARIANTS: readonly SlhDsaVariant[];
export declare class SlhDsa {
    variant: SlhDsaVariant;
    native: SlhDsaKeyPair;
    constructor(variant: SlhDsaVariant);
    generateKeyPair(): Promise<void>;
    generateKeyPairSync(): void;
    getPublicKey(): ArrayBuffer;
    getPrivateKey(): ArrayBuffer;
    sign(message: ArrayBuffer): Promise<ArrayBuffer>;
    signSync(message: ArrayBuffer): ArrayBuffer;
    verify(signature: ArrayBuffer, message: ArrayBuffer): Promise<boolean>;
    verifySync(signature: ArrayBuffer, message: ArrayBuffer): boolean;
}
export declare function slhdsa_generateKeyPairWebCrypto(variant: SlhDsaVariant, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKeyPair>;
//# sourceMappingURL=slhdsa.d.ts.map