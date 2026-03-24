/**
 * BizReady 공통 사이드바 컴포넌트
 * 모든 페이지에서 동일한 구조와 상태를 유지
 *
 * 사용법:
 *   import { Sidebar } from '../lib/sidebar'
 *   <Sidebar userName="홍길동" userInitial="홍" isPaid={false} currentPath="/dashboard/archive" />
 *
 * currentPath 기준으로 active 상태 자동 결정
 */

export interface SidebarProps {
  userName: string
  userInitial: string
  isPaid: boolean
  /** 현재 경로 — active 클래스 자동 결정에 사용 */
  currentPath: string
}

// 아카이브 서브 카테고리
const ARCHIVE_SUBS = [
  { label: '세무/회계', cat: '세무회계',  icon: 'fa-calculator' },
  { label: '총무',     cat: '총무',       icon: 'fa-building' },
  { label: '인사/노무', cat: '인사노무',  icon: 'fa-users' },
]

/** active 여부 판단 헬퍼 */
function isActive(currentPath: string, href: string): boolean {
  if (href === '/dashboard') return currentPath === '/dashboard'
  return currentPath.startsWith(href)
}

/** 메뉴 링크 클래스 */
function menuCls(active: boolean): string {
  return active
    ? 'sidebar-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm cursor-pointer'
    : 'sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm cursor-pointer transition-all'
}

