-- =========================================================================
-- FACECHAT 2.0 - ADMIN PERMISSIONS & MODERATION FIX
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT RÄTTA TILL RLS-POLICYS
-- =========================================================================

-- 1. Tillåt Admins att se och hantera alla anmälningar
DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" ON public.reports 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true) 
  OR auth.email() = 'apersson508@gmail.com'
);

DROP POLICY IF EXISTS "Admins can update all reports" ON public.reports;
CREATE POLICY "Admins can update all reports" ON public.reports 
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true) 
  OR auth.email() = 'apersson508@gmail.com'
);

DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Admins can delete reports" ON public.reports 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_content = true) 
  OR auth.email() = 'apersson508@gmail.com'
);


-- 2. Tillåt Admins att se blockeringar (för statistik och sökning)
DROP POLICY IF EXISTS "Admins can view all user_blocks" ON public.user_blocks;
CREATE POLICY "Admins can view all user_blocks" ON public.user_blocks 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perm_users = true) 
  OR auth.email() = 'apersson508@gmail.com'
);

-- Note: Blockering/Avblockering i admin sköts via Server Actions som redan har tillgång. 
-- Dessa policys är främst till för att Dashboarden och sök-vyn i webläsaren ska fungera.
