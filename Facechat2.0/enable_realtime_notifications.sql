-- KÖR DETTA I SUPABASE SQL EDITOR OM RINGKLOCKAN INTE UPPDATERAS LIVE NÄR MAN FÅR EN NOTIS
-- Detta aktiverar Realtime (live-uppdateringar via websockets) för tabellen "notifications"

begin;
  -- If publication exists, add the table
  alter publication supabase_realtime add table notifications;
commit;
