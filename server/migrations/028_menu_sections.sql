-- Migration 028: menu section support
-- Adds a section label without altering existing menu item IDs.
-- Apply only after previous migrations have been reviewed.

ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS section_name VARCHAR(100) NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_section
ON public.menu_items(category_id, section_name);
