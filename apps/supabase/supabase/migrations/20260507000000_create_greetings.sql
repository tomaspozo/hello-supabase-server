-- Greetings table: localized "hello" variants used by the demo handler.
-- Demonstrates that ctx.supabaseAdmin (service_role) bypasses RLS, while the
-- publishable-key-scoped ctx.supabase cannot read this table.
create table public.greetings (
  id          uuid        primary key default gen_random_uuid(),
  language    text        not null,
  greeting    text        not null,
  created_at  timestamptz not null default now()
);

-- 1. Grant the privileges the role needs
grant select, insert, update, delete on public.greetings to service_role;

-- 2. Enable RLS
alter table public.greetings enable row level security;

-- 3. Policies
-- None, only service role can access this table

-- 4. Seed
insert into public.greetings (language, greeting) values
  ('English',    'Hello'),
  ('Spanish',    'Hola'),
  ('Catalan',    'Hola'),
  ('Hawaiian',   'Aloha'),
  ('French',     'Bonjour'),
  ('German',     'Hallo'),
  ('Italian',    'Ciao'),
  ('Portuguese', 'Olá'),
  ('Dutch',      'Hallo'),
  ('Japanese',   'こんにちは'),
  ('Mandarin',   '你好'),
  ('Korean',     '안녕하세요'),
  ('Russian',    'Привет'),
  ('Hindi',      'नमस्ते'),
  ('Arabic',     'مرحبا'),
  ('Greek',      'Γειά σου'),
  ('Hebrew',     'שלום'),
  ('Turkish',    'Merhaba'),
  ('Swahili',    'Jambo'),
  ('Vietnamese', 'Xin chào');
