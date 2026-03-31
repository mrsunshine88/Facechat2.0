-- 1. KOLLA VILKA TRIGGERS SOM FINNS (KÃ¶r detta fÃ¶rst fÃ¶r att se!)
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'whiteboard'::regclass;

-- 2. "DEEP CLEAN" - TA BORT ALLT GAMMALT
DROP TRIGGER IF EXISTS tr_whiteboard_share_insert ON whiteboard;
DROP TRIGGER IF EXISTS tr_whiteboard_share_delete ON whiteboard;
DROP TRIGGER IF EXISTS tr_whiteboard_share_decrement ON whiteboard;
DROP TRIGGER IF EXISTS trg_share_count_plus ON whiteboard;
DROP TRIGGER IF EXISTS trg_whiteboard_shares ON whiteboard;
DROP TRIGGER IF EXISTS trg_whiteboard_shares_unified ON whiteboard;
DROP TRIGGER IF EXISTS trg_whiteboard_shares_final ON whiteboard;

-- 3. NY UNIFIERAD FUNKTION (Robust version)
CREATE OR REPLACE FUNCTION maintain_whiteboard_shares_v3()
RETURNS TRIGGER AS $$
BEGIN
    -- Vid INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE whiteboard 
            SET shares_count = COALESCE(shares_count, 0) + 1 
            WHERE id = NEW.parent_id;
        END IF;
    -- Vid DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE whiteboard 
            SET shares_count = GREATEST(0, COALESCE(shares_count, 0) - 1) 
            WHERE id = OLD.parent_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. INSTALLERA EN ENDA TRIGGER
CREATE TRIGGER trg_whiteboard_shares_MASTER
AFTER INSERT OR DELETE ON whiteboard
FOR EACH ROW
EXECUTE FUNCTION maintain_whiteboard_shares_v3();

-- 5. NOLLSTÄLL OCH RÄKNA OM ALLT FRÅN BÖRJAN (Så det blir helt rätt nu)
UPDATE whiteboard w
SET shares_count = (
    SELECT COUNT(*) 
    FROM whiteboard s 
    WHERE s.parent_id = w.id
)
WHERE w.parent_id IS NULL;

-- BekrÃ¤ftelse: Nu ska det bara finnas "trg_whiteboard_shares_master" kvar.
