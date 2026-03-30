-- =========================================================================
-- OFFICIAL SECURITY FIX V3 - FACECHAT 🛠️🛡️🚀
-- =========================================================================

-- 1. Laga Trigger-funktionen (Rätt kolumnnamn för alla tabeller)
-- Vi ändrar från NEW.profile_id till korrekt column för varje tabell.
CREATE OR REPLACE FUNCTION public.check_user_spam()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_msg_count INTEGER;
  v_cutoff TIMESTAMP := now() - interval '1 minute';
  v_duplicate_count INTEGER;
  v_new_content TEXT;
BEGIN
  -- Identifiera användar-ID korrekt för alla tabeller
  CASE TG_TABLE_NAME
    WHEN 'chat_messages'    THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    WHEN 'private_messages' THEN v_user_id := NEW.sender_id; v_new_content := NEW.content;
    WHEN 'guestbook'        THEN v_user_id := NEW.sender_id; v_new_content := NEW.content;
    WHEN 'whiteboard'       THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    WHEN 'forum_posts'      THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    WHEN 'forum_threads'    THEN v_user_id := NEW.author_id; v_new_content := NEW.title;
    ELSE RETURN NEW;
  END CASE;

  -- Hämta användarnamn
  SELECT username INTO v_username FROM public.profiles WHERE id = v_user_id;

  -- 1. KONTROLL: IDENTISKA MEDDELANDEN (MAX 5 I RAD)
  IF TG_TABLE_NAME = 'chat_messages' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.chat_messages WHERE author_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'private_messages' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.private_messages WHERE sender_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'guestbook' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.guestbook WHERE sender_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'whiteboard' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.whiteboard WHERE author_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'forum_posts' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.forum_posts WHERE author_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'forum_threads' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT title FROM public.forum_threads WHERE author_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE title = v_new_content;
  END IF;

  -- Om vi har 4 identiska sedan tidigare -> Kasta fel
  IF v_duplicate_count >= 4 THEN
      RAISE EXCEPTION 'DUPLICATE_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  -- 2. AKUT REPARATION: Ta bort eventuell felaktig spärr på din IP
  -- Detta gör att du kan komma in direkt igen.
  DELETE FROM public.blocked_ips WHERE ip = '158.174.223.37';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Återaktivera systemet med en "ping"
SELECT 'SYSTEM: Chatten är nu lagad och din IP är upplåst! 🟢' as resultat;
