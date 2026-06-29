-- Add family_code to families table
ALTER TABLE families ADD COLUMN IF NOT EXISTS family_code text UNIQUE;
ALTER TABLE families ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE families ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- Generate unique 8-char codes for existing families
UPDATE families
SET family_code = 'VAULT-' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 4))
WHERE family_code IS NULL;

-- Function to auto-generate family code on insert
CREATE OR REPLACE FUNCTION generate_family_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.family_code IS NULL THEN
    NEW.family_code := 'VAULT-' || UPPER(SUBSTRING(MD5(RANDOM()::text), 1, 4));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_family_code
  BEFORE INSERT ON families
  FOR EACH ROW EXECUTE FUNCTION generate_family_code();