export function Sidebar({ userName, userInitial, isPaid, currentPath }: SidebarProps) {
  // 아카이브 메뉴가 열려있어야 하는지 (archive 또는 guide 하위 경로)
  const archiveOpen = currentPath.startsWith('/dashboard/archive') || currentPath.startsWith('/dashboard/guide')

  return (
    <aside class="w-64 sidebar-gradient flex flex-col flex-shrink-0 overflow-y-auto">

      {/* ── 로고 ── */}
      <div class="px-5 py-4 border-b border-white/10 flex-shrink-0">
        <a href="/dashboard" class="flex items-center gap-3 group">
          <div class="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <i class="fas fa-briefcase text-white text-sm"></i>
          </div>
          <div>
            <div class="text-white font-bold text-base leading-tight">BizReady</div>
            <div class="text-sky-300 text-xs">중소기업 경영지원 플랫폼</div>
          </div>
        </a>
      </div>

      {/* ── 사용자 프로필 ── */}
      <div class="px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div class="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
          <div class="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
            {userInitial}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white text-sm font-medium truncate">{userName}</div>
            <div class="flex items-center gap-1 mt-0.5">
              {isPaid
                ? <span class="text-amber-300 text-xs font-medium">💎 프리미엄</span>
                : <span class="text-sky-300 text-xs">무료 플랜</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── 네비게이션 ── */}
      <nav class="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">

        {/* 홈 */}
        <a href="/dashboard" class={menuCls(isActive(currentPath, '/dashboard'))}>
          <i class="fas fa-home w-4 text-center text-sm"></i>
          <span>홈</span>
        </a>

        {/* ────── [메인] 섹션 ────── */}
        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">메인</p>
        </div>

        {/* 업무 아카이브 (아코디언) */}
        <div>
          <button
            onclick="toggleArchiveMenu()"
            id="archive-menu-btn"
            class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${archiveOpen ? 'bg-white/15 text-white' : 'text-sky-200 hover:text-white hover:bg-white/10'}`}
          >
            <i class="fas fa-book-open w-4 text-center text-sm flex-shrink-0"></i>
            <span class="flex-1 text-left">업무 아카이브</span>
            <i id="archive-chevron" class={`fas fa-chevron-down text-xs transition-transform duration-200 ${archiveOpen ? 'rotate-180' : ''}`}></i>
          </button>

          {/* 서브 메뉴 */}
          <div
            id="archive-submenu"
            class={`overflow-hidden transition-all duration-200 ${archiveOpen ? '' : 'hidden'}`}
          >
            <div class="pl-4 pr-1 pt-1 pb-1 space-y-0.5">
              {ARCHIVE_SUBS.map(sub => {
                const href = `/dashboard/archive?cat=${encodeURIComponent(sub.cat)}`
                const subActive = currentPath.startsWith('/dashboard/archive') &&
                  (typeof globalThis !== 'undefined' ? false : false) // JS로 처리
                return (
                  <a
                    href={href}
                    class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sky-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <i class={`fas ${sub.icon} w-3.5 text-center opacity-70`}></i>
                    <span>{sub.label}</span>
                  </a>
                )
              })}
              <a href="/dashboard/archive" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sky-400 hover:text-white hover:bg-white/10 transition-all">
                <i class="fas fa-th-large w-3.5 text-center opacity-70"></i>
                <span>전체 보기</span>
              </a>
            </div>
          </div>
        </div>

        {/* 지식 검색 */}
        <a href="/dashboard/search" class={menuCls(isActive(currentPath, '/dashboard/search'))}>
          <i class="fas fa-search w-4 text-center text-sm"></i>
          <span>지식 검색</span>
        </a>

        {/* ────── [내 계정] 섹션 ────── */}
        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">내 계정</p>
        </div>

        {/* 체크리스트 */}
        <a href="/dashboard/checklist" class={menuCls(isActive(currentPath, '/dashboard/checklist'))}>
          <i class="fas fa-clipboard-check w-4 text-center text-sm"></i>
          <span>체크리스트</span>
        </a>

        {/* 사내 주요 일정 */}
        <a href="/dashboard/calendar" class={menuCls(isActive(currentPath, '/dashboard/calendar'))}>
          <i class="fas fa-calendar-alt w-4 text-center text-sm"></i>
          <span>사내 주요 일정</span>
        </a>

        {/* 내 메모 */}
        <a href="/dashboard/memo" class={menuCls(isActive(currentPath, '/dashboard/memo'))}>
          <i class="fas fa-sticky-note w-4 text-center text-sm"></i>
          <span>내 메모</span>
        </a>

        {/* ────── [설정] 섹션 ────── */}
        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">설정</p>
        </div>

        {/* 프리미엄 / 구독 관리 */}
        <a href="/dashboard/payment" class={menuCls(isActive(currentPath, '/dashboard/payment'))}>
          <i class={`fas ${isPaid ? 'fa-gem' : 'fa-crown'} w-4 text-center text-sm`}></i>
          <span>{isPaid ? '구독 관리' : '프리미엄'}</span>
          {!isPaid && (
            <span class="ml-auto text-xs bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium">UP</span>
          )}
        </a>

      </nav>

      {/* ── 로그아웃 ── */}
      <div class="px-3 pb-4 pt-2 flex-shrink-0 border-t border-white/10 mt-2">
        <form action="/auth/logout" method="POST">
          <button
            type="submit"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-300 hover:text-white hover:bg-white/10 text-sm transition-colors"
          >
            <i class="fas fa-sign-out-alt w-4 text-center"></i>
            <span>로그아웃</span>
          </button>
        </form>
      </div>

      {/* ── 사이드바 공통 스타일 + 아코디언 JS ── */}
      <style>{`
        .sidebar-gradient {
          background: linear-gradient(180deg, #1a3558 0%, #0f2340 60%, #0a1a30 100%);
        }
        .sidebar-section-label {
          color: rgba(148, 197, 233, 0.5);
          letter-spacing: 0.08em;
        }
        .sidebar-item { transition: all 0.15s ease; }
        .sidebar-item:hover { background: rgba(255,255,255,0.1); }
        .sidebar-item.active {
          background: rgba(255,255,255,0.15);
          box-shadow: inset 3px 0 0 rgba(147,197,253,0.7);
        }
        .rotate-180 { transform: rotate(180deg); }
        /* 스크롤바 숨김 */
        aside::-webkit-scrollbar { width: 3px; }
        aside::-webkit-scrollbar-track { background: transparent; }
        aside::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
(function() {
  // ── 아코디언: 업무 아카이브 ──────────────────────
  function toggleArchiveMenu() {
    const menu    = document.getElementById('archive-submenu');
    const chevron = document.getElementById('archive-chevron');
    const btn     = document.getElementById('archive-menu-btn');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isHidden);
    chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    btn.classList.toggle('bg-white/15', isHidden);
    btn.classList.toggle('text-white',  isHidden);
  }
  // 전역 노출
  window.toggleArchiveMenu = toggleArchiveMenu;

  // 현재 URL 기반 서브메뉴 active 표시
  (function highlightActive() {
    const path  = window.location.pathname;
    const query = window.location.search;
    const full  = path + query;

    // 서브 링크 active
    document.querySelectorAll('#archive-submenu a').forEach(function(link) {
      const href = link.getAttribute('href') || '';
      if (full === href || (href !== '/dashboard/archive' && full.startsWith(href.split('?')[0]) && full.includes(href.split('?')[1] || ''))) {
        link.classList.add('text-white', 'bg-white/15');
        link.classList.remove('text-sky-300');
      }
    });

    // 사이드바 전체 링크 active (쿼리 무시하고 pathname만 비교)
    document.querySelectorAll('aside a[href]').forEach(function(link) {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('/dashboard')) return;
      const hPath = href.split('?')[0];
      const isHome = hPath === '/dashboard';
      const match  = isHome ? path === '/dashboard' : path.startsWith(hPath);
      if (match && !link.closest('#archive-submenu')) {
        link.classList.add('active', 'text-white');
        link.classList.remove('text-sky-200', 'text-sky-300');
      }
    });
  })();
})();
      `}} />
    </aside>
  )
}
