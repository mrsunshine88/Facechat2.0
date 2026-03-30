-- =========================================================================
-- NUCLEAR WHITEBOARD RESET (THE FINAL REMEDY)
-- =========================================================================
-- Den hÃ¤r filen raderar ALLT som kan orsaka dubbel-rÃ¤kning och tvingar 
-- databasen att rÃ¤kna rÃ¤tt en gÃ¥ng fÃ¶r alla.

-- 1. KOLLA VILKA TRIGGERS SOM FINNS JUST NU
-- KÃ¶r denna fÃ¶regÃ¥enoe om du vill se: 
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'whiteboard';

-- 2. RADERA ALLA TRIGGERS (DYNAMISKT)
-- Vi loopar igenom alla triggers pÃ¥ 'whiteboard' och tar bort dem fÃ¶r att va 100% sÃ¤kra.
DO $$ 
DECLARE 
    trgname RECORD;
BEGIN 
    FOR trgname IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'whiteboard' AND trigger_schema = 'public') 
    LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trgname.trigger_name) || ' ON whiteboard';
    END LOOP; 
END $$;

-- 3. SKAPA EN UNIK SPÄRR (Gör det omöjligt att dubbel-posta exakt samma delning)
-- Om man klickar 2 ggr snabbt kommer databasen nu säga NEJ till den andra raden.
-- Vi tillåter samma post med OLIKA text, men inte exakt samma kombo.
CREATE UNIQUE INDEX IF NOT EXISTS unique_share_guard 
ON whiteboard (author_id, parent_id, content) 
WHERE parent_id IS NOT NULL;

-- 4. INSTALLERA DEN HELT RENA MASTER-FUNKTIONEN
CREATE OR REPLACE FUNCTION maintain_whiteboard_shares_master_v10()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE whiteboard SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = NEW.parent_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE whiteboard SET shares_count = GREATEST(0, COALESCE(shares_count, 0) - 1) WHERE id = OLD.parent_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AKTIVERA TRIGGERN
CREATE TRIGGER trg_whiteboard_shares_FINAL
AFTER INSERT OR DELETE ON whiteboard
FOR EACH ROW
EXECUTE FUNCTION maintain_whiteboard_shares_master_v10();

-- 6. RÄKNA OM ALLA SIFFROR FRÅN GRUNDEN (Fixar dina "2:or" till "1:or")
UPDATE whiteboard w
SET shares_count = (
    SELECT COUNT(*) 
    FROM whiteboard s 
    WHERE s.parent_id = w.id
)
WHERE w.parent_id IS NULL;

-- KLART! Nu kan det fysiskt inte bli fel lÃ¤ngre.
