import { type CryptoKeyPair, type GenerateKeyPairCallback, type GenerateKeyPairOptions, type GenerateKeyPairPromiseReturn, type KeyPairType } from '../utils';
import { type PublicKeyObject, type PrivateKeyObject } from './classes';
export declare const generateKeyPair: (type: KeyPairType, options: GenerateKeyPairOptions, callback: GenerateKeyPairCallback) => void;
export declare const generateKeyPairPromise: (type: KeyPairType, options: GenerateKeyPairOptions) => Promise<GenerateKeyPairPromiseReturn>;
export type KeyObjectKeyPair = {
    publicKey: PublicKeyObject;
    privateKey: PrivateKeyObject;
};
type KeyObjectGenerateKeyPairOptions = Omit<GenerateKeyPairOptions, 'publicKeyEncoding' | 'privateKeyEncoding'> & {
    publicKeyEncoding?: undefined;
    privateKeyEncoding?: undefined;
};
export declare function generateKeyPairSync(type: KeyPairType): KeyObjectKeyPair;
export declare function generateKeyPairSync(type: KeyPairType, options: KeyObjectGenerateKeyPairOptions): KeyObjectKeyPair;
export declare function generateKeyPairSync(type: KeyPairType, options: GenerateKeyPairOptions): CryptoKeyPair;
export {};
//# sourceMappingURL=generateKeyPair.d.ts.map