-- 1. Skapa funktionen för att hantera Spam Rate Limiting & Dubletter
CREATE OR REPLACE FUNCTION check_spam_and_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    last_post_time TIMESTAMP WITH TIME ZONE;
    recent_duplicate_count INT;
    cooldown_seconds INT;
BEGIN
    -- Sätt upp specifika tidsspärrar (cooldowns) beroende på tabell
    IF TG_TABLE_NAME = 'chat_messages' THEN
        cooldown_seconds := 1; -- 1 sekund för chatten
    ELSIF TG_TABLE_NAME = 'whiteboard' OR TG_TABLE_NAME = 'forum_posts' THEN
        cooldown_seconds := 10; -- 10 sekunder för längre inlägg
    ELSE
        cooldown_seconds := 5;
    END IF;

    -- Kolla Rate Limiting (kylningsperiod)
    EXECUTE format('
        SELECT created_at 
        FROM %I 
        WHERE author_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1', TG_TABLE_NAME)
    INTO last_post_time
    USING NEW.author_id;

    IF last_post_time IS NOT NULL AND (last_post_time + (cooldown_seconds || ' seconds')::interval) > now() THEN
        RAISE EXCEPTION 'Du skickar meddelanden för snabbt! Vänta % sekunder.', cooldown_seconds;
    END IF;

    -- Kolla Dubletter (samma innehåll de senaste 2 minuterna)
    IF NEW.content IS NOT NULL THEN
        EXECUTE format('
            SELECT COUNT(*) 
            FROM %I 
            WHERE author_id = $1 
              AND content = $2 
              AND created_at > now() - interval ''2 minutes''', TG_TABLE_NAME)
        INTO recent_duplicate_count
        USING NEW.author_id, NEW.content;

        IF recent_duplicate_count > 0 THEN
            RAISE EXCEPTION 'Antispam: Du har redan skickat exakt samma inlägg nyligen!';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Applicera funktionen (Triggers) på relevanta tabeller
DROP TRIGGER IF EXISTS trg_anti_spam_whiteboard ON whiteboard;
CREATE TRIGGER trg_anti_spam_whiteboard
BEFORE INSERT ON whiteboard
FOR EACH ROW
EXECUTE FUNCTION check_spam_and_rate_limit();

DROP TRIGGER IF EXISTS trg_anti_spam_forum_posts ON forum_posts;
CREATE TRIGGER trg_anti_spam_forum_posts
BEFORE INSERT ON forum_posts
FOR EACH ROW
EXECUTE FUNCTION check_spam_and_rate_limit();

DROP TRIGGER IF EXISTS trg_anti_spam_chat_messages ON chat_messages;
CREATE TRIGGER trg_anti_spam_chat_messages
BEFORE INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION check_spam_and_rate_limit();
