/**
 * BizReady 공통 사이드바 컴포넌트 (모바일 반응형 포함)
 *
 * - 데스크탑(md+): 고정 사이드바 (w-64)
 * - 모바일: 숨김 + 햄버거 버튼으로 드로어 열기
 *
 * [수정 이력]
 * v3 - 2026-03-26: 업무 아카이브 아코디언 완전 재작성
 *   - data-sidebar 속성으로 데스크탑/모바일 구분
 *   - onclick 에서 this 대신 data-sidebar-id 기반 탐색
 *   - Tailwind '/' 클래스 classList.add 버그 → CSS custom class 방식 전환
 *   - <i> 자식요소 클릭 시 event.currentTarget 보장을 위해 inline onclick → addEventListener 방식
 */

export interface SidebarProps {
  userName: string
  userInitial: string
  isPaid: boolean
  currentPath: string
}

export interface MobileHeaderProps {
  userName: string
  userInitial: string
  title?: string
}

// 아카이브 서브 카테고리
const ARCHIVE_SUBS = [
  { label: '세무/회계', cat: '세무회계',  icon: 'fa-calculator' },
  { label: '총무',     cat: '총무',       icon: 'fa-building' },
  { label: '인사/노무', cat: '인사노무',  icon: 'fa-users' },
]

function isActive(currentPath: string, href: string): boolean {
  if (href === '/dashboard') return currentPath === '/dashboard'
  return currentPath.startsWith(href)
}

function menuCls(active: boolean): string {
  return active
    ? 'sidebar-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm cursor-pointer'
    : 'sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm cursor-pointer transition-all'
}

// ── 사이드바 내부 콘텐츠 (데스크탑 + 모바일 드로어 공용) ──
// sidebarId: 'desktop' | 'mobile' — 각 버튼/서브메뉴 고유 ID 생성에 사용
function SidebarContent({ userName, userInitial, isPaid, currentPath, sidebarId }: SidebarProps & { sidebarId: string }) {
  const archiveOpen = currentPath.startsWith('/dashboard/archive') || currentPath.startsWith('/dashboard/guide')

  // 각 사이드바 인스턴스마다 고유 ID
  const btnId     = `archive-btn-${sidebarId}`
  const submenuId = `archive-sub-${sidebarId}`
  const chevronId = `archive-chev-${sidebarId}`

  return (
    <>
      {/* 로고 */}
      <div class="px-5 py-4 border-b border-white/10 flex-shrink-0">
        <a href="/dashboard" class="flex items-center gap-3 group" onclick="closeMobileDrawer()">
          <div class="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <i class="fas fa-briefcase text-white text-sm"></i>
          </div>
          <div>
            <div class="text-white font-bold text-base leading-tight">BizReady</div>
            <div class="text-sky-300 text-xs">중소기업 경영지원 플랫폼</div>
          </div>
        </a>
      </div>

      {/* 사용자 프로필 */}
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

      {/* 네비게이션 */}
      <nav class="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">

        <a href="/dashboard" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard'))}>
          <i class="fas fa-home w-4 text-center text-sm"></i>
          <span>홈</span>
        </a>

        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">메인</p>
        </div>

        {/* 업무 아카이브 아코디언 */}
        <div class="archive-accordion-wrap">
          {/*
            ★ onclick="toggleArchiveMenu(this)" 제거 →
               JS에서 querySelectorAll + addEventListener 로 등록
               이유: <i> 자식 클릭 시 this가 <i>가 되어 버그 발생
          */}
          <button
            id={btnId}
            data-submenu={submenuId}
            data-chevron={chevronId}
            class={`archive-accordion-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all ${archiveOpen ? 'archive-btn-open text-white' : 'text-sky-200 hover:text-white'}`}
            type="button"
          >
            <i class="fas fa-book-open w-4 text-center text-sm flex-shrink-0 pointer-events-none"></i>
            <span class="flex-1 text-left pointer-events-none">업무 아카이브</span>
            <i
              id={chevronId}
              class={`fas fa-chevron-down text-xs transition-transform duration-200 pointer-events-none ${archiveOpen ? 'rotate-180' : ''}`}
            ></i>
          </button>
          <div
            id={submenuId}
            class={`overflow-hidden transition-all duration-200 ${archiveOpen ? '' : 'hidden'}`}
          >
            <div class="pl-4 pr-1 pt-1 pb-1 space-y-0.5">
              {ARCHIVE_SUBS.map(sub => (
                <a
                  href={`/dashboard/archive?cat=${encodeURIComponent(sub.cat)}`}
                  onclick="closeMobileDrawer()"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sky-300 hover:text-white hover:bg-white/10 transition-all"
                >
                  <i class={`fas ${sub.icon} w-3.5 text-center opacity-70`}></i>
                  <span>{sub.label}</span>
                </a>
              ))}
              <a href="/dashboard/archive" onclick="closeMobileDrawer()" class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sky-400 hover:text-white hover:bg-white/10 transition-all">
                <i class="fas fa-th-large w-3.5 text-center opacity-70"></i>
                <span>전체 보기</span>
              </a>
            </div>
          </div>
        </div>

        <a href="/dashboard/search" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/search'))}>
          <i class="fas fa-search w-4 text-center text-sm"></i>
          <span>지식 검색</span>
        </a>

        <a href="/dashboard/bookmark" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/bookmark'))}>
          <i class="fas fa-bookmark w-4 text-center text-sm"></i>
          <span>저장한 가이드</span>
        </a>

        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">내 계정</p>
        </div>

        <a href="/dashboard/checklist" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/checklist'))}>
          <i class="fas fa-clipboard-check w-4 text-center text-sm"></i>
          <span>체크리스트</span>
        </a>

        <a href="/dashboard/calendar" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/calendar'))}>
          <i class="fas fa-calendar-alt w-4 text-center text-sm"></i>
          <span>사내 주요 일정</span>
        </a>

        <a href="/dashboard/memo" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/memo'))}>
          <i class="fas fa-sticky-note w-4 text-center text-sm"></i>
          <span>내 메모</span>
        </a>

        <div class="pt-3 pb-1">
          <p class="sidebar-section-label px-2 text-xs font-semibold uppercase tracking-widest">설정</p>
        </div>

        <a href="/dashboard/settings" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/settings'))}>
          <i class="fas fa-bell w-4 text-center text-sm"></i>
          <span>알림 설정</span>
        </a>

        <a href="/dashboard/payment" onclick="closeMobileDrawer()" class={menuCls(isActive(currentPath, '/dashboard/payment'))}>
          <i class={`fas ${isPaid ? 'fa-gem' : 'fa-crown'} w-4 text-center text-sm`}></i>
          <span>{isPaid ? '구독 관리' : '프리미엄'}</span>
          {!isPaid && (
            <span class="ml-auto text-xs bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium">UP</span>
          )}
        </a>

      </nav>

      {/* 로그아웃 */}
      <div class="px-3 pb-4 pt-2 flex-shrink-0 border-t border-white/10 mt-2">
        <form action="/auth/logout" method="POST">
          <button type="submit" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-300 hover:text-white hover:bg-white/10 text-sm transition-colors">
            <i class="fas fa-sign-out-alt w-4 text-center"></i>
            <span>로그아웃</span>
          </button>
        </form>
      </div>
    </>
  )
}

