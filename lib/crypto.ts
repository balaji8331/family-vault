/**
 * Utility functions for zero-knowledge encryption using the Web Crypto API.
 * Uses AES-256-GCM for encryption and PBKDF2 for key derivation.
 */

const AES_GCM_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const PBKDF2_ALGORITHM = "PBKDF2";
const PBKDF2_ITERATIONS = 310000; // Updated to 310,000 iterations for secure key derivation
const PBKDF2_HASH = "SHA-256";
const IV_LENGTH = 12; // Standard IV length for AES-GCM

/**
 * Derives an AES-256-GCM key from a user password and a salt using PBKDF2.
 * 
 * @param password The user's password.
 * @param salt A cryptographic salt (e.g., a random Uint8Array).
 * @returns A promise that resolves to the derived CryptoKey.
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: PBKDF2_ALGORITHM },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: PBKDF2_ALGORITHM,
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true, // Extractable so it can be used for wrapping/unwrapping document keys
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

/**
 * Derives the ONE shared family AES-256-GCM key from a family's secret `key_seed`.
 *
 * All members of a family derive the identical key from the same server-stored
 * `key_seed` (a random 256-bit secret on the `families` row), so a document key
 * wrapped with the family key by one member can be unwrapped by any other member.
 * The salt is derived from the familyId, so it needs no separate storage.
 *
 * NOTE ON TRADE-OFF: because the key is derived from a server-stored seed rather
 * than wrapped with each member's master key, the server *could* in principle
 * derive the family key. This is a deliberate, pragmatic choice: the system has no
 * asymmetric-key infrastructure, and this is the only scheme that lets a member who
 * joins later derive the shared key locally with no admin-online re-wrap step. The
 * per-member envelope alternative (true zero-knowledge) is a larger follow-up.
 *
 * @param keySeed The family's secret seed (base64), from `families.key_seed`.
 * @param familyId The family group ID, used to derive the salt.
 * @returns The shared family CryptoKey (usable for wrap/unwrap/encrypt/decrypt).
 */
export async function deriveFamilyKey(keySeed: string, familyId: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = enc.encode(`family:${familyId}`);
  return deriveKeyFromPassword(keySeed, salt);
}

/**
 * Encrypts file data using AES-256-GCM.
 * 
 * @param file The file to be encrypted.
 * @param key The AES-256-GCM CryptoKey.
 * @returns A promise that resolves to an object containing the encrypted data and the IV used.
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer; iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const fileData = await file.arrayBuffer(); // Extract ArrayBuffer from File object
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: iv,
    },
    key,
    fileData
  );
  return { encryptedData, iv };
}

/**
 * Decrypts file data using AES-256-GCM.
 * 
 * @param encryptedData The encrypted file data as an ArrayBuffer.
 * @param iv The initialization vector used during encryption.
 * @param key The AES-256-GCM CryptoKey.
 * @returns A promise that resolves to the decrypted ArrayBuffer.
 */
export async function decryptFile(encryptedData: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: iv as unknown as BufferSource,
    },
    key,
    encryptedData
  );
}

/**
 * Generates a new random AES-256-GCM key for encrypting a document.
 * 
 * @returns A promise that resolves to the generated CryptoKey.
 */
export async function generateDocumentKey(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: AES_GCM_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    true, // Must be extractable so it can be wrapped and shared or exported
    ["encrypt", "decrypt"]
  );
}

/**
 * Wraps a document key using another key (e.g., a user's derived key or a family admin key).
 * The IV used for wrapping is prepended to the resulting ArrayBuffer.
 * 
 * @param keyToWrap The key to be shared (e.g., a document key).
 * @param wrappingKey The key used to encrypt the keyToWrap.
 * @returns A promise that resolves to the wrapped key data (with prepended IV) as an ArrayBuffer.
 */
export async function wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await window.crypto.subtle.wrapKey(
    "raw", // We use "raw" export format for AES keys
    keyToWrap,
    wrappingKey,
    {
      name: AES_GCM_ALGORITHM,
      iv: iv,
    }
  );

  // Combine IV and wrapped key into a single ArrayBuffer for easy storage
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), iv.length);
  
  return combined.buffer;
}

/**
 * Unwraps a shared document key using the receiver's key.
 * Assumes the IV is prepended to the wrapped key data.
 * 
 * @param wrappedKeyBuffer The wrapped key data with prepended IV.
 * @param unwrappingKey The key used to decrypt the wrapped key.
 * @returns A promise that resolves to the unwrapped CryptoKey.
 */
export async function unwrapKey(wrappedKeyBuffer: ArrayBuffer, unwrappingKey: CryptoKey): Promise<CryptoKey> {
  const data = new Uint8Array(wrappedKeyBuffer);
  const iv = data.slice(0, IV_LENGTH);
  const wrappedKey = data.slice(IV_LENGTH);

  return window.crypto.subtle.unwrapKey(
    "raw", // The format we used to wrap it
    wrappedKey,
    unwrappingKey,
    {
      name: AES_GCM_ALGORITHM,
      iv: iv,
    },
    {
      name: AES_GCM_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    true, // Make it extractable in case it needs to be exported or re-wrapped
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey to a raw ArrayBuffer.
 * Useful for storing a key locally in memory or IndexedDB if required.
 * 
 * @param key The CryptoKey to export.
 * @returns A promise that resolves to the raw key data as an ArrayBuffer.
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.exportKey("raw", key);
}

/**
 * Imports a raw ArrayBuffer into a CryptoKey for AES-256-GCM.
 * 
 * @param keyData The raw key data as an ArrayBuffer.
 * @returns A promise that resolves to the imported CryptoKey.
 */
export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: AES_GCM_ALGORITHM },
    true, // Make extractable
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"] // Add appropriate usages
  );
}
