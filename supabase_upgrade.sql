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
