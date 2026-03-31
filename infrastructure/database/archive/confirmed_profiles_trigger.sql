-- SQL för att säkerställa att inga profiler skapas förrän e-posten är bekräftad.
-- Detta stoppar "skräpkonton" och robotar från att synas på sidan.

-- 1. Ta bort den gamla triggern (om den finns) som skapar profiler direkt vid auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Skapa funktionen som skapar profilen FÖRST vid bekräftelse
CREATE OR REPLACE FUNCTION public.handle_confirmed_user()
RETURNS trigger AS $$
BEGIN
  -- Skapa profilen ENDAST om email_confirmed_at precis blev satt (inte var satt förut)
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    
    -- SÄKERHET: Om användarnamn saknas i metadatan, avbryt profilskapandet.
    -- Detta förhindrar att "Glömt lösenord"-flödet på obekräftade konton skapar tomma profiler.
    IF (NEW.raw_user_meta_data->>'username') IS NULL OR (NEW.raw_user_meta_data->>'username') = '' THEN
      RETURN NEW;
    END IF;

    -- Kolla om profilen redan finns för att undvika dubbletter
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      INSERT INTO public.profiles (id, username, avatar_url)
      VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'username', 
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aktivera triggern vid varje uppdatering av användarkontot
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_confirmed_user();
