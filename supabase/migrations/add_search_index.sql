ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(file_name, '') || ' ' ||
      coalesce(doc_type, '') || ' ' ||
      coalesce(extracted_name, '') || ' ' ||
      coalesce(extracted_doc_number, '')
    )
  ) STORED;
CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING GIN(search_vector);
