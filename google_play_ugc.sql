-- tabell för blockeringar
create table if not exists public.user_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(blocker_id, blocked_id)
);

-- RLS för user_blocks
alter table public.user_blocks enable row level security;
create policy "Users can see their own blocks" on user_blocks for select using (auth.uid() = blocker_id);
create policy "Users can block others" on user_blocks for insert with check (auth.uid() = blocker_id);
create policy "Users can unblock others" on user_blocks for delete using (auth.uid() = blocker_id);

-- tabell för anmälningar / rapporter
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  item_type text not null, -- 'whiteboard', 'forum', 'guestbook', 'profile'
  item_id uuid, -- ID for the specific post/comment
  reason text not null,
  status text default 'open' not null, -- 'open', 'resolved', 'dismissed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS för reports (Bara den som skapar larmet kan se det de skapat, eller admins ser i en admin-vy via RPC/Service Role)
alter table public.reports enable row level security;
create policy "Users can submit reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "Users can view their own reports" on reports for select using (auth.uid() = reporter_id);
