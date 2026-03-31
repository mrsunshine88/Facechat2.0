-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT SLÅ PÅ REALTIME PÅ ALLT
-- Detta skript loopar igenom alla dina tabeller och lägger till dem i "supabase_realtime"
-- Det ignorerar automatiskt tabeller som redan är tillagda, så det är 100% säkert att köra.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        BEGIN
            EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || quote_ident(r.tablename);
        EXCEPTION WHEN duplicate_object THEN
            -- Tabellen är redan live, strunta i felet och fortsätt!
        END;
    END LOOP;
END $$;
