create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  full_name text not null,
  age int,
  gender text,
  goal text,
  diet_type text,
  weight numeric,
  height numeric,
  workout_time text,
  created_at timestamptz default now()
);

create table if not exists progress_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  weight numeric,
  note text,
  created_at timestamptz default now()
);

create table if not exists diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  total_calories int not null,
  protein_g int not null,
  carbs_g int not null,
  fats_g int not null,
  water_liters numeric default 3,
  created_at timestamptz default now()
);
