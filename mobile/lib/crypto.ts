import QuickCrypto from 'react-native-quick-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

export async function encryptFile(fileUri: string, keyBuffer: ArrayBuffer): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }> {
  const fileContentBase64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  const fileBuffer = Buffer.from(fileContentBase64, 'base64');
  
  const iv = QuickCrypto.randomBytes(12);
  const cipher = QuickCrypto.createCipheriv('aes-256-gcm', Buffer.from(keyBuffer), iv);
  
  const encrypted1 = cipher.update(fileBuffer);
  const encrypted2 = cipher.final();
  const authTag = cipher.getAuthTag();
  
  const finalBuffer = Buffer.concat([encrypted1, encrypted2, authTag]);
  
  return {
    encryptedData: new Uint8Array(finalBuffer),
    iv: new Uint8Array(iv)
  };
}

export async function decryptFile(encryptedData: Uint8Array, iv: Uint8Array, keyBuffer: ArrayBuffer): Promise<Uint8Array> {
  const dataBuf = Buffer.from(encryptedData);
  const authTagLength = 16;
  const ciphertext = dataBuf.slice(0, dataBuf.length - authTagLength);
  const authTag = dataBuf.slice(dataBuf.length - authTagLength);
  
  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', Buffer.from(keyBuffer), Buffer.from(iv));
  // The `buffer` polyfill's Buffer type is structurally incompatible with the Node Buffer
  // type QuickCrypto declares; both are valid Buffers at runtime. Cast at the boundary.
  decipher.setAuthTag(authTag as any);

  const decrypted1 = decipher.update(ciphertext as any);
  const decrypted2 = decipher.final();
  
  return new Uint8Array(Buffer.concat([decrypted1, decrypted2]));
}

export async function deriveKeyPBKDF2(passphrase: string, salt: Uint8Array): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    QuickCrypto.pbkdf2(passphrase, Buffer.from(salt), 100000, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.buffer);
    });
  });
}

// Helpers to simulate CryptoKey if needed by the app state
export function unwrapKeyMobile(wrappedKeyBuffer: ArrayBuffer, masterKeyBuffer: ArrayBuffer): ArrayBuffer {
  // Simple AES-GCM unwrap
  const wrappedBuf = Buffer.from(wrappedKeyBuffer);
  const iv = wrappedBuf.slice(0, 12);
  const ciphertext = wrappedBuf.slice(12, wrappedBuf.length - 16);
  const authTag = wrappedBuf.slice(wrappedBuf.length - 16);
  
  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', Buffer.from(masterKeyBuffer), iv);
  decipher.setAuthTag(authTag as any);
  const d1 = decipher.update(ciphertext as any);
  const d2 = decipher.final();
  return Buffer.concat([d1, d2]).buffer;
}
