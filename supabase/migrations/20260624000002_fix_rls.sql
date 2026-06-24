-- Ensure proper RLS on document_access for sharing
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view access to their documents" ON document_access;
DROP POLICY IF EXISTS "Users can insert access for their documents" ON document_access;
DROP POLICY IF EXISTS "Users can delete access for their documents" ON document_access;

-- Owners and family admins can view access
CREATE POLICY "Users can view access to their documents" ON document_access
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE id = document_access.document_id 
    AND (owner_id = auth.uid() OR family_id = (SELECT family_id FROM users WHERE id = auth.uid() AND role IN ('family_admin', 'super_admin')))
  )
  OR
  granted_to = auth.uid()
);

-- Only owners can insert access (share)
CREATE POLICY "Users can insert access for their documents" ON document_access
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE id = document_access.document_id 
    AND owner_id = auth.uid()
  )
);

-- Owners and family admins can revoke (delete) access
CREATE POLICY "Users can delete access for their documents" ON document_access
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE id = document_access.document_id 
    AND (owner_id = auth.uid() OR family_id = (SELECT family_id FROM users WHERE id = auth.uid() AND role IN ('family_admin', 'super_admin')))
  )
);
