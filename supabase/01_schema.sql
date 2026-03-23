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
