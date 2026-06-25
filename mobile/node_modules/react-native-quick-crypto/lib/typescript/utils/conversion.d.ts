import { Buffer as CraftzdogBuffer } from '@craftzdog/react-native-buffer';
import { Buffer as SafeBuffer } from 'safe-buffer';
import type { ABV, BinaryLikeNode, BufferLike } from './types';
export declare function rejectSharedArrayBuffer(buf: unknown): void;
/**
 * Returns the underlying ArrayBuffer of a Buffer / TypedArray view **without
 * copying**, ignoring `byteOffset`/`byteLength`. The full backing storage is
 * exposed.
 *
 * Only use this when the caller separately tracks `byteOffset`/`byteLength`
 * and the native receiver needs to write back into the original memory
 * (e.g. `randomFill`). For data that will be read by native crypto, use
 * `binaryLikeToArrayBuffer`/`toArrayBuffer` instead — those return only the
 * view's region and won't leak unrelated bytes from the backing buffer.
 */
export declare const abvToArrayBuffer: (buf: ABV) => ArrayBuffer;
/**
 * Converts supplied argument to an ArrayBuffer. Note this copies data
 * only when the supplied view represents a subrange of the underlying
 * ArrayBuffer; otherwise the backing buffer is returned directly
 * (aliased — do not mutate after passing).
 * @param buf
 * @returns ArrayBuffer
 */
export declare function toArrayBuffer(buf: CraftzdogBuffer | SafeBuffer | ArrayBufferView): ArrayBuffer;
export declare function bufferLikeToArrayBuffer(buf: BufferLike): ArrayBuffer;
export declare function binaryLikeToArrayBuffer(input: BinaryLikeNode, // CipherKey adds compat with node types
encoding?: string): ArrayBuffer;
export declare function ab2str(buf: ArrayBuffer, encoding?: string, start?: number, end?: number): string;
/** Native C++ buffer-to-string with arguments normalization*/
export declare function bufferToString(buf: ArrayBuffer, encoding?: string, start?: number, end?: number): string;
/** Native C++ string-to-buffer — exposed for benchmarking */
export declare function stringToBuffer(str: string, encoding?: string): ArrayBuffer;
export declare const kEmptyObject: any;
export * from './noble';
//# sourceMappingURL=conversion.d.ts.map