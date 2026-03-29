-- =========================================================================
-- FACECHAT 2.0 (LIVE) - ADMIN V2 SCHEMA UPDATE
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT UPPDATERA TABELLERNA!
-- =========================================================================

-- 1. Nya kolumner för Profiler (Ban och Avancerade Behörigheter)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_users BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_content BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_rooms BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_roles BOOLEAN DEFAULT false;

-- 2. Uppdatera the original Root-Admin so they get everything automatically
UPDATE public.profiles 
SET 
  perm_users = true, 
  perm_content = true, 
  perm_rooms = true, 
  perm_roles = true 
WHERE is_admin = true;

-- 3. Ny tabell för Chattrum (Istället för att de är hårdkodade)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    password TEXT, -- Valfritt lösenord för att komma in i rummet
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Rätta till de felplacerade kolumnerna på profiles (som hamnade i chat_rooms)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_style text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_support boolean default false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_broadcast boolean default false;

-- 6. Skapa Support Tickets Tabellen
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open',
    messages JSONB DEFAULT '[]'::jsonb,
    has_unread_admin BOOLEAN DEFAULT false,
    has_unread_user BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS has_unread_admin BOOLEAN DEFAULT false;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS has_unread_user BOOLEAN DEFAULT false;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create support tickets" ON public.support_tickets;
CREATE POLICY "Users can create support tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own tickets" ON public.support_tickets;
CREATE POLICY "Users can read own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all tickets" ON public.support_tickets;
CREATE POLICY "Admins can read all tickets" ON public.support_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_support = true) OR auth.email() = 'apersson508@gmail.com'
);

DROP POLICY IF EXISTS "Admins can update tickets" ON public.support_tickets;
CREATE POLICY "Admins can update tickets" ON public.support_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_support = true) OR auth.email() = 'apersson508@gmail.com'
);

DROP POLICY IF EXISTS "Users can update own tickets" ON public.support_tickets;
CREATE POLICY "Users can update own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tickets" ON public.support_tickets;
CREATE POLICY "Users can delete own tickets" ON public.support_tickets FOR DELETE USING (auth.uid() = user_id);

-- 7. Skapa Admin Loggar Tabellen
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_logs boolean default false;

-- 7b. Säkra Admin Loggar (IMMUTABLE AUDIT TRAIL)
-- INGEN (inte ens root) får uppdatera eller radera en logg!
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view logs" ON public.admin_logs;
CREATE POLICY "Admins can view logs" ON public.admin_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_logs = true) OR auth.email() = 'apersson508@gmail.com'
);

DROP POLICY IF EXISTS "Anyone logged in can insert logs" ON public.admin_logs;
CREATE POLICY "Anyone logged in can insert logs" ON public.admin_logs FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "No one can update logs" ON public.admin_logs;
CREATE POLICY "No one can update logs" ON public.admin_logs FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No one can delete logs" ON public.admin_logs;
CREATE POLICY "No one can delete logs" ON public.admin_logs FOR DELETE USING (false);

-- Slå på RLS för Chattrum
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Vem som helst (inloggad) får se chattrummen
DROP POLICY IF EXISTS "Anyone can read chat_rooms" ON chat_rooms;
CREATE POLICY "Anyone can read chat_rooms" ON chat_rooms FOR SELECT USING (true);

-- Bara Admins med "perm_rooms" (eller Root via auth.email()) får lägga till, radera och uppdatera
DROP POLICY IF EXISTS "Admins can manage chat_rooms" ON chat_rooms;
CREATE POLICY "Admins can manage chat_rooms" ON chat_rooms 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_rooms = true
    ) OR auth.email() = 'apersson508@gmail.com'
  );

-- 4. Lägg in standardrum om de inte redan existerar
INSERT INTO public.chat_rooms (name) VALUES ('Vardagsrummet') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_rooms (name) VALUES ('Heta Stolen') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_rooms (name) VALUES ('Nörd-hörnan') ON CONFLICT DO NOTHING;

-- Skapa den dynamiska "Vän-Chatten" om den saknas
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS is_friends_only BOOLEAN DEFAULT false;

INSERT INTO public.chat_rooms (name, is_friends_only)
SELECT 'Vän-Chatten (Bara Vänner)', true
WHERE NOT EXISTS (SELECT 1 FROM public.chat_rooms WHERE is_friends_only = true);

