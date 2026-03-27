/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // [디자인 가이드 적용] 이미지에서 추출한 핵심 색상 팔레트
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#3b82f6', // 기본 포인트 블루 (구글 버튼, 아이콘)
          900: '#1d4ed8', // 메인 다크 블루 (BizReady 로고 및 핵심 색상)
        },
        sidebar: {
          bg: '#1e3a8a', // 사이드바용 다크 블루/그레이
          active: '#2b6cb0', // 활성화된 메뉴용 배경색 (홈 메뉴 배경)
          text: '#a3bffa', // 비활성화된 메뉴 텍스트색
        },
        accent: {
          yellow: {
            bg: '#fef3c7', // 대시보드 배너 배경색
            text: '#b45309', // 대시보드 배너 텍스트색
            badge: '#f59e0b', // UP 뱃지 등 포인트 옐로우
          },
          red: {
            text: '#ef4444', // D-Day 빨간색 텍스트
            tag: '#fecaca', // 재무/세금 태그 배경색
          },
        },
        text: {
          primary: '#1e293b', // 주요 텍스트색 (제목, 주요 내용)
          secondary: '#475569', // 보조 텍스트색 (설명, 카운트)
          light: '#94a3b8', // 아주 연한 텍스트색 (플레이스홀더)
        },
        border: {
          card: '#e2e8f0', // 카드 및 구분선용 연한 그레이
        },
      },
      borderRadius: {
        // [UI 특성 반영] 이미지의 둥근 모서리 디자인 적용
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        // [UI 특성 반영] 깔끔한 느낌을 위한 부드러운 그림자 효과
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
