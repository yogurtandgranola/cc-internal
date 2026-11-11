-- People management. A person created by the owner gets a temporary password and must change it at first sign-in.
alter table public.profiles add column if not exists must_change_password boolean not null default false;
