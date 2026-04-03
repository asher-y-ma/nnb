create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_type text not null default 'gemini',
  base_url text not null default 'https://newapi.dituhuoke.com/',
  api_key_ciphertext text,
  default_image_model text not null default 'gemini-3.1-flash-image-preview',
  hq_image_model text not null default 'gemini-3-pro-image-preview',
  default_text_model text not null default 'gemini-3-flash-preview',
  default_aspect_ratio text not null default '3:4',
  default_image_size text not null default '1K',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_profiles
  add column if not exists base_url text not null default 'https://newapi.dituhuoke.com/';

alter table public.provider_profiles
  alter column default_image_model set default 'gemini-3.1-flash-image-preview';

alter table public.provider_profiles
  alter column hq_image_model set default 'gemini-3-pro-image-preview';

create unique index if not exists provider_profiles_user_provider_idx
  on public.provider_profiles (user_id, provider_type);

create table if not exists public.prompt_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  module text not null,
  name text not null,
  body text not null,
  platform text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  module text not null,
  status text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  local_cache_key text,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.studio_jobs (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.prompt_presets enable row level security;
alter table public.studio_jobs enable row level security;
alter table public.job_events enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() is not null and auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() is not null and auth.uid() = id);

create policy "provider_profiles_all_own"
on public.provider_profiles for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "prompt_presets_all_own"
on public.prompt_presets for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "studio_jobs_all_own"
on public.studio_jobs for all
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "job_events_select_own"
on public.job_events for select
to authenticated
using (
  exists (
    select 1
    from public.studio_jobs
    where public.studio_jobs.id = public.job_events.job_id
      and auth.uid() is not null
      and auth.uid() = public.studio_jobs.user_id
  )
);
