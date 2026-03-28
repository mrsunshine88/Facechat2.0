-- FIX: FORUM RECURSION & ACCESS 🛡️🚀
-- 1. Forum Trådar
DROP POLICY IF EXISTS "Public can read forum threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Authenticated can create threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Admins can delete forum threads" ON public.forum_threads;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forum threads" ON public.forum_threads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create threads" ON public.forum_threads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Root admin full access to threads" ON public.forum_threads FOR ALL USING (auth.email() = 'apersson508@gmail.com');
-- 2. Forum Inlägg
DROP POLICY IF EXISTS "Public can read forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Authenticated can create posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Admins can delete forum posts" ON public.forum_posts;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read forum posts" ON public.forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Root admin full access to posts" ON public.forum_posts FOR ALL USING (auth.email() = 'apersson508@gmail.com');
