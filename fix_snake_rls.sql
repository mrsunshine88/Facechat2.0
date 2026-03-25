-- Ge Admins rättighet att radera fuskare eller nollställa Leaderboarden!
CREATE POLICY "Admins kan radera scores"
ON public.snake_scores
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
