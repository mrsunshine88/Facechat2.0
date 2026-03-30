-- =========================================================================
-- FACECHAT 2.0 - FIX FÖR DUBBLA PUSH-NOTISER
-- KÖR DETTA I SUPABASE SQL EDITOR FÖR ATT RADERA GHOST-PRENUMERATIONER
-- =========================================================================

-- Eftersom webbläsaren Chrome och Appen genererade två OLIKA adresser 
-- för samma telefon, får du dubbla utskick.
-- Denna kod tömmer hela tabellen så du kan börja om på ett tomt blad 
-- inifrån själva Appen, och därmed döda Chrome för alltid!

TRUNCATE TABLE public.push_subscriptions;

-- När detta är kört -> Öppna Facechat Appen på telefonen och tryck på "Aktivera Push" en sista gång!
