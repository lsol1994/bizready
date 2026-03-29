-- 체크리스트 커스텀 항목 레이블 컬럼 추가
-- 고정 항목은 NULL (레이블이 코드에 정의됨)
-- 커스텀 항목(item_key LIKE 'custom_%')은 사용자가 입력한 텍스트를 저장
ALTER TABLE public.checklists
  ADD COLUMN IF NOT EXISTS label TEXT;
