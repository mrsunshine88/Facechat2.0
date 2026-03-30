-- SOFT DELETE SYSTEM FOR SUPPORT TICKETS
-- Adds independent deletion flags for admins and users

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_deleted BOOLEAN DEFAULT false;

-- Migrate existing 'hidden' status (which was used for admin deletion) to the new flag
UPDATE public.support_tickets 
SET admin_deleted = true, status = 'closed'
WHERE status = 'hidden';
