-- =========================================================================
-- EMERGENCY DATABASE OPTIMIZATION v1.0 🛡️🚀
-- Facechat 2.0 - Disk IO Rescue Script
-- =========================================================================
-- Denna kod skapar de saknade "blixt-indexen" som räddar din Disk IO budget.

-- 1. Optimera Profile-sökningar och behörighetskontroller
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. Optimera Anmälningar (Admin-panelen laddas mycket snabbare)
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 3. Optimera Chatt (Sänker Disk IO vid hög aktivitet)
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id);

-- 4. Optimera Whiteboard & Kommentarer
CREATE INDEX IF NOT EXISTS idx_whiteboard_created_at ON public.whiteboard(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboard_comments_created_at ON public.whiteboard_comments(created_at DESC);

-- 5. Optimera Forum
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created_at ON public.forum_threads(created_at DESC);

-- 6. Optimera Gästbok
CREATE INDEX IF NOT EXISTS idx_guestbook_receiver_created ON public.guestbook(receiver_id, created_at DESC);

-- 7. Optimera Blockeringar (Viktigt för att filter ska gå snabbt)
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_blocked ON public.user_blocks(blocker_id, blocked_id);

-- 8. [NYTT FRÅN RAPPORT] Optimera Notifikationer (Hög belastning i loggen)
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_created ON public.notifications(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);

-- 9. [NYTT FRÅN RAPPORT] Optimera Profil-sökningar på namn (Många joins)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- KLART! Databasen bör nu svara betydligt snabbare.
-- Kör hela detta skript i Supabase SQL Editor för att aktivera fixarna.
