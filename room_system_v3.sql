-- =========================================================================
-- EGNA CHATTRUM V3: SKAPA, DÖPA OM OCH SJÄLVDESTRUKTION
-- =========================================================================

-- 1. Funktion för att skapa rum med begränsning (max 2 per person)
CREATE OR REPLACE FUNCTION public.create_chat_room(p_name text, p_is_secret boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_id uuid;
  room_count int;
BEGIN
  -- Räkna hur många rum användaren redan har skapat
  SELECT COUNT(*) INTO room_count FROM public.chat_rooms WHERE created_by = auth.uid();
  
  IF room_count >= 2 THEN
    RAISE EXCEPTION 'DUPLICATE_LIMIT_REACHED: Du kan max skapa 2 egna chattrum.';
  END IF;

  -- Skapa rummet
  INSERT INTO public.chat_rooms (name, created_by, is_secret, allowed_users)
  VALUES (p_name, auth.uid(), p_is_secret, ARRAY[auth.uid()])
  RETURNING id INTO room_id;
  
  RETURN room_id;
END;
$$;

-- 2. Uppdatera RLS för att tillåta ägare att hantera sina egna rum (UPDATE & DELETE)
DROP POLICY IF EXISTS "Owners can manage their rooms" ON public.chat_rooms;
CREATE POLICY "Owners can manage their rooms" ON public.chat_rooms 
  FOR ALL USING (
    created_by = auth.uid()
  );

-- 3. Säkerställ att Admin fortfarande kan hantera allt (från v2 scriptet)
DROP POLICY IF EXISTS "Admins can manage chat_rooms" ON public.chat_rooms;
CREATE POLICY "Admins can manage chat_rooms" ON public.chat_rooms 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_rooms = true) OR 
    auth.email() = 'apersson508@gmail.com'
  );
