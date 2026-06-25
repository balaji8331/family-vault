import { useVaultStore } from '@/store/vault.store'
import { deriveKeyFromPassword, generateDocumentKey, wrapKey, unwrapKey } from '@/lib/crypto'
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
    .eq('key_type', 'master_validation')
    .eq('user_id', userId)
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
      key_type: 'master_validation',
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
    .eq('key_type', 'master_validation')
    .eq('user_id', userId)
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
 * Loads an existing family key from the database or creates a new one if it doesn't exist.
 * The family key is securely wrapped with the user's master key before storage.
 * 
 * @param userId The user's unique ID
 * @param familyId The family group ID
 * @param masterKey The user's master CryptoKey
 * @returns The unwrapped family CryptoKey
 */
export async function loadOrCreateFamilyKey(userId: string, familyId: string, masterKey: CryptoKey): Promise<CryptoKey> {
  const { data: existingKeyRow, error: fetchError } = await supabase
    .from('encryption_keys')
    .select('encrypted_key')
    .eq('key_type', 'family')
    .eq('user_id', userId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 indicates 0 rows returned, which is fine here.
    throw new Error('Failed to fetch family key: ' + fetchError.message)
  }

  if (existingKeyRow && existingKeyRow.encrypted_key) {
    // Unwrap the existing key using the newly derived master key
    const wrappedKeyBuffer = base64ToArrayBuffer(existingKeyRow.encrypted_key)
    const familyKey = await unwrapKey(wrappedKeyBuffer, masterKey)
    useVaultStore.getState().setFamilyKey(familyKey)
    return familyKey
  } else {
    // Generate a new family key from scratch
    const familyKey = await generateDocumentKey()
    const wrappedKeyBuffer = await wrapKey(familyKey, masterKey)
    const wrappedKeyBase64 = arrayBufferToBase64(wrappedKeyBuffer)

    const { error: insertError } = await supabase
      .from('encryption_keys')
      .insert({
        key_type: 'family',
        user_id: userId,
        // Assuming family_id mapping if schema expects it. If not, this is a generic implementation.
        family_id: familyId, 
        encrypted_key: wrappedKeyBase64
      })

    if (insertError) {
      throw new Error('Failed to store family key: ' + insertError.message)
    }

    useVaultStore.getState().setFamilyKey(familyKey)
    return familyKey
  }
}

/**
 * Clears the in-memory keys and session data.
 */
export function clearKeys(): void {
  useVaultStore.getState().clearSession()
}
