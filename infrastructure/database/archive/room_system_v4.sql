-- =========================================================================
-- EGNA CHATTRUM V4: ADMIN-RUM OCH SJÄLVDESTRUKTION-FUNKTIONER
-- =========================================================================

-- 1. Funktion för att lämna ett rum (och radera det om det blir tomt)
CREATE OR REPLACE FUNCTION public.leave_chat_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_allowed uuid[];
  v_is_secret boolean;
  v_member_count int;
BEGIN
  -- Hämta rummets nuvarande medlemmar
  SELECT allowed_users, is_secret INTO current_allowed, v_is_secret 
  FROM public.chat_rooms 
  WHERE id = p_room_id;

  -- Ta bort användaren från listan
  current_allowed := array_remove(current_allowed, auth.uid());

  -- Räkna kvarvarande medlemmar
  v_member_count := array_length(current_allowed, 1);

  IF v_member_count IS NULL OR v_member_count = 0 THEN
    -- Om rummet är privat och tomt, radera det (självdestruktion)
    IF v_is_secret THEN
      DELETE FROM public.chat_rooms WHERE id = p_room_id;
    ELSE
      -- För publika rum, bara nolla listan (fast publika rum använder normalt inte allowed_users)
      UPDATE public.chat_rooms SET allowed_users = '{}' WHERE id = p_room_id;
    END IF;
  ELSE
    -- Uppdatera listan
    UPDATE public.chat_rooms SET allowed_users = current_allowed WHERE id = p_room_id;
  END IF;
END;
$$;

-- 2. Uppdatera RLS för att ge ALLA ADMINS tillgång till "Admin"-rummet
-- Även om de inte har perm_rooms (redigera chattrum) behörighet än.
DROP POLICY IF EXISTS "Admins see Admin room" ON public.chat_rooms;
CREATE POLICY "Admins see Admin room" ON public.chat_rooms
  FOR SELECT USING (
    is_secret = true AND name = 'Admin' AND (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_rooms = true)) OR
      auth.email() = 'apersson508@gmail.com'
    )
  );

-- 3. Tillåt admins att skriva i Admin-rummet (för meddelanden)
DROP POLICY IF EXISTS "Admins can post in Admin room" ON public.chat_messages;
CREATE POLICY "Admins can post in Admin room" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_rooms r
      WHERE r.id = room_id AND r.name = 'Admin' AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_rooms = true)) OR
        auth.email() = 'apersson508@gmail.com'
      )
    )
  );

-- 4. Säkerställ att vanliga användare fortfarande kan se publika rum och rum de är inbjudna till
DROP POLICY IF EXISTS "Users can see allowed rooms" ON public.chat_rooms;
CREATE POLICY "Users can see allowed rooms" ON public.chat_rooms
  FOR SELECT USING (
    is_secret = false OR 
    is_secret IS NULL OR 
    allowed_users @> ARRAY[auth.uid()]
  );
