import crypto from 'crypto';
const webcrypto = crypto.webcrypto;

const PBKDF2_ALGORITHM = "PBKDF2";
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_HASH = "SHA-256";
const AES_GCM_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: PBKDF2_ALGORITHM },
    false,
    ["deriveBits", "deriveKey"]
  );

  return webcrypto.subtle.deriveKey(
    {
      name: PBKDF2_ALGORITHM,
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

async function main() {
  const enc = new TextEncoder();
  const salt = enc.encode('user_123');
  
  // Setup: create a master key from correct password
  const masterKey1 = await deriveKeyFromPassword('password123', salt);
  
  // Create a dummy document key to wrap
  const docKey = await webcrypto.subtle.generateKey(
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  
  // Wrap it with masterKey1
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await webcrypto.subtle.wrapKey(
    "raw",
    docKey,
    masterKey1,
    { name: AES_GCM_ALGORITHM, iv: iv }
  );
  
  // Combine IV and wrapped key
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), iv.length);
  const wrappedKeyBuffer = combined.buffer;
  
  // Now try to unwrap with a DIFFERENT master key!
  const masterKey2 = await deriveKeyFromPassword('wrong_password', salt);
  
  try {
    const data = new Uint8Array(wrappedKeyBuffer);
    const extractIv = data.slice(0, IV_LENGTH);
    const extractWrappedKey = data.slice(IV_LENGTH);

    await webcrypto.subtle.unwrapKey(
      "raw",
      extractWrappedKey,
      masterKey2,
      { name: AES_GCM_ALGORITHM, iv: extractIv },
      { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
    console.log("SUCCESS! Unwrapped with wrong password?!");
  } catch (err) {
    console.log("FAILED to unwrap with wrong password:", err.name, err.message);
  }
}

main();