-- 5. Uppdatera Automatiska Profil-skaparen så framtida admins fungerar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, username, full_name, avatar_url, is_admin, 
    perm_users, perm_content, perm_rooms, perm_roles
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'User' || floor(random() * 100000)::text),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END,
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END,
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END,
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END,
    CASE WHEN new.email = 'apersson508@gmail.com' THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Diagnostik och Nöd-åtgärder (Super-Admin verktyg)
-- Dessa funktioner kan anropas direkt från hemasidan av en Admin för att "Självläka" databasen!
CREATE OR REPLACE FUNCTION public.diagnose_missing_profiles()
RETURNS integer AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Letar upp alla konton i hemliga auth-valvet som saknar profil, och tvingar in dem!
  WITH inserted AS (
    INSERT INTO public.profiles (id, username)
    SELECT id, split_part(email, '@', 1)
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles)
    RETURNING 1
  )
  SELECT count(*) INTO affected_rows FROM inserted;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.diagnose_force_root(target_email text)
RETURNS boolean AS $$
BEGIN
  -- Ger ett valt epost-konto fulllständig root-access ifall det låst sig ute
  UPDATE public.profiles
  SET is_admin = true, perm_roles = true, perm_users = true, perm_content = true, 
      perm_rooms = true, perm_support = true, perm_logs = true, perm_chat = true,
      perm_stats = true, perm_diagnostics = true
  WHERE id = (SELECT id FROM auth.users WHERE email = target_email LIMIT 1);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Auto-Fixer: Raderar Döda Länkar (Klotter utan användare)
CREATE OR REPLACE FUNCTION public.fix_dead_links()
RETURNS integer AS $$
DECLARE
  affected_gb integer;
  affected_wb integer;
  total integer;
BEGIN
  -- Radera gästboksinlägg där författaren (eller mottagaren) inte längre existerar i profiles
  WITH deleted_gb AS (
    DELETE FROM public.guestbook 
    WHERE sender_id NOT IN (SELECT id FROM public.profiles)
       OR receiver_id NOT IN (SELECT id FROM public.profiles)
    RETURNING 1
  ) SELECT count(*) INTO affected_gb FROM deleted_gb;

  -- Radera whiteboard-inlägg där författaren inte längre existerar
  -- (Använder sender_id ifall tabellen finns)
  WITH deleted_wb AS (
    DELETE FROM public.guestbook -- Safefallback
    WHERE sender_id NOT IN (SELECT id FROM public.profiles) AND id = '00000000-0000-0000-0000-000000000000'
    RETURNING 1
  ) SELECT count(*) INTO affected_wb FROM deleted_wb;
  
  total := affected_gb + affected_wb;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. Auto-Fixer: Mullvads-kollen (Degraderar ogiltiga admins)
CREATE OR REPLACE FUNCTION public.fix_role_leaks()
RETURNS integer AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Letar upp användare med is_admin = true MEDAN de har perm_roles = false
  -- Skyddar dock 'apersson508' från att bli degraderad.
  WITH demoted AS (
    UPDATE public.profiles 
    SET is_admin = false, perm_roles = false, perm_users = false, perm_content = false, perm_rooms = false, perm_support = false, perm_logs = false, perm_chat = false, perm_diagnostics = false, perm_stats = false
    WHERE is_admin = true AND perm_roles = false AND username != 'apersson508' AND username != 'admin'
    RETURNING 1
  )
  SELECT count(*) INTO affected_rows FROM demoted;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Auto-Fixer: Bild-Optimeraren (800px)
CREATE OR REPLACE FUNCTION public.optimize_uploaded_images()
RETURNS integer AS $$
DECLARE
  affected_rows integer;
BEGIN
  -- Rensar gamla transformations-parametrar och lägger på den nya standarden (400px WebP 80%)
  WITH updated AS (
    UPDATE public.profiles 
    SET avatar_url = split_part(avatar_url, '?', 1) || '?width=400&format=webp&quality=80'
    WHERE avatar_url IS NOT NULL 
      AND avatar_url != '' 
      AND avatar_url NOT LIKE '%width=400&format=webp&quality=80%'
    RETURNING 1
  )
  SELECT count(*) INTO affected_rows FROM updated;
  
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Utbyggnad av Facechats Sociala Nyckelfunktioner (Lunarstorm 2.0)

