-- Migration: Cleanup Archived Loans
-- ID: 162
-- Description: Permanently deletes loans with 'archivado' status. 
-- Business Rule: Loans with no payments must be DELETED, not ARCHIVED. 
-- 'Archived' status is only for cascading actions (e.g. Admin/Cartera archive), not individual loans.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM creditos WHERE estado = 'archivado' LOOP
        -- Delete amortizations first (safety, although cascade might handle it)
        DELETE FROM amortizaciones WHERE credito_id = r.id;
        
        -- Delete the credit
        DELETE FROM creditos WHERE id = r.id;
    END LOOP;
END $$;
