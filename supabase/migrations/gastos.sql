-- ============================================================
-- MÓDULO FINANZAS · ELROJO.3D
-- Tabla de gastos operativos + políticas de acceso.
-- Ejecutar en Supabase: SQL Editor (o dashboard).
-- Requiere que ya exista la tabla public.usuarios (con columna rol).
-- ============================================================

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null,
  monto numeric not null default 0 check (monto >= 0),
  fecha date not null default current_date,
  categoria text,
  metodo_pago text,
  notas text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índice para filtrar por fecha
create index if not exists gastos_fecha_idx on public.gastos (fecha desc);

-- ============================================================
-- Seguridad (Row Level Security)
-- Ventas y Administrador registran y leen.
-- Solo Administrador elimina.
-- ============================================================

alter table public.gastos enable row level security;

drop policy if exists "Finanzas: leer gastos" on public.gastos;
create policy "Finanzas: leer gastos"
  on public.gastos for select
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.rol in ('Administrador', 'Ventas')
    )
  );

drop policy if exists "Finanzas: insertar gastos" on public.gastos;
create policy "Finanzas: insertar gastos"
  on public.gastos for insert
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.rol in ('Administrador', 'Ventas')
    )
  );

drop policy if exists "Finanzas: eliminar gastos" on public.gastos;
create policy "Finanzas: eliminar gastos"
  on public.gastos for delete
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.rol = 'Administrador'
    )
  );
