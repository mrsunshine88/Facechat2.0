-- =========================================================================
-- ADMIN PRESTANDA-OPTIMERING (INDEXERING)
-- =========================================================================

-- 1. Index för Support-ärenden (Snabbar upp räknaren i Headern)
CREATE INDEX IF NOT EXISTS idx_support_tickets_unread_admin 
ON public.support_tickets (has_unread_admin) 
WHERE has_unread_admin = true AND admin_deleted = false;

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_open
ON public.support_tickets (status)
WHERE status = 'open';

-- 2. Index för Anmälningar (Snabbar upp "Reports"-fliken och räknaren)
CREATE INDEX IF NOT EXISTS idx_reports_status_open
ON public.reports (status)
WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_reports_reported_user
ON public.reports (reported_user_id);

-- 3. Index för Notiser (Snabbar upp laddning av klockan för stora konton)
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_unread
ON public.notifications (receiver_id, is_read)
WHERE is_read = false;

-- 4. Index för sökningar i Arkaden (Topplistor)
CREATE INDEX IF NOT EXISTS idx_snake_scores_game_score
ON public.snake_scores (game_id, score DESC);

-- Klart! Dessa index gör att databasen kan hitta rätt rader 
-- direkt utan att behöva skanna igenom hela tabellerna.
