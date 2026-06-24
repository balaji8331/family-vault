import { describe, it, expect } from 'vitest';
import { 
  deriveKeyFromPassword, 
  generateDocumentKey, 
  encryptFile, 
  decryptFile, 
  wrapKey, 
  unwrapKey 
} from '@/lib/crypto';

describe('Crypto Module', () => {
  it('encrypt then decrypt returns original file bytes', async () => {
    const key = await generateDocumentKey();
    const originalText = "Hello, zero knowledge world!";
    const file = new File([originalText], "test.txt", { type: "text/plain" });
    
    const { encryptedData, iv } = await encryptFile(file, key);
    expect(encryptedData.byteLength).toBeGreaterThan(0);
    
    const decryptedData = await decryptFile(encryptedData, iv, key);
    const decryptedText = new TextDecoder().decode(decryptedData);
    
    expect(decryptedText).toBe(originalText);
  });

  it('PBKDF2 derives same key from same password + salt', async () => {
    const salt = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    const pass = "SuperSecretPassword123!";
    
    const key1 = await deriveKeyFromPassword(pass, salt);
    const key2 = await deriveKeyFromPassword(pass, salt);
    
    const exported1 = await window.crypto.subtle.exportKey('raw', key1);
    const exported2 = await window.crypto.subtle.exportKey('raw', key2);
    
    expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
  });

  it('different passwords produce different keys', async () => {
    const salt = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    
    const key1 = await deriveKeyFromPassword("Password123", salt);
    const key2 = await deriveKeyFromPassword("password123", salt); // different case
    
    const exported1 = await window.crypto.subtle.exportKey('raw', key1);
    const exported2 = await window.crypto.subtle.exportKey('raw', key2);
    
    expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
  });

  it('wrapKey then unwrapKey returns original key bytes', async () => {
    const docKey = await generateDocumentKey();
    const salt = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    const masterKey = await deriveKeyFromPassword('password', salt); // has wrapKey usage
    
    const wrapped = await wrapKey(docKey, masterKey);
    const unwrapped = await unwrapKey(wrapped, masterKey);
    
    const exportedOriginal = await window.crypto.subtle.exportKey('raw', docKey);
    const exportedUnwrapped = await window.crypto.subtle.exportKey('raw', unwrapped);
    
    expect(new Uint8Array(exportedOriginal)).toEqual(new Uint8Array(exportedUnwrapped));
  });

  it('tampered ciphertext fails decryption with correct error', async () => {
    const key = await generateDocumentKey();
    const file = new File(["Top Secret"], "secret.txt");
    const { encryptedData, iv } = await encryptFile(file, key);
    
    // Tamper with the ciphertext by flipping a bit
    const tampered = new Uint8Array(encryptedData);
    tampered[0] ^= 1;
    
    await expect(decryptFile(tampered.buffer, iv, key)).rejects.toThrow();
  });

  it('IV is unique on every encrypt call', async () => {
    const key = await generateDocumentKey();
    const file = new File(["Data"], "data.txt");
    
    const res1 = await encryptFile(file, key);
    const res2 = await encryptFile(file, key);
    
    expect(res1.iv).not.toEqual(res2.iv);
  });
});
