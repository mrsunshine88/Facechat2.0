-- Lägger till en kolumn för profilpresentation (Om Mig texten) i databasen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS presentation TEXT DEFAULT '';
