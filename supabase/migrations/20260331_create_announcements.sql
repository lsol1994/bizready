-- ============================================================
-- 공지사항 테이블 생성
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

create table if not exists public.announcements (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  content    text        not null,
  is_public  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 활성화
alter table public.announcements enable row level security;

-- 공개 항목은 인증된 사용자 누구나 조회 가능
create policy "authenticated users can read public announcements"
  on public.announcements
  for select
  to authenticated
  using (is_public = true);

-- service_role (관리자)은 모든 작업 가능 (RLS 우회)
