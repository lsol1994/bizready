#!/usr/bin/env python3
"""
BizReady Post-Deploy 자동화 스크립트
======================================
테스트 완료 후 실행하면:
  1. Notion 각 페이지 자동 업데이트 (개발일정 DB + 진행사항 페이지)
  2. GitHub push (main 브랜치)
  3. 테스트 체크리스트 출력 (직접 확인용 링크 포함)

사용법:
  python3 scripts/post-deploy.py \
    --feature "비밀번호 재설정 기능" \
    --path "/reset-password" \
    --desc "새 비밀번호 입력 페이지 + auth 콜백 recovery 처리" \
    --test-urls "/login,/reset-password" \
    --commit-msg "feat: 비밀번호 재설정 기능 구현"
"""

import argparse
import json
import subprocess
import sys
import os
from datetime import datetime, timezone, timedelta

# ─── 설정값 ───────────────────────────────────────────────
NOTION_TOKEN   = "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"
GITHUB_REMOTE  = "origin"
GITHUB_BRANCH  = "main"
PROD_URL       = "https://bizready.pages.dev"

# Notion 페이지/DB ID
NOTION_IDS = {
    "dev_schedule_db":  "32ee3dd0-ca75-81b0-afc5-e435011195ca",  # BizReady 개발 일정 DB
    "calendar_db":      "32ee3dd0-ca75-8153-8514-d1a566d3366d",  # BizReady 개발일정 캘린더
    "progress_page":    "32ee3dd0-ca75-8107-8dc6-ec433f3ce998",  # 개발 진행사항 & 남은 과제
    "recovery_page":    "32ee3dd0-ca75-81f3-a72b-ff4c3f58c52a",  # 프로젝트 복구 가이드
}

KST = timezone(timedelta(hours=9))

# ─── 유틸 함수 ────────────────────────────────────────────
def print_header(text):
    print(f"\n{'='*55}")
    print(f"  {text}")
    print(f"{'='*55}")

def print_step(emoji, text):
    print(f"\n{emoji}  {text}")

def print_ok(text):
    print(f"   ✅ {text}")

def print_err(text):
    print(f"   ❌ {text}")

def print_info(text):
    print(f"   ℹ️  {text}")

