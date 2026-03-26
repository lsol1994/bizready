-- ============================================================
-- BizReady: user_settings 테이블 생성
-- 알림 설정 (카테고리별/일수별/방해금지 기간)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 카테고리별 알림 ON/OFF
  notify_finance      BOOLEAN NOT NULL DEFAULT true,   -- 세무/재무 알림
  notify_labor        BOOLEAN NOT NULL DEFAULT true,   -- 노무/4대보험 알림
  notify_general      BOOLEAN NOT NULL DEFAULT true,   -- 총무/행정 알림

  -- 일수별 알림 ON/OFF (D-7, D-3, D-1, D-0)
  notify_d7           BOOLEAN NOT NULL DEFAULT true,
  notify_d3           BOOLEAN NOT NULL DEFAULT true,
  notify_d1           BOOLEAN NOT NULL DEFAULT true,
  notify_d0           BOOLEAN NOT NULL DEFAULT true,

  -- 방해금지 기간 (해당 기간 내 알림 차단)
  dnd_start           DATE,
  dnd_end             DATE,

  -- 전체 이메일 알림 ON/OFF
  email_reminder      BOOLEAN NOT NULL DEFAULT true,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 본인 설정만 조회/수정 가능
CREATE POLICY "user_settings_select" ON user_settings
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "user_settings_insert" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_settings_update" ON user_settings
  FOR UPDATE USING (auth.uid() = id);

-- service_role은 전체 접근 (리마인더 발송 시 사용)
CREATE POLICY "user_settings_admin" ON user_settings
  FOR ALL USING (true);
