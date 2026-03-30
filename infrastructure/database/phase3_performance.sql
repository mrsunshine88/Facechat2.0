-- ==========================================
-- PHASE 3: PERFORMANCE & SCALABILITY
-- 1. Update get_newsfeed to support pagination
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_newsfeed(viewer_id UUID, limit_val INT DEFAULT 15, offset_val INT DEFAULT 0)
RETURNS SETOF public.whiteboard AS $$
DECLARE
  friend_ids UUID[];
BEGIN
  -- 1. Hämta en array av alla användarens accepterade vänner
  SELECT array_agg(CASE 
        WHEN user_id_1 = viewer_id THEN user_id_2 
        ELSE user_id_1 END)
  INTO friend_ids
  FROM public.friendships
  WHERE (user_id_1 = viewer_id OR user_id_2 = viewer_id) AND status = 'accepted';

  -- Säkerställ friend_ids inte är null
  IF friend_ids IS NULL THEN
     friend_ids := ARRAY[]::UUID[];
  END IF;

  RETURN QUERY
  SELECT w.*
  FROM public.whiteboard w
  WHERE 
    -- Mina inlägg
    w.author_id = viewer_id 
    OR 
    -- Mina vänners inlägg
    w.author_id = ANY(friend_ids)
    OR
    -- Inlägg (av okända) som mina vänner har GILLAT
    EXISTS (
      SELECT 1 FROM public.whiteboard_likes wl
      WHERE wl.post_id = w.id AND wl.user_id = ANY(friend_ids)
    )
    OR
    -- Inlägg (av okända) som mina vänner har KOMMENTERAT
    EXISTS (
      SELECT 1 FROM public.whiteboard_comments wc
      WHERE wc.post_id = w.id AND wc.author_id = ANY(friend_ids)
    )
  ORDER BY w.created_at DESC
  LIMIT limit_val OFFSET offset_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
