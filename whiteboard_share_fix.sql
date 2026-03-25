-- Whiteboard Facebook Share Support
-- Adds parent_id to allow nested sharing and sharing statistics.

ALTER TABLE public.whiteboard ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.whiteboard(id) ON DELETE SET NULL;
ALTER TABLE public.whiteboard ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- Trigger to increment share count on the original post when shared
CREATE OR REPLACE FUNCTION public.increment_share_count()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE public.whiteboard SET shares_count = shares_count + 1 WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_whiteboard_share ON public.whiteboard;
CREATE TRIGGER on_whiteboard_share
  AFTER INSERT ON public.whiteboard
  FOR EACH ROW EXECUTE PROCEDURE public.increment_share_count();
