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
  -- Personal Details
  full_name text not null,
  age int,
  gender text,
  height numeric,
  weight numeric,
  body_fat_percentage numeric,
  -- Goal Assessment
  goal text,
  secondary_goals text[] default '{}',
  -- Medical Assessment
  medical_conditions text,
  medications text,
  allergies text,
  injuries text,
  surgeries text,
  -- Nutrition Assessment
  diet_type text,
  food_likes text,
  food_dislikes text,
  budget_per_meal numeric,
  water_intake_cups numeric,
  meal_frequency int,
  -- Training Assessment
  experience_level text,
  workout_days_per_week int,
  workout_duration_minutes int,
  equipment_available text,
  strength_levels text,
  mobility_issues text,
  -- Lifestyle Assessment
  occupation text,
  activity_level text,
  sleep_hours numeric,
  stress_level text,
  -- AI Engine calculated fields
  bmr numeric,
  tdee numeric,
  calorie_target int,
  protein_target_g int,
  carbs_target_g int,
  fat_target_g int,
  recovery_score int,
  training_volume_minutes int,
  workout_split text,
  plan_status text default 'assessment_pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
  supplement_notes text,
  status text default 'draft',
  trainer_notes text,
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references diet_plans(id) on delete cascade,
  name text not null,
  time_of_day text not null,
  foods text not null,
  quantities text,
  calories int not null,
  protein_g int not null,
  carbs_g int not null,
  fats_g int not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists workout_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  split_type text not null,
  days_per_week int not null,
  session_duration_minutes int,
  cardio_recommendation text,
  progression_plan text,
  status text default 'draft',
  trainer_notes text,
  version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workout_days (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null references workout_plans(id) on delete cascade,
  day_name text not null,
  focus text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  name text not null,
  sets int not null,
  reps text not null,
  rest_seconds int default 60,
  rpe numeric default 7,
  notes text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists progress_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  weight numeric,
  note text,
  created_at timestamptz default now()
);

create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  arms_cm numeric,
  thighs_cm numeric,
  body_fat_percentage numeric,
  notes text,
  measured_at timestamptz default now()
);

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  photo_url text not null,
  photo_type text default 'front',
  notes text,
  taken_at timestamptz default now()
);

create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  exercise_name text not null,
  sets_completed int,
  reps_completed int,
  weight_used numeric,
  rpe_actual numeric,
  notes text,
  logged_at timestamptz default now()
);

create table if not exists adherence_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  log_date date not null default current_date,
  diet_adherence int default 0,
  workout_adherence int default 0,
  water_cups numeric default 0,
  sleep_hours numeric,
  mood_score int,
  notes text,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  type text not null,
  title text not null,
  message text,
  channel text default 'in_app',
  status text default 'pending',
  sent_at timestamptz,
  created_at timestamptz default now()
);
