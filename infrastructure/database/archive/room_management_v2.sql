-- =========================================================================
-- RUMSHANTERING V2: INVITE, LEAVE & KICK (MED NOTIFIKATIONER)
-- =========================================================================

-- 1. Säkerställ RPC för att lämna rum (Security Definer så användare kan uppdatera sin egen närvaro)
CREATE OR REPLACE FUNCTION public.leave_chat_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET allowed_users = array_remove(allowed_users, auth.uid())
  WHERE id = p_room_id;
END;
$$;

-- 2. Uppdatera RLS för chat_rooms så ägare och admins kan hantera rummet
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage chat_rooms" ON public.chat_rooms;
CREATE POLICY "Admins can manage chat_rooms" ON public.chat_rooms 
  FOR UPDATE USING (
    created_by = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_rooms = true) OR 
    auth.email() = 'apersson508@gmail.com'
  );

-- 3. Säkerställ att allowed_users aldrig är null
UPDATE public.chat_rooms SET allowed_users = '{}' WHERE allowed_users IS NULL;
ALTER TABLE public.chat_rooms ALTER COLUMN allowed_users SET DEFAULT '{}';
ALTER TABLE public.chat_rooms ALTER COLUMN allowed_users SET NOT NULL;
