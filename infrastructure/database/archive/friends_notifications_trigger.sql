-- =========================================================================
-- AUTOMATISKA VÄNNOTISER (SQL TRIGGER)
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT SLIPPA MANUELLA NOTISER I FRONTEND
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_friend_notification()
RETURNS trigger AS $$
DECLARE
    target_username TEXT;
    receiver_id_val UUID;
BEGIN
    -- Bestäm vem som ska få notisen (den som INTE är action_user_id)
    IF NEW.user_id_1 = NEW.action_user_id THEN
        receiver_id_val := NEW.user_id_2;
    ELSE
        receiver_id_val := NEW.user_id_1;
    END IF;

    -- 1. Om det är en NY förfrågan (status = 'pending')
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        INSERT INTO public.notifications (receiver_id, actor_id, type, content, link)
        VALUES (
            receiver_id_val,
            NEW.action_user_id,
            'friend_request',
            'vill bli din vän.',
            '/krypin?tab=Vänner'
        );
    END IF;

    -- 2. Om en förfrågan ACCEPTERAS (status ändras till 'accepted')
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted') THEN
        INSERT INTO public.notifications (receiver_id, actor_id, type, content, link)
        VALUES (
            receiver_id_val,
            NEW.action_user_id,
            'friend_accept',
            'har accepterat din vänförfrågan! Ni är nu vänner.',
            '/krypin?tab=Vänner'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Koppla triggern till friendships-tabellen
DROP TRIGGER IF EXISTS on_friendship_change ON public.friendships;
CREATE TRIGGER on_friendship_change
    AFTER INSERT OR UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_friend_notification();
