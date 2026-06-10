-- Copia y pega esto en el SQL Editor de Supabase y dale a RUN

-- 1. Tabla de Empleados
create table if not exists workforce_employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text default 'Operario', -- 'Administrador' o 'Operario'
  pin text not null, -- Para el login inicial
  created_at timestamp with time zone default now()
);

-- 2. Tabla de Asistencia (Entradas y Salidas)
create table if not exists workforce_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references workforce_employees not null,
  clock_in timestamp with time zone not null default now(),
  clock_out timestamp with time zone,
  status text default 'Trabajando', -- 'Trabajando' o 'Completado'
  created_at timestamp with time zone default now()
);

-- 3. Tabla de Horarios (Turnos programados)
create table if not exists workforce_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references workforce_employees not null,
  date date not null,
  shift_type text not null, 
  start_time time not null,
  end_time time not null,
  created_at timestamp with time zone default now(),
  unique(employee_id, date)
);

-- Desactivamos RLS temporalmente
alter table workforce_employees disable row level security;
alter table workforce_attendance disable row level security;
alter table workforce_schedules disable row level security;

-- Insertar un empleado administrador de prueba
-- insert into workforce_employees (name, role, pin) values ('Diego Bedoya', 'Administrador', '1234');
