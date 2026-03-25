-- Skapa tabellen för Snake Highscores
CREATE TABLE public.snake_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tillåt alla inloggade användare att kunna läsa highscores
CREATE POLICY "Enable read access for all users" ON public.snake_scores
    FOR SELECT USING (true);

-- Tillåt inloggade användare att skicka in sina egna poäng
CREATE POLICY "Enable insert for authenticated users only" ON public.snake_scores
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Aktivera Row Level Security (REST)
ALTER TABLE public.snake_scores ENABLE ROW LEVEL SECURITY;

-- Vi kan skapa ett index så det går snabbt att sortera topp 5
CREATE INDEX idx_snake_scores_score ON public.snake_scores (score DESC);