def notion_request(method, endpoint, payload=None):
    """Notion API 공통 요청 함수"""
    url = f"https://api.notion.com/v1/{endpoint}"
    cmd = [
        "curl", "-s", f"-X{method}", url,
        "-H", f"Authorization: Bearer {NOTION_TOKEN}",
        "-H", "Content-Type: application/json",
        "-H", "Notion-Version: 2022-06-28",
    ]
    if payload:
        cmd += ["-d", json.dumps(payload)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return {"error": result.stdout}

def run_cmd(cmd, desc=""):
    """쉘 커맨드 실행"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/user/webapp")
    return result.returncode == 0, result.stdout.strip(), result.stderr.strip()

# ─── STEP 1: Notion 개발일정 DB 업데이트 ──────────────────
def update_notion_schedule_db(feature, desc, today_str):
    """개발 일정 DB + 캘린더 DB 양쪽에 완료 항목 추가"""
    print_step("📅", "Notion 개발일정 DB 업데이트 중...")

    payload = {
        "parent": {"database_id": NOTION_IDS["dev_schedule_db"]},
        "properties": {
            "일정": {"title": [{"text": {"content": feature}}]},
            "날짜": {"date": {"start": today_str}},
            "상태": {"status": {"name": "완료"}},
            "카테고리": {"select": {"name": "✅ 완료"}},
            "피드백": {"rich_text": [{"text": {"content": desc}}]},
        }
    }
    data = notion_request("POST", "pages", payload)
    if "id" in data:
        print_ok(f"개발 일정 DB 추가 완료 (ID: {data['id'][:8]}...)")
    else:
        print_err(f"개발 일정 DB 실패: {data.get('message', str(data))}")

    # 캘린더 DB에도 동일 항목 추가
    payload2 = {
        "parent": {"database_id": NOTION_IDS["calendar_db"]},
        "properties": {
            "일정": {"title": [{"text": {"content": feature}}]},
            "날짜": {"date": {"start": today_str}},
            "상태": {"status": {"name": "완료"}},
            "카테고리": {"select": {"name": "✅ 완료"}},
            "피드백": {"rich_text": [{"text": {"content": desc}}]},
        }
    }
    data2 = notion_request("POST", "pages", payload2)
    if "id" in data2:
        print_ok(f"개발일정 캘린더 DB 추가 완료")
    else:
        print_err(f"캘린더 DB 실패: {data2.get('message', str(data2))}")

# ─── STEP 2: Notion 진행사항 페이지에 완료 항목 추가 ───────
def update_notion_progress_page(feature, path, desc, today_str, commit_hash):
    """개발 진행사항 페이지 상단에 최신 완료 항목 블록 추가"""
    print_step("📝", "Notion 개발 진행사항 페이지 업데이트 중...")

    # 기존 블록의 맨 앞에 새 내용 추가 (append_block_children는 맨 뒤에만 추가 가능)
    # → 실용적으로 맨 뒤에 추가 (최신순 정렬은 Notion에서 수동으로)
    blocks = [
        {
            "object": "block",
            "type": "divider",
            "divider": {}
        },
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content":
                    f"✅ [{today_str}] {feature} — 배포 완료\n"
                    f"경로: {path}\n"
                    f"커밋: {commit_hash}\n"
                    f"내용: {desc}"
                }}],
                "icon": {"emoji": "🚀"},
                "color": "green_background"
            }
        }
    ]

    data = notion_request(
        "PATCH",
        f"blocks/{NOTION_IDS['progress_page']}/children",
        {"children": blocks}
    )
    if "results" in data:
        print_ok("진행사항 페이지 업데이트 완료")
    else:
        print_err(f"진행사항 페이지 실패: {data.get('message', str(data))}")

# ─── STEP 3: GitHub Push ──────────────────────────────────
def push_to_github(commit_msg):
    """변경사항 git add → commit → push"""
    print_step("🐙", "GitHub push 중...")

    # git status 확인
    ok, stdout, _ = run_cmd("git status --porcelain")
    if stdout:
        # 커밋할 변경사항 있음
        run_cmd("git add -A")
        ok, out, err = run_cmd(f'git commit -m "{commit_msg}"')
        if ok:
            print_ok(f"커밋 완료: {commit_msg}")
        else:
            # 이미 커밋된 경우 (nothing to commit)
            print_info("커밋할 변경사항 없음 (이미 커밋됨)")
    else:
        print_info("워킹 디렉토리 클린 — 추가 커밋 없음")

    # push
    ok, out, err = run_cmd(f"git push {GITHUB_REMOTE} {GITHUB_BRANCH}")
    if ok:
        print_ok(f"GitHub push 완료 → https://github.com/lsol1994/bizready")
    else:
        # 이미 최신인 경우도 성공으로 처리
        if "Everything up-to-date" in err or "up-to-date" in out:
            print_ok("GitHub 이미 최신 상태")
        else:
            print_err(f"GitHub push 실패: {err}")

    # 최신 커밋 해시 반환
    _, commit_hash, _ = run_cmd("git rev-parse --short HEAD")
    return commit_hash

# ─── STEP 4: 테스트 체크리스트 출력 ──────────────────────
def print_test_checklist(feature, test_urls_str, today_str, commit_hash):
    """직접 테스트해볼 수 있는 체크리스트 출력"""
    print_header(f"🧪 테스트 체크리스트 — {feature}")

    urls = [u.strip() for u in test_urls_str.split(",") if u.strip()]

    print(f"\n  📅 배포일시: {today_str} (KST)")
    print(f"  🔖 커밋:     {commit_hash}")
    print(f"  🌐 프로덕션: {PROD_URL}")
    print(f"  🐙 GitHub:   https://github.com/lsol1994/bizready/commit/{commit_hash}")
    print()
    print("  ─── 직접 열어보실 테스트 URL ───────────────────────")
    for i, path in enumerate(urls, 1):
        full_url = PROD_URL + path if path.startswith("/") else path
        print(f"  {i}. {full_url}")

    print()
    print("  ─── 기능 테스트 체크리스트 ─────────────────────────")

    # URL 기반으로 체크리스트 자동 생성
    checklist = generate_checklist(feature, urls)
    for i, item in enumerate(checklist, 1):
        print(f"  {i}. □ {item}")

    print()
    print("  ─── 노션 업데이트 확인 ──────────────────────────────")
    print(f"  • 개발 일정 DB   → https://www.notion.so/{NOTION_IDS['dev_schedule_db'].replace('-','')}")
    print(f"  • 진행사항 페이지 → https://www.notion.so/{NOTION_IDS['progress_page'].replace('-','')}")
    print()
    print("=" * 55)
    print("  이상 없으면 다음 작업을 시작하세요! 🚀")
    print("=" * 55)

def generate_checklist(feature, urls):
    """기능명과 URL을 바탕으로 체크리스트 항목 자동 생성"""
    items = []
    for path in urls:
        items.append(f"페이지 정상 로드 확인: {path}")

    # 기능명 키워드 기반 추가 항목
    kw = feature.lower()
    if "비밀번호" in kw or "reset" in kw or "password" in kw:
        items += [
            "로그인 페이지 '비밀번호 찾기' 클릭 → 모달 정상 표시",
            "이메일 입력 후 '전송' → '재설정 링크를 이메일로 전송했습니다' 메시지 확인",
            "이메일함에서 재설정 링크 클릭 → /reset-password 로 이동 확인",
            "새 비밀번호 입력 (8자 이상) → 강도 표시바 작동 확인",
            "비밀번호 확인 입력 불일치 시 경고 메시지 표시 확인",
            "'비밀번호 변경하기' 클릭 → 완료 메시지 후 /login 이동 확인",
            "변경된 새 비밀번호로 로그인 성공 확인",
        ]
    elif "모바일" in kw or "반응형" in kw:
        items += [
            "모바일 화면(375px)에서 햄버거 메뉴 표시 확인",
            "메뉴 클릭 시 사이드바 열림/닫힘 동작 확인",
            "태블릿 화면(768px) 레이아웃 확인",
        ]
    elif "대시보드" in kw or "dashboard" in kw:
        items += [
            "세무일정 위젯 데이터 정상 표시 확인",
            "공지사항 섹션 표시 확인",
        ]
    elif "캘린더" in kw or "calendar" in kw:
        items += [
            "캘린더 뷰 정상 렌더링 확인",
            "일정 추가/수정/삭제 동작 확인",
        ]
    elif "검색" in kw or "search" in kw:
        items += [
            "검색어 입력 시 결과 표시 확인",
            "빈 검색 결과 처리 확인",
        ]
    else:
        items += [
            "핵심 기능 동작 확인",
            "에러 케이스 처리 확인",
            "모바일 화면에서도 정상 표시 확인",
        ]

    return items

# ─── 메인 실행 ────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="BizReady Post-Deploy 자동화 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python3 scripts/post-deploy.py \\
    --feature "비밀번호 재설정 기능" \\
    --path "/reset-password" \\
    --desc "새 비밀번호 입력 페이지 구현" \\
    --test-urls "/login,/reset-password" \\
    --commit-msg "feat: 비밀번호 재설정 기능 구현"
        """
    )
    parser.add_argument("--feature",    required=True, help="기능명 (예: 비밀번호 재설정 기능)")
    parser.add_argument("--path",       required=True, help="주요 경로 (예: /reset-password)")
    parser.add_argument("--desc",       required=True, help="상세 설명")
    parser.add_argument("--test-urls",  required=True, help="테스트 URL 목록 (콤마 구분, 예: /login,/reset-password)")
    parser.add_argument("--commit-msg", required=True, help="Git 커밋 메시지")
    parser.add_argument("--skip-github",  action="store_true", help="GitHub push 건너뜀")
    parser.add_argument("--skip-notion",  action="store_true", help="Notion 업데이트 건너뜀")

    args = parser.parse_args()

    today_str = datetime.now(KST).strftime("%Y-%m-%d")

    print_header(f"🚀 BizReady Post-Deploy 자동화")
    print(f"  기능: {args.feature}")
    print(f"  경로: {args.path}")
    print(f"  날짜: {today_str}")

    # ── 1. GitHub push ──────────────────────────────────────
    if not args.skip_github:
        commit_hash = push_to_github(args.commit_msg)
    else:
        _, commit_hash, _ = run_cmd("git rev-parse --short HEAD")
        print_info("GitHub push 건너뜀 (--skip-github)")

    # ── 2. Notion 업데이트 ──────────────────────────────────
    if not args.skip_notion:
        update_notion_schedule_db(args.feature, args.desc, today_str)
        update_notion_progress_page(args.feature, args.path, args.desc, today_str, commit_hash)
    else:
        print_info("Notion 업데이트 건너뜀 (--skip-notion)")

    # ── 3. 테스트 체크리스트 출력 ───────────────────────────
    print_test_checklist(args.feature, args.test_urls, today_str, commit_hash)

if __name__ == "__main__":
    main()
