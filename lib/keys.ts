import { useVaultStore } from '@/store/vault.store'
import { deriveKeyFromPassword, deriveFamilyKey, generateDocumentKey, wrapKey, unwrapKey } from '@/lib/crypto'
import { supabase } from '@/lib/supabase/client'

/**
 * Helper to convert an ArrayBuffer to a Base64 string for database storage.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert a Base64 string back to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a 256-bit AES-GCM master key from the user's password using PBKDF2.
 * The salt is deterministically derived from the user's ID so it requires no storage.
 * 
 * @param password The user's master password
 * @param userId The user's unique ID
 * @returns The derived CryptoKey
 */
export async function initializeMasterKey(password: string, userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const salt = enc.encode(userId)
  
  const masterKey = await deriveKeyFromPassword(password, salt)
  useVaultStore.getState().setMasterKey(masterKey)
  
  return masterKey
}

/**
 * Checks if the user has already set up their master password by checking for a validation key.
 */
export async function hasMasterValidationKey(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('encryption_keys')
    .select('id')
    .eq('key_type', 'personal')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error('Failed to check master validation: ' + error.message)
  }

  return !!data
}

/**
 * Sets up the master password by generating a dummy validation key and wrapping it.
 */
export async function setupMasterPassword(userId: string, masterKey: CryptoKey): Promise<void> {
  const validationKey = await generateDocumentKey()
  const wrappedKeyBuffer = await wrapKey(validationKey, masterKey)
  const wrappedKeyBase64 = arrayBufferToBase64(wrappedKeyBuffer)

  const { error } = await supabase
    .from('encryption_keys')
    .insert({
      key_type: 'personal',
      user_id: userId,
      encrypted_key: wrappedKeyBase64
    })

  if (error) {
    throw new Error('Failed to save master validation key: ' + error.message)
  }
}

/**
 * Verifies the master password by attempting to unwrap the validation key.
 */
export async function verifyMasterPassword(userId: string, masterKey: CryptoKey): Promise<void> {
  const { data, error } = await supabase
    .from('encryption_keys')
    .select('encrypted_key')
    .eq('key_type', 'personal')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data || !data.encrypted_key) {
    throw new Error('Master validation key not found. Please set up your vault first.')
  }

  try {
    const wrappedKeyBuffer = base64ToArrayBuffer(data.encrypted_key)
    await unwrapKey(wrappedKeyBuffer, masterKey)
  } catch (err) {
    throw new Error('Incorrect master password.')
  }
}

/**
 * Loads the ONE shared family key for a family by deriving it from the family's
 * secret `key_seed`. Every member derives the identical key, so a document key
 * wrapped with the family key by one member can be unwrapped by any other member.
 *
 * This replaces the previous per-user scheme, which minted a *different* random key
 * for each user and therefore made cross-member sharing impossible to decrypt.
 *
 * @param familyId The family group ID
 * @returns The shared family CryptoKey
 */
export async function loadFamilyKey(familyId: string): Promise<CryptoKey> {
  const { data: family, error } = await supabase
    .from('families')
    .select('key_seed')
    .eq('id', familyId)
    .single()

  if (error || !family?.key_seed) {
    throw new Error('Failed to load family key material: ' + (error?.message ?? 'no key_seed on family'))
  }

  const familyKey = await deriveFamilyKey(family.key_seed, familyId)
  useVaultStore.getState().setFamilyKey(familyKey)
  return familyKey
}

/**
 * Clears the in-memory keys and session data.
 */
export function clearKeys(): void {
  useVaultStore.getState().clearSession()
}
