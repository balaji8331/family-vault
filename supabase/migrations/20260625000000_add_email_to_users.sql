ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;

-- Backfill emails from auth.users (if any exist)
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND u.email IS NULL;
