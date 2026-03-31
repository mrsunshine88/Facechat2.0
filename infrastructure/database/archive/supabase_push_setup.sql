-- 1. Create the table for storing Web Push Subscriptions
CREATE TABLE public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    auth TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(endpoint)
);

-- 2. Turn on RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Policy: User can read their own subscriptions
CREATE POLICY "Users can read their own push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: User can insert their own subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Policy: User can delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- 6. Policy: Service Role (API) can do everything
CREATE POLICY "Service Role can manage all push subscriptions"
ON public.push_subscriptions USING (true);