// ── 메인 Sidebar 컴포넌트 ──────────────────────────────────
export function Sidebar({ userName, userInitial, isPaid, currentPath }: SidebarProps) {
  return (
    <>
      {/* ── 데스크탑 사이드바 (md 이상에서만 표시) ── */}
      <aside id="desktop-sidebar" class="hidden md:flex w-64 sidebar-gradient flex-col flex-shrink-0 overflow-y-auto">
        <SidebarContent userName={userName} userInitial={userInitial} isPaid={isPaid} currentPath={currentPath} sidebarId="desktop" />
      </aside>

      {/* ── 모바일 드로어 오버레이 (md 미만에서만 동작) ── */}
      <div
        id="mobile-overlay"
        onclick="closeMobileDrawer()"
        class="fixed inset-0 bg-black/50 z-40 hidden md:hidden transition-opacity duration-300"
      ></div>

      {/* ── 모바일 드로어 사이드바 ── */}
      <aside
        id="mobile-drawer"
        class="fixed top-0 left-0 h-full w-72 sidebar-gradient flex flex-col z-50 transform -translate-x-full transition-transform duration-300 ease-in-out md:hidden overflow-y-auto"
      >
        {/* 드로어 닫기 버튼 */}
        <button
          onclick="closeMobileDrawer()"
          class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
          type="button"
        >
          <i class="fas fa-times text-sm"></i>
        </button>
        <SidebarContent userName={userName} userInitial={userInitial} isPaid={isPaid} currentPath={currentPath} sidebarId="mobile" />
      </aside>

      {/* ── 공통 스타일 + JS ── */}
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
        /* 아코디언 버튼 열림 상태 — Tailwind 슬래시 클래스 JS 조작 불가 문제 우회 */
        .archive-accordion-btn.archive-btn-open {
          background: rgba(255,255,255,0.15);
        }
        .archive-accordion-btn:not(.archive-btn-open):hover {
          background: rgba(255,255,255,0.10);
        }
        .rotate-180 { transform: rotate(180deg); }
        aside::-webkit-scrollbar { width: 3px; }
        aside::-webkit-scrollbar-track { background: transparent; }
        aside::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        /* 모바일 드로어 열림 상태 */
        #mobile-drawer.drawer-open {
          transform: translateX(0);
        }
        #mobile-overlay.overlay-show {
          display: block !important;
        }
        body.drawer-active {
          overflow: hidden;
        }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
