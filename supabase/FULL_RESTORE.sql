-- ============================================================
-- BizReady 전체 DB 복구 스크립트
-- Supabase SQL Editor에서 전체 선택 후 실행 (Run All)
-- ============================================================

-- ① 기존 테이블 정리 (덮어쓰기 전 초기화)
DROP TABLE IF EXISTS public.payment_logs CASCADE;
DROP TABLE IF EXISTS public.user_notes CASCADE;
DROP TABLE IF EXISTS public.checklists CASCADE;
DROP TABLE IF EXISTS public.guides CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ============================================================
-- BizReady DB Schema
-- Supabase Dashboard > SQL Editor 에서 순서대로 실행하세요
-- ============================================================

-- ① user_profiles (auth.users와 1:1 연결)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
  plan_type   TEXT NOT NULL DEFAULT 'free',   -- 'free' | 'premium'
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ② guides (마스터 콘텐츠 — 관리자만 작성)
CREATE TABLE IF NOT EXISTS public.guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,                  -- '회계·세무' 등
  title       TEXT NOT NULL,
  summary     TEXT,                           -- 목록에서 보이는 한 줄 설명
  content     TEXT NOT NULL DEFAULT '',       -- Markdown 본문
  tags        TEXT[] NOT NULL DEFAULT '{}',   -- 검색용 태그
  is_premium  BOOLEAN NOT NULL DEFAULT FALSE, -- true = 유료 전용
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ③ user_notes (개인 메모 — 사용자별 격리)
CREATE TABLE IF NOT EXISTS public.user_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guide_id      UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  memo          TEXT NOT NULL DEFAULT '',
  is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, guide_id)  -- 가이드당 메모 1개
);

-- ④ checklists (입사 체크리스트 진행 상황)
CREATE TABLE IF NOT EXISTS public.checklists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,    -- 체크 항목 고유 키 (코드에서 정의)
  is_done    BOOLEAN NOT NULL DEFAULT FALSE,
  done_at    TIMESTAMPTZ,
  UNIQUE (user_id, item_key)
);

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_guides_category  ON public.guides(category);
CREATE INDEX IF NOT EXISTS idx_guides_tags      ON public.guides USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_notes_user  ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_guide ON public.user_notes(guide_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user  ON public.checklists(user_id);

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guides_updated
  BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_notes_updated
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 신규 가입 시 user_profiles 자동 생성 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS 정책
-- ============================================================
-- ============================================================
-- Row Level Security (RLS) 정책
-- 01_schema.sql 실행 후 이어서 실행하세요
-- ============================================================

-- RLS 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists     ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────
-- user_profiles 정책
-- ──────────────────────────────────────────
-- 본인 프로필만 읽기
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 본인 프로필 수정 (이름 등)
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 트리거가 INSERT 하므로 direct insert는 막음
-- (서버사이드 service_role 키로만 is_paid 업데이트 가능)

-- ──────────────────────────────────────────
-- guides 정책 (마스터 데이터)
-- ──────────────────────────────────────────
-- 로그인한 모든 사용자: 무료 가이드 읽기
CREATE POLICY "guides_select_free"
  ON public.guides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_premium = FALSE
  );

-- 유료 사용자: 프리미엄 가이드 읽기
CREATE POLICY "guides_select_premium"
  ON public.guides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND is_premium = TRUE
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_paid = TRUE
    )
  );

-- 쓰기는 service_role(관리자)만 가능 → 별도 정책 없음

