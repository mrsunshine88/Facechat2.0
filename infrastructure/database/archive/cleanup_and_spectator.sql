-- =========================================================================
-- CLEANUP: TA BORT GAMLA VÄNCHATTEN OCH FÖRBERED FÖR SPECTATOR MODE
-- =========================================================================

-- 1. Ta bort den gamla ofullständiga vän-chatten
DELETE FROM public.chat_rooms 
WHERE name = 'Vän-Chatten (Bara Vänner)';

-- 2. Ta bort kolumnen is_friends_only eftersom den skapade logiska problem
ALTER TABLE public.chat_rooms 
DROP COLUMN IF EXISTS is_friends_only;

-- 3. Säkerställ att Administratörer har rätt behörigheter
-- (Detta kördes i update_schema.sql men är bra som säkerhet)
UPDATE public.profiles 
SET perm_rooms = true, is_admin = true
WHERE username = 'mrsunshine88';
