-- =====================================================
-- MIGRATION: Add Nuvemshop support to integrations table
-- =====================================================
-- Update the platform check constraint to include 'nuvemshop'
-- =====================================================

-- Update the check constraint on integrations table to include nuvemshop
ALTER TABLE integrations
  DROP CONSTRAINT IF EXISTS integrations_platform_check;

ALTER TABLE integrations
  ADD CONSTRAINT integrations_platform_check
  CHECK (platform IN ('shopify', 'woocommerce', 'mercadolivre', 'nuvemshop'));