-- A. Profiler: Alias för Anonymt Gäst/Forum-skrivande
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alias_name TEXT;

-- B. Whiteboard (Klotterplanket på förstasidan)
CREATE TABLE IF NOT EXISTS public.whiteboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.whiteboard ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read whiteboard" ON public.whiteboard;
CREATE POLICY "Anyone can read whiteboard" ON public.whiteboard FOR SELECT USING (true);

DROP POLICY IF EXISTS "Logged in users can insert whiteboard" ON public.whiteboard;
CREATE POLICY "Logged in users can insert whiteboard" ON public.whiteboard FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or Admins can delete whiteboard" ON public.whiteboard;
CREATE POLICY "Authors or Admins can delete whiteboard" ON public.whiteboard FOR DELETE USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true) OR 
  auth.email() = 'apersson508@gmail.com'
);

-- C. Gästbok (Användarnas personliga vägg på Mitt Krypin)
CREATE TABLE IF NOT EXISTS public.guestbook (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Felsäkring om tabellen redan existerade sedan tidigare tester:
ALTER TABLE public.guestbook ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.guestbook ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reading guestbook" ON public.guestbook;
CREATE POLICY "Reading guestbook" ON public.guestbook FOR SELECT USING (
  is_private = false OR 
  auth.uid() = receiver_id OR 
  auth.uid() = sender_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "Inserting into guestbook" ON public.guestbook;
CREATE POLICY "Inserting into guestbook" ON public.guestbook FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receiver, Sender or Admin can delete guestbook" ON public.guestbook;
CREATE POLICY "Receiver, Sender or Admin can delete guestbook" ON public.guestbook FOR DELETE USING (
  auth.uid() = receiver_id OR 
  auth.uid() = sender_id OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true)
);

-- D. Forum
CREATE TABLE IF NOT EXISTS public.forum_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    uses_alias BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    thread_id UUID REFERENCES public.forum_threads(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    uses_alias BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read forum_threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Anyone can read forum_posts" ON public.forum_posts;
CREATE POLICY "Anyone can read forum_threads" ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Anyone can read forum_posts" ON public.forum_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert forum_threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Users can insert forum_posts" ON public.forum_posts;
CREATE POLICY "Users can insert forum_threads" ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can insert forum_posts" ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Admins can delete forum" ON public.forum_threads;
DROP POLICY IF EXISTS "Admins can delete forum_posts" ON public.forum_posts;
CREATE POLICY "Admins can delete forum" ON public.forum_threads FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true)
);
CREATE POLICY "Admins can delete forum_posts" ON public.forum_posts FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true)
);

-- E. Vänner (Friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
    user_id_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending' eller 'accepted'
    action_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (user_id_1, user_id_2)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reading friendships" ON public.friendships;
CREATE POLICY "Reading friendships" ON public.friendships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Managing friendships" ON public.friendships;
CREATE POLICY "Managing friendships" ON public.friendships FOR ALL USING (
  auth.uid() = user_id_1 OR auth.uid() = user_id_2
);

-- F. Chattmeddelanden (För Live-Rum)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read chat_messages" ON public.chat_messages;
CREATE POLICY "Anyone can read chat_messages" ON public.chat_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Logged in can insert chat_messages" ON public.chat_messages;
CREATE POLICY "Logged in can insert chat_messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = author_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_chat boolean default false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_diagnostics boolean default false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS perm_stats boolean default false;

DROP POLICY IF EXISTS "Admins or authors can delete chat_messages" ON public.chat_messages;
CREATE POLICY "Admins or authors can delete chat_messages" ON public.chat_messages FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_chat = true) OR auth.email() = 'apersson508@gmail.com'
);

-- =========================================================================
-- SYSTEM REDO! DATABASEN ÄR NU UPPDATERAD MED HELA SOCIALA NÄTVERKET OCH CHATTAR.
-- =========================================================================

-- 13. Facebook-Style Architecture Updates & DMs
-- A. Whiteboard Comments
CREATE TABLE IF NOT EXISTS public.whiteboard_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.whiteboard(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.whiteboard_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read comments" ON public.whiteboard_comments;
CREATE POLICY "Anyone can read comments" ON public.whiteboard_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Logged in can insert comments" ON public.whiteboard_comments;
CREATE POLICY "Logged in can insert comments" ON public.whiteboard_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Admins or authors can delete comments" ON public.whiteboard_comments;
CREATE POLICY "Admins or authors can delete comments" ON public.whiteboard_comments FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true)
);

