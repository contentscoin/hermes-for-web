# Hermes CEO Desktop Install Pack

목표: 기존 Hermes Agent 사용자 또는 신규 팀원이 데스크톱 앱처럼 Hermes WebUI를 실행할 수 있도록 macOS/Windows 설치 흐름을 패키징합니다.

포함 범위
- Hermes Agent 설치/업데이트
- Hermes for Web 설치/업데이트
- localhost:8788 실행 준비
- Telegram 설정 점검 가이드
- Codex CLI 로그인 점검 가이드
- Paperclip MCP/환경변수 연결 가이드
- WebUI 메인 탭의 실제 Paperclip 작업 화면 연결 가이드
- 데스크톱 런처 생성
  - macOS: `Hermes CEO Console.app` Automator/AppleScript 런처
  - Windows: Desktop shortcut + PowerShell 런처

보안 원칙
- 이 pack은 API key, Telegram token, Paperclip credentials, Codex 로그인 토큰을 포함하지 않습니다.
- 각 사용자가 로컬에서 `hermes setup`, Telegram bot token 등록, `codex login`, Paperclip URL/company 설정을 직접 수행해야 합니다.
- Paperclip 반영은 WebUI/Telegram 논의만으로 자동 실행되지 않으며, 명시 승인 후에만 실행합니다.

빠른 사용

macOS:
```bash
cd desktop-install-pack
chmod +x install-macos.sh
./install-macos.sh --yes
```

Windows PowerShell:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
cd desktop-install-pack
.\install-windows.ps1 -Yes
```

설치 후 확인
- WebUI: http://127.0.0.1:8788
- Health: http://127.0.0.1:8788/health
- Codex: `codex --version` 후 필요 시 `codex login`
- Hermes: `hermes doctor`
- Paperclip: `~/.hermes/.env` 또는 `~/.hermes/config.yaml`의 Paperclip 설정 확인
  - `PAPERCLIP_WEB_URL` 기본값은 `http://127.0.0.1:3100` 입니다.
  - WebUI 상단 `Paperclip` 탭에서 실제 Paperclip 화면을 직접 작업 화면으로 볼 수 있습니다.
- Telegram: Hermes Agent의 Telegram integration 설정 확인

Desktop app packaging note
- Batch 1은 네이티브 바이너리 서명/배포까지 하지 않고, OS별 데스크톱 런처와 설치 스크립트까지 제공합니다.
- 다음 Batch에서 Electron/Tauri wrapper를 실제 `.dmg` / `.msi`로 빌드할 수 있도록 `electron-wrapper/` 골격을 포함합니다.
