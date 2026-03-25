-- FACECHAT COMPLETE FIX VERSION 6 (Final Nuclear Cleanup)
-- Mål: Rensa bort alla 406-fel och ta bort "spökrutan" för apersson508@gmail.com permanent.

-- 1. SPECIFIK RENSNING FÖR APERSSON508 OCH DEN ANDRA ANVÄNDAREN (Spökrutan)
-- Vi raderar alla rader mellan dessa två för att nollställa deras relation.
DELETE FROM friendships 
WHERE (user_id_1 = '212f1ea6-8fd1-4480-8088-c121bd0d3071' AND user_id_2 = '917bdd07-f196-4807-9415-e855809add2e')
   OR (user_id_1 = '917bdd07-f196-4807-9415-e855809add2e' AND user_id_2 = '212f1ea6-8fd1-4480-8088-c121bd0d3071');

-- 2. GENERELL RENSNING AV DUBBLETTER (Säkerhetskopia)
-- Om det finns både en 'accepted' och en 'pending' för samma person-par, ta bort 'pending'.
DELETE FROM friendships f1
WHERE f1.status = 'pending'
AND EXISTS (
    SELECT 1 FROM friendships f2
    WHERE f2.status = 'accepted'
    AND (
        (f1.user_id_1 = f2.user_id_1 AND f1.user_id_2 = f2.user_id_2)
        OR
        (f1.user_id_1 = f2.user_id_2 AND f1.user_id_2 = f2.user_id_1)
    )
);

-- 3. RÄTTA TILL PROFILER SOM HAR DUBBEL-POSTER (Nuclear fix för profiles)
-- Detta behåller bara den nyaste profilen per ID om det mot förmodan skulle finnas dubbletter där.
DELETE FROM profiles p1
WHERE p1.updated_at < (
    SELECT MAX(p2.updated_at)
    FROM profiles p2
    WHERE p1.id = p2.id
);

-- 4. FUNKTION FÖR AUTOMATISK STÄDNING (Körs vid varje admin-scan)
CREATE OR REPLACE FUNCTION clean_up_social_health()
RETURNS void AS $$
BEGIN
    -- Ta bort dubbla vänskaper
    DELETE FROM friendships f1
    WHERE f1.status = 'pending'
    AND EXISTS (
        SELECT 1 FROM friendships f2
        WHERE f2.status = 'accepted'
        AND (
            (f1.user_id_1 = f2.user_id_1 AND f1.user_id_2 = f2.user_id_2)
            OR
            (f1.user_id_1 = f2.user_id_2 AND f1.user_id_2 = f2.user_id_1)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Kör städningen direkt en gång.
SELECT clean_up_social_health();
