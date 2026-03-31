-- =========================================================================
-- FACECHAT 2.0 (LIVE) - MASTER SUPABASE SCHEMA (V2 - CLEAN INSTALL)
-- =========================================================================

-- Nollställ eventuella krockande tabeller för att få en 100% ren Facechat-installation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.whiteboard CASCADE;
DROP TABLE IF EXISTS public.private_messages CASCADE;
DROP TABLE IF EXISTS public.guestbook CASCADE;
DROP TABLE IF EXISTS public.friends CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. PROFILES SETTINGS & SECURITY (Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    city TEXT,
    status_icon TEXT DEFAULT 'star', -- star, coffee, moon, heart
    is_admin BOOLEAN DEFAULT false,
    sound_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy för Profiler
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id OR auth.email() = 'apersson508@gmail.com');

-- 2. AUTOMATISK PROFIL-SKAPARE (Trigger)
-- När en ny användare registrerar sig via Supabase Auth skapas automatiskt en rad i vår public.profiles-tabell.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, is_admin)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'User' || floor(random() * 100000)::text),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    -- Root-Admin Check
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. FRIENDS (Relationer mellan användare)
CREATE TABLE public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id1, user_id2)
);
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own friends" ON friends FOR SELECT USING (auth.uid() = user_id1 OR auth.uid() = user_id2);
CREATE POLICY "Users can insert friendship request" ON friends FOR INSERT WITH CHECK (auth.uid() = user_id1);
CREATE POLICY "Users can update friendship" ON friends FOR UPDATE USING (auth.uid() = user_id2);
CREATE POLICY "Users can delete friendship" ON friends FOR DELETE USING (auth.uid() = user_id1 OR auth.uid() = user_id2);

-- 4. GÄSTBOK (Guestbook Posts)
CREATE TABLE public.guestbook (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read guestbooks" ON guestbook FOR SELECT USING (true);
CREATE POLICY "Authed users can write to guestbooks" ON guestbook FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Delete guestbook posts" ON guestbook FOR DELETE USING (auth.uid() = receiver_id OR auth.uid() = sender_id OR auth.email() = 'apersson508@gmail.com');

-- 5. PRIVATE MESSAGES (Inkorg 100% säkrat)
CREATE TABLE public.private_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Strict isolated message viewing" ON private_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON private_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 6. WHITEBOARD (Forum feed)
CREATE TABLE public.whiteboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.whiteboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read whiteboard" ON whiteboard FOR SELECT USING (true);
CREATE POLICY "Authed users can post whiteboard" ON whiteboard FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Owner/Admin can delete" ON whiteboard FOR DELETE USING (auth.uid() = author_id OR auth.email() = 'apersson508@gmail.com');

-- 7. SUPPORT TICKETS (Mina sidor -> Support)
CREATE TABLE public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, closed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id OR auth.email() = 'apersson508@gmail.com');
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- AKTIVERA SUPABASE REALTIME (WebSockets för Pling!)
-- =========================================================================
BEGIN;
  -- Rensa befintlig publication om den redan existerar för att undvika dubletter
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.guestbook;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- KLART! Databasen är byggd och säkrad 🚀

-- ==============================================================================
-- 30. Hämta Total Lagringsstorlek (Diagnostic Tool)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_total_storage_size()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_size bigint;
BEGIN
  SELECT SUM(COALESCE((metadata->>'size')::bigint, 0))
  INTO total_size
  FROM storage.objects;
  
  RETURN COALESCE(total_size, 0);
END;
$$ SET search_path = public;

-- ==============================================================================
-- 31. Privata inställningar för profilen (Mina Sidor)
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_address BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_zipcode BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_interests BOOLEAN DEFAULT false;