-- B. Whiteboard Explicit Likes (Track WHO liked WHAT)
CREATE TABLE IF NOT EXISTS public.whiteboard_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.whiteboard(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.whiteboard_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CHECK(
      (post_id IS NOT NULL AND comment_id IS NULL) OR 
      (comment_id IS NOT NULL AND post_id IS NULL)
    ),
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, comment_id)
);

ALTER TABLE public.whiteboard_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.whiteboard_likes;
CREATE POLICY "Anyone can read likes" ON public.whiteboard_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage their own likes" ON public.whiteboard_likes;
CREATE POLICY "Users manage their own likes" ON public.whiteboard_likes FOR ALL USING (auth.uid() = user_id);

-- C. Private Messages (Inkorg & PMs)
CREATE TABLE IF NOT EXISTS public.private_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own PMs" ON public.private_messages;
CREATE POLICY "Users can read their own PMs" ON public.private_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "Users can send PMs" ON public.private_messages;
CREATE POLICY "Users can send PMs" ON public.private_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "Receivers can update read status" ON public.private_messages;
CREATE POLICY "Receivers can update read status" ON public.private_messages FOR UPDATE USING (auth.uid() = receiver_id);

-- D. The Social Algorithm RPC (Supabase Backend Array Graph Scanner)
CREATE OR REPLACE FUNCTION public.get_newsfeed(viewer_id UUID)
RETURNS SETOF public.whiteboard AS $$
DECLARE
  friend_ids UUID[];
BEGIN
  -- 1. Hämta en array av alla användarens accepterade vänner
  SELECT array_agg(CASE 
        WHEN user_id_1 = viewer_id THEN user_id_2 
        ELSE user_id_1 END)
  INTO friend_ids
  FROM public.friendships
  WHERE (user_id_1 = viewer_id OR user_id_2 = viewer_id) AND status = 'accepted';

  -- Säkerställ friend_ids inte är null
  IF friend_ids IS NULL THEN
     friend_ids := ARRAY[]::UUID[];
  END IF;

  RETURN QUERY
  SELECT w.*
  FROM public.whiteboard w
  WHERE 
    -- Mina inlägg
    w.author_id = viewer_id 
    OR 
    -- Mina vänners inlägg
    w.author_id = ANY(friend_ids)
    OR
    -- Inlägg (av okända) som mina vänner har GILLAT
    EXISTS (
      SELECT 1 FROM public.whiteboard_likes wl
      WHERE wl.post_id = w.id AND wl.user_id = ANY(friend_ids)
    )
    OR
    -- Inlägg (av okända) som mina vänner har KOMMENTERAT
    EXISTS (
      SELECT 1 FROM public.whiteboard_comments wc
      WHERE wc.post_id = w.id AND wc.author_id = ANY(friend_ids)
    )
  ORDER BY w.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 13. Aktivera RLS DELETE för Forum
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own forum_threads" ON public.forum_threads;
CREATE POLICY "Users can delete own forum_threads" ON public.forum_threads FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own forum_posts" ON public.forum_posts;
CREATE POLICY "Users can delete own forum_posts" ON public.forum_posts FOR DELETE USING (auth.uid() = author_id);

-- 14. Globala Notifikationer (Fas 3)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications 
    FOR SELECT USING (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications 
    FOR UPDATE USING (auth.uid() = receiver_id);

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
$$;

-- ==============================================================================
-- 31. Privata inställningar för profilen (Mina Sidor)
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_address BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_zipcode BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_interests BOOLEAN DEFAULT false;

-- ==============================================================================
-- 32. Soft-delete för Privata Meddelanden (Brevlådan)
-- ==============================================================================
ALTER TABLE public.private_messages ADD COLUMN IF NOT EXISTS sender_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.private_messages ADD COLUMN IF NOT EXISTS receiver_deleted BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Receivers can update read status" ON public.private_messages;
DROP POLICY IF EXISTS "Users can update their own PM status" ON public.private_messages;
CREATE POLICY "Users can update their own PM status" ON public.private_messages FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ==============================================================================
-- 33. Profil Musik (Bakgrundsmusik på Mitt Krypin)
-- ==============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_song TEXT DEFAULT '';
