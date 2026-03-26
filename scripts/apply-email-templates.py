#!/usr/bin/env python3
"""
BizReady 이메일 템플릿 자동 적용 스크립트
==========================================
Supabase Management API를 통해 커스텀 이메일 템플릿을 자동으로 적용합니다.

사용법:
  python3 scripts/apply-email-templates.py --token YOUR_SUPABASE_ACCESS_TOKEN

Supabase 액세스 토큰 발급:
  https://supabase.com/dashboard/account/tokens
"""

import argparse
import json
import subprocess
import os

PROJECT_REF = "blvhpajeaelvmgfglivk"
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "email-templates")

def read_template(filename):
    """템플릿 HTML 파일 읽기"""
    path = os.path.join(TEMPLATES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def apply_templates(access_token):
    """Supabase Management API로 모든 템플릿 적용"""

    print("\n📧 BizReady 이메일 템플릿 적용 시작...")
    print(f"   프로젝트: {PROJECT_REF}")

    # 템플릿 파일 읽기
    reset_html    = read_template("reset-password.html")
    signup_html   = read_template("confirm-signup.html")
    pw_changed_html = read_template("password-changed.html")

    payload = {
        # ── 비밀번호 재설정 ───────────────────────────────
        "mailer_subjects_recovery":
            "[BizReady] 비밀번호 재설정 링크가 도착했습니다",
        "mailer_templates_recovery_content":
            reset_html,

        # ── 회원가입 이메일 인증 ──────────────────────────
        "mailer_subjects_confirmation":
            "[BizReady] 이메일 인증을 완료해주세요",
        "mailer_templates_confirmation_content":
            signup_html,

        # ── 비밀번호 변경 알림 (보안 알림) ───────────────
        "mailer_notifications_password_changed_enabled": True,
        "mailer_subjects_password_changed_notification":
            "[BizReady] 비밀번호가 변경되었습니다",
        "mailer_templates_password_changed_notification_content":
            pw_changed_html,
    }

    result = subprocess.run(
        [
            "curl", "-s", "-X", "PATCH",
            f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth",
            "-H", f"Authorization: Bearer {access_token}",
            "-H", "Content-Type: application/json",
            "-d", json.dumps(payload),
        ],
        capture_output=True,
        text=True,
    )

    try:
        data = json.loads(result.stdout)
    except Exception:
        print(f"   ❌ 응답 파싱 실패: {result.stdout[:200]}")
        return False

    if "error" in data or result.returncode != 0:
        print(f"   ❌ 적용 실패: {data.get('message', data)}")
        return False

    # 성공 확인
    applied = []
    if data.get("mailer_subjects_recovery"):
        applied.append("✅ 비밀번호 재설정 이메일")
    if data.get("mailer_subjects_confirmation"):
        applied.append("✅ 회원가입 인증 이메일")
    if data.get("mailer_subjects_password_changed_notification"):
        applied.append("✅ 비밀번호 변경 알림 이메일")

    if applied:
        print("\n   적용 완료:")
        for item in applied:
            print(f"     {item}")
    else:
        print("   ⚠️  응답은 왔지만 적용 결과를 확인할 수 없습니다.")
        print(f"   응답 키: {list(data.keys())[:5]}")

    print(f"\n   🔗 Supabase 대시보드에서 확인:")
    print(f"   https://supabase.com/dashboard/project/{PROJECT_REF}/auth/templates")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="BizReady 이메일 템플릿 자동 적용",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
토큰 발급 방법:
  1. https://supabase.com/dashboard/account/tokens 접속
  2. 'Generate new token' 클릭
  3. 토큰 이름: BizReady Template Manager
  4. 생성된 토큰 복사 후 사용

예시:
  python3 scripts/apply-email-templates.py --token sbp_xxxxxxxxxxxxx
        """
    )
    parser.add_argument(
        "--token", required=True,
        help="Supabase 개인 액세스 토큰 (https://supabase.com/dashboard/account/tokens)"
    )
    args = parser.parse_args()

    success = apply_templates(args.token)
    if success:
        print("\n🎉 모든 이메일 템플릿 적용 완료!\n")
    else:
        print("\n❌ 일부 템플릿 적용에 실패했습니다. 위 오류를 확인해주세요.\n")
        exit(1)


if __name__ == "__main__":
    main()
