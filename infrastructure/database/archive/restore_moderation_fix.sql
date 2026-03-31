-- =========================================================================
-- RESTORE MODERATION POWER - MASS DELETE FIX 🛠️🛡️🚀
-- =========================================================================

-- Ge administratörer (och root) rätt att radera i alla relevanta tabeller
-- Detta fixar "Akut Mass-radera Spam" knappen.

-- 1. Whiteboard
DROP POLICY IF EXISTS "Admins can delete whiteboard posts" ON public.whiteboard;
CREATE POLICY "Admins can delete whiteboard posts" ON public.whiteboard
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_content = true))
  OR auth.email() = 'apersson508@gmail.com'
);

-- 2. Forum Posts
DROP POLICY IF EXISTS "Admins can delete forum posts" ON public.forum_posts;
CREATE POLICY "Admins can delete forum posts" ON public.forum_posts
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_content = true))
  OR auth.email() = 'apersson508@gmail.com'
);

-- 3. Guestbook
DROP POLICY IF EXISTS "Admins can delete guestbook entries" ON public.guestbook;
CREATE POLICY "Admins can delete guestbook entries" ON public.guestbook
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_content = true))
  OR auth.email() = 'apersson508@gmail.com'
);

-- 4. Chat Messages
DROP POLICY IF EXISTS "Admins can delete chat messages" ON public.chat_messages;
CREATE POLICY "Admins can delete chat messages" ON public.chat_messages
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin = true OR perm_content = true))
  OR auth.email() = 'apersson508@gmail.com'
);

-- Säkerställ att tabellerna har RLS påslaget (vilket de bör ha)
ALTER TABLE public.whiteboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
