-- Add notify_enabled column to documents table with default true
ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT true;
