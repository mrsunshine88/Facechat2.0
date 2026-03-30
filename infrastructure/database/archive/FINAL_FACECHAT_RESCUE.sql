-- =========================================================================
-- FACECHAT 2.0 - DEN SLUTGILTIGA RÄDDNINGS-FIXEN 🛡️🚀✨
-- Denna SQL tar bort det "förstörande" filtret och säkrar Root-Admin.
-- =========================================================================

-- 1. RENSA BORT GAMLA OCH FELAKTIGA TRIGGERS
-- Vi tar bort eventuella triggers som kan orsaka "stjärnor" eller dubbletter.
DROP TRIGGER IF EXISTS trg_filter_words ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_filter_words ON public.guestbook;
DROP TRIGGER IF EXISTS trg_filter_words ON public.private_messages;
DROP TRIGGER IF EXISTS trg_filter_words ON public.whiteboard;
DROP TRIGGER IF EXISTS trg_filter_words ON public.forum_posts;

-- 2. UPPGRADERA SPAM-SKYDDET (ICKE-FÖRSTÖRANDE)
-- Detta skydd stoppar spammare men RÖR INTE din text.
CREATE OR REPLACE FUNCTION public.check_user_spam()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
  v_duplicate_count INTEGER;
  v_new_content TEXT;
BEGIN
  -- Identifiera vem som skriver
  CASE TG_TABLE_NAME
    WHEN 'chat_messages'    THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    WHEN 'private_messages' THEN v_user_id := NEW.sender_id; v_new_content := NEW.content;
    WHEN 'guestbook'        THEN v_user_id := NEW.sender_id; v_new_content := NEW.content;
    WHEN 'whiteboard'       THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    WHEN 'forum_posts'      THEN v_user_id := NEW.author_id; v_new_content := NEW.content;
    ELSE RETURN NEW;
  END CASE;

  -- ROOT-ADMIN (apersson508) ÄR ALLTID UNDANTAGEN FRÅN ALLA SPÄRRAR
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND username = 'apersson508') THEN
    RETURN NEW;
  END IF;

  -- KONTROLL: IDENTISKA MEDDELANDEN (MAX 5 I RAD)
  -- Vid 5:e försöket kastas ett fel som frontenden fångar upp.
  IF TG_TABLE_NAME = 'chat_messages' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.chat_messages WHERE author_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'private_messages' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.private_messages WHERE sender_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  ELSIF TG_TABLE_NAME = 'guestbook' THEN
      SELECT count(*) INTO v_duplicate_count FROM (SELECT content FROM public.guestbook WHERE sender_id = v_user_id ORDER BY created_at DESC LIMIT 4) AS last_msgs WHERE content = v_new_content;
  END IF;

  IF v_duplicate_count >= 4 THEN
      RAISE EXCEPTION 'DUPLICATE_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. EXTRA SÄKERHET FÖR ROOT-ADMIN
-- Försäkra att du aldrig kan bannlysas av misstag.
UPDATE public.profiles SET is_banned = false, is_admin = true, perm_roles = true WHERE username = 'apersson508';
-- Ta bort eventuell fellåsning av din IP (byt till din IP om den spärrats)
DELETE FROM public.blocked_ips WHERE ip = '158.174.223.37'; 

-- 4. LOGGA REPARATIONEN
INSERT INTO public.admin_logs (action, details) VALUES ('SYSTEM_RESCUE', '{"note": "Removed destructive word filter, restored Root-Admin immunity and cleaned IP locks."}');

SELECT 'SYSTEM: Facechat 2.0 är nu säkrat och ord-filtret är inte längre förstörande! 🟢' as status;