(function() {

  /* ── 모바일 드로어 열기/닫기 ── */
  window.openMobileDrawer = function() {
    var drawer  = document.getElementById('mobile-drawer');
    var overlay = document.getElementById('mobile-overlay');
    if (!drawer) return;
    drawer.classList.add('drawer-open');
    if (overlay) overlay.classList.add('overlay-show');
    document.body.classList.add('drawer-active');
  };
  window.closeMobileDrawer = function() {
    var drawer  = document.getElementById('mobile-drawer');
    var overlay = document.getElementById('mobile-overlay');
    if (!drawer) return;
    drawer.classList.remove('drawer-open');
    if (overlay) overlay.classList.remove('overlay-show');
    document.body.classList.remove('drawer-active');
  };

  /* ── 업무 아카이브 아코디언 — addEventListener 방식 ──
     이유: onclick="fn(this)" 에서 자식 <i> 클릭 시 this = <i> 가 돼서
           parentElement 탐색이 엉킴. currentTarget은 항상 버튼 자신을 가리킴.
     각 버튼마다 data-submenu / data-chevron 속성으로 타겟 ID를 명시해 둠.
  */
  function initArchiveAccordion() {
    var btns = document.querySelectorAll('.archive-accordion-btn');
    btns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        // currentTarget = 항상 이벤트를 등록한 버튼 자신
        var button    = e.currentTarget;
        var submenuId = button.getAttribute('data-submenu');
        var chevronId = button.getAttribute('data-chevron');
        var submenu   = submenuId ? document.getElementById(submenuId) : null;
        var chevron   = chevronId ? document.getElementById(chevronId) : null;

        if (!submenu) return;

        var isHidden = submenu.classList.contains('hidden');

        if (isHidden) {
          /* 열기 */
          submenu.classList.remove('hidden');
          button.classList.add('archive-btn-open', 'text-white');
          button.classList.remove('text-sky-200');
          if (chevron) chevron.classList.add('rotate-180');
        } else {
          /* 닫기 */
          submenu.classList.add('hidden');
          button.classList.remove('archive-btn-open', 'text-white');
          button.classList.add('text-sky-200');
          if (chevron) chevron.classList.remove('rotate-180');
        }
      });
    });
  }

  /* ── 현재 URL 기반 active 하이라이트 ── */
  function highlightActive() {
    var path  = window.location.pathname;
    var query = window.location.search;
    var full  = path + query;

    /* 아카이브 서브메뉴 active */
    document.querySelectorAll('[id^="archive-sub-"] a').forEach(function(link) {
      var href = link.getAttribute('href') || '';
      var hPath = href.split('?')[0];
      var hQuery = href.split('?')[1] || '';
      if (full === href ||
          (href !== '/dashboard/archive' && path.startsWith(hPath) && (!hQuery || full.includes(hQuery)))) {
        link.classList.add('text-white', 'bg-white/15');
        link.classList.remove('text-sky-300');
      }
    });

    /* 일반 사이드바 링크 active */
    document.querySelectorAll('aside a[href]').forEach(function(link) {
      var href = link.getAttribute('href') || '';
      if (!href.startsWith('/dashboard')) return;
      var hPath = href.split('?')[0];
      var isHome = hPath === '/dashboard';
      var match  = isHome ? path === '/dashboard' : path.startsWith(hPath);
      if (match && !link.closest('[id^="archive-sub-"]')) {
        link.classList.add('active', 'text-white');
        link.classList.remove('text-sky-200', 'text-sky-300');
      }
    });
  }

  /* ── ESC 키로 드로어 닫기 ── */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeMobileDrawer();
  });

  /* ── DOM 준비 후 초기화 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initArchiveAccordion();
      highlightActive();
    });
  } else {
    initArchiveAccordion();
    highlightActive();
  }

})();
      `}} />
    </>
  )
}

// ── 모바일 상단 햄버거 버튼 ───────────────────────────────
export function MobileMenuButton() {
  return (
    <button
      onclick="openMobileDrawer()"
      class="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors mr-1"
      aria-label="메뉴 열기"
      type="button"
    >
      <i class="fas fa-bars text-gray-600 text-lg"></i>
    </button>
  )
}
