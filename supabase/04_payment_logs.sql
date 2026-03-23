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
