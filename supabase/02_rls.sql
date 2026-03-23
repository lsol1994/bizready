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
