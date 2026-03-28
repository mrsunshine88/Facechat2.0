-- =========================================================================
-- SÄKERHETS-FIX: TILLÅT MIDDLEWARE ATT LÄSA SPÄRRLISTAN 🛡️✅
-- För att IP-blockering ska fungera måste "dörrvakten" (Middleware) kunna
-- läsa från blocked_ips tabellen, även för oinloggade besökare.
-- =========================================================================

-- 1. Aktivera RLS (om det inte redan är gjort)
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- 2. Skapa en policy som tillåter ALLA att LÄSA (SELECT) listan
-- Detta är helt säkert då det bara är en lista på spärrade IP-nummer.
DROP POLICY IF EXISTS "Public read for blocked_ips" ON public.blocked_ips;
CREATE POLICY "Public read for blocked_ips" ON public.blocked_ips
FOR SELECT USING (true);

-- 3. Verifiera (Denna ska returnera IP-nummer till din mobil om du kör den i SQL Editor)
-- SELECT * FROM public.blocked_ips;
