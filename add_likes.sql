-- ============================================================
-- BizReady: 좋아요 기능 추가 마이그레이션
-- guides.id 타입: UUID
-- ============================================================

-- 1) guides 테이블에 like_count 컬럼 추가
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- 2) guide_likes 테이블 생성 (guide_id → UUID)
CREATE TABLE IF NOT EXISTS guide_likes (
  id         BIGSERIAL PRIMARY KEY,
  guide_id   UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guide_id, user_id)
);

-- 3) RLS 활성화
ALTER TABLE guide_likes ENABLE ROW LEVEL SECURITY;

-- 4) RLS 정책
CREATE POLICY "guide_likes_select" ON guide_likes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "guide_likes_insert" ON guide_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "guide_likes_delete" ON guide_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 5) 인덱스
CREATE INDEX IF NOT EXISTS idx_guide_likes_guide_id ON guide_likes(guide_id);
CREATE INDEX IF NOT EXISTS idx_guide_likes_user_id  ON guide_likes(user_id);