-- ──────────────────────────────────────────
-- user_notes 정책
-- ──────────────────────────────────────────
CREATE POLICY "user_notes_select_own"
  ON public.user_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_notes_insert_own"
  ON public.user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_notes_update_own"
  ON public.user_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_notes_delete_own"
  ON public.user_notes FOR DELETE
  USING (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- checklists 정책
-- ──────────────────────────────────────────
CREATE POLICY "checklists_select_own"
  ON public.checklists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "checklists_insert_own"
  ON public.checklists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "checklists_update_own"
  ON public.checklists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "checklists_delete_own"
  ON public.checklists FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 결제 로그 테이블 (선택사항 — 결제 이력 추적용)
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id    TEXT NOT NULL UNIQUE,   -- 포트원 paymentId
  plan_id       TEXT NOT NULL,          -- 'monthly' | 'yearly'
  amount        INTEGER NOT NULL,       -- 결제 금액 (원)
  status        TEXT NOT NULL DEFAULT 'PAID',
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_user ON public.payment_logs(user_id);

-- RLS
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- 본인 결제 내역만 조회 가능
CREATE POLICY "payment_logs_select_own"
  ON public.payment_logs FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT는 service_role(서버)만 가능 → 별도 정책 없음

-- ============================================================
-- BizReady DB 업그레이드 v2.0
-- 파일 첨부 + 카테고리 재구성 + 스토리지 설정
-- Supabase SQL Editor에서 전체 실행
-- ============================================================

-- 1. guides 테이블에 파일 URL 컬럼 추가
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS file_url_1      TEXT,
  ADD COLUMN IF NOT EXISTS file_name_1     TEXT,
  ADD COLUMN IF NOT EXISTS file_url_2      TEXT,
  ADD COLUMN IF NOT EXISTS file_name_2     TEXT,
  ADD COLUMN IF NOT EXISTS file_url_3      TEXT,
  ADD COLUMN IF NOT EXISTS file_name_3     TEXT,
  ADD COLUMN IF NOT EXISTS subcategory     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS law_refs        JSONB DEFAULT '[]';

-- 2. user_profiles에 updated_at/updated_by 추가 (없는 경우)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by  TEXT DEFAULT '';

-- 3. payment_logs 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS payment_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  user_email  TEXT,
  payment_id  TEXT,
  plan_id     TEXT,
  amount      INTEGER,
  status      TEXT DEFAULT 'PAID',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. user_notes 테이블 (없는 경우)
CREATE TABLE IF NOT EXISTS user_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id),
  guide_id     UUID REFERENCES guides(id) ON DELETE CASCADE,
  memo         TEXT DEFAULT '',
  is_bookmarked BOOLEAN DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, guide_id)
);

-- 5. RLS 정책
ALTER TABLE guides       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- guides: 읽기는 모두 허용, 쓰기는 service_role만
DROP POLICY IF EXISTS "guides_select" ON guides;
CREATE POLICY "guides_select" ON guides FOR SELECT USING (true);

-- user_notes: 본인만 접근
DROP POLICY IF EXISTS "notes_own" ON user_notes;
CREATE POLICY "notes_own" ON user_notes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_profiles: 본인만 읽기/쓰기
DROP POLICY IF EXISTS "profiles_own" ON user_profiles;
CREATE POLICY "profiles_own" ON user_profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- payment_logs: service_role만 접근
DROP POLICY IF EXISTS "payments_service" ON payment_logs;
CREATE POLICY "payments_service" ON payment_logs
  USING (true)
  WITH CHECK (true);

-- 6. Storage 버킷 생성 (이미 있으면 무시됨)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guide-files',
  'guide-files',
  true,
  20971520,  -- 20MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520;

-- 7. Storage RLS
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'guide-files');

DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'guide-files');

DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'guide-files');

-- 8. calendar_events 테이블 (전사 일정 관리)
CREATE TABLE IF NOT EXISTS calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE,
  category    TEXT DEFAULT 'company',   -- tax, labor, company, team, exec
  note        TEXT DEFAULT '',
  created_by  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- calendar_events RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_select" ON calendar_events;
CREATE POLICY "calendar_select" ON calendar_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "calendar_insert" ON calendar_events;
CREATE POLICY "calendar_insert" ON calendar_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "calendar_delete" ON calendar_events;
CREATE POLICY "calendar_delete" ON calendar_events FOR DELETE USING (true);

-- 9. 기존 가이드 데이터 status 확인 및 업데이트
UPDATE guides SET status = 'published' WHERE status IS NULL;
UPDATE guides SET subcategory = '' WHERE subcategory IS NULL;

-- 10. 초기 캘린더 시드 이벤트 (회사 행사 예시)
INSERT INTO calendar_events (title, start_date, category, note, created_by) VALUES
  ('시무식', (DATE_TRUNC('year', NOW()) + INTERVAL '2 days')::DATE, 'company', '전사 시무식 행사', 'system'),
  ('상반기 워크숍', (DATE_TRUNC('year', NOW()) + INTERVAL '5 months' + INTERVAL '15 days')::DATE, 'team', '팀 빌딩 워크숍', 'system'),
  ('종무식', (DATE_TRUNC('year', NOW()) + INTERVAL '11 months' + INTERVAL '26 days')::DATE, 'company', '전사 종무식 행사', 'system')
ON CONFLICT DO NOTHING;

SELECT 'DB 업그레이드 v2.1 완료!' as result;
SELECT COUNT(*) as guide_count FROM guides;
SELECT COUNT(*) as calendar_events FROM calendar_events;

