-- Add key_seed to families: the per-family secret from which every member locally
-- derives the ONE shared family key (see lib/crypto.ts deriveFamilyKey / lib/keys.ts
-- loadFamilyKey). Previously the family key was minted per-user and random, so members
-- had different keys and cross-member document sharing could never be decrypted.
--
-- The seed is 256 bits of entropy, base64-encoded. Existing families are backfilled with
-- a freshly generated seed. NOTE: documents shared under the old (broken) per-user key
-- scheme cannot be recovered by the new derivation — only new shares will decrypt.

ALTER TABLE families ADD COLUMN IF NOT EXISTS key_seed text;

-- Backfill any existing families that predate this column.
UPDATE families
SET key_seed = encode(gen_random_bytes(32), 'base64')
WHERE key_seed IS NULL;
