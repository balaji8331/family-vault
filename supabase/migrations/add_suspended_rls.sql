-- Add RLS policy to block suspended families on documents
CREATE POLICY "block suspended families documents" ON documents 
  FOR ALL USING (
    NOT EXISTS (SELECT 1 FROM families WHERE id = family_id AND suspended = true)
  );

-- Add RLS policy to block suspended families on document_access
CREATE POLICY "block suspended families access" ON document_access 
  FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM users 
      JOIN families ON users.family_id = families.id 
      WHERE users.id = document_access.granted_to AND families.suspended = true
    )
  );

-- Add RLS policy to block suspended families on encryption_keys
CREATE POLICY "block suspended families keys" ON encryption_keys 
  FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM users 
      JOIN families ON users.family_id = families.id 
      WHERE users.id = encryption_keys.user_id AND families.suspended = true
    )
  );
