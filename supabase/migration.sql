-- Execute este arquivo no SQL Editor do Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'solicitante' check (role in ('administrador','aprovador','solicitante'))
);

create table if not exists public.invoice_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  requester_name text not null,
  type text not null,
  origin text not null,
  customer_name text not null,
  customer_cnpj text not null,
  model text not null,
  series text not null,
  weight text not null,
  carrier_cnpj text,
  freight text not null,
  observation text,
  return_nf text,
  nf_number text,
  approval_status text not null default 'Pendente' check (approval_status in ('Pendente','Aprovada','Reprovada')),
  status text not null default 'Pendente' check (status in ('Pendente','Emitida','Reprovada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    case when lower(new.email) = 'financeiro@pontesmaquinas.com.br' then 'administrador' else 'solicitante' end
  )
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_request_status()
returns trigger language plpgsql as $$
begin
  if new.approval_status = 'Reprovada' then
    new.status := 'Reprovada';
  elsif coalesce(btrim(new.nf_number),'') <> '' then
    new.status := 'Emitida';
  else
    new.status := 'Pendente';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists request_status_trigger on public.invoice_requests;
create trigger request_status_trigger before insert or update on public.invoice_requests
for each row execute procedure public.set_request_status();

alter table public.profiles enable row level security;
alter table public.invoice_requests enable row level security;

create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated
using (auth.uid() = id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrador'))
with check (auth.uid() = id or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrador'));
create policy "admin can delete profiles" on public.profiles for delete to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrador') and id <> auth.uid());

create policy "authenticated can see requests" on public.invoice_requests for select to authenticated using (true);
create policy "authenticated can create requests" on public.invoice_requests for insert to authenticated
with check (requester_id=auth.uid());
create policy "request update" on public.invoice_requests for update to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('administrador','aprovador'))
  or requester_id=auth.uid()
)
with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('administrador','aprovador'))
  or requester_id=auth.uid()
);
create policy "delete requests" on public.invoice_requests for delete to authenticated
using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='administrador')
  or (requester_id=auth.uid() and status='Pendente')
);
