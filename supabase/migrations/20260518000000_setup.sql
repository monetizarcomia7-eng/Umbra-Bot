-- ============================================================
-- Umbra Bot — Setup inicial
-- Extensão pgcrypto + função set_updated_at compartilhada
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
