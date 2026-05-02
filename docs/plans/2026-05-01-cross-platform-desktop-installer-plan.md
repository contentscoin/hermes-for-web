# Hermes CEO Console Cross-Platform Desktop Installer Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task after CEO approval.

**Goal:** Build installable macOS and Windows packages that make Hermes Agent + Hermes WebUI + Telegram bot setup + Paperclip setup + Codex CLI login approachable for non-technical users, and run as a desktop app.

**Architecture:** Ship a desktop shell plus a first-run setup wizard. The installer prepares prerequisites and local services, but secrets and OAuth logins remain user-approved interactive steps. macOS can run Hermes natively. Windows should default to a WSL2-backed runtime for Hermes Agent compatibility, with a Windows desktop app wrapper launching the local WebUI.

**Tech Stack:** Electron + electron-builder for `.dmg` and `.exe`/NSIS first; optional Tauri later. Python/Bash/PowerShell setup scripts. Hermes Agent official installer. Existing Hermes for Web server on `localhost:8788`.

---

## Executive Conclusion

Yes, this can be built, but not as a single silent installer that logs everything in without user interaction.

Reason:
- Telegram bot token must be created or supplied by the user via BotFather or existing token.
- Codex CLI login is OAuth/device login and must be authorized by the user.
- Paperclip URL/company/token must be supplied by the organization or user.
- macOS and Windows security models require user approval for app execution, network access, and sometimes developer signing/notarization.

The correct product shape is:

1. User installs `Hermes CEO Console`.
2. Desktop app opens a first-run setup wizard.
3. Wizard installs/checks Hermes, WebUI, Codex CLI, Paperclip config, Telegram config.
4. Wizard launches required approval/login screens.
5. App runs WebUI at `localhost:8788` and opens it in a native desktop window.
6. Paperclip/Telegram execution remains approval-gated.

---

## Current Repository Status

Existing pack skeleton already found:

- `desktop-install-pack/README.md`
- `desktop-install-pack/install-macos.sh`
- `desktop-install-pack/install-windows.ps1`
- `desktop-install-pack/templates/env.example`
- `desktop-install-pack/electron-wrapper/package.json`
- `desktop-install-pack/electron-wrapper/main.js`
- `desktop-install-pack/electron-wrapper/preload.js`

This is a useful Batch 0 skeleton but not yet a full production installer.

Current limitations:
- macOS script creates a lightweight `.app` launcher, not signed `.dmg`.
- Windows script creates a PowerShell shortcut, not a signed `.exe` installer.
- Electron wrapper starts the local server but has no first-run wizard.
- Windows runtime assumes native Python/server availability; safer production approach should use WSL2.
- Telegram/Paperclip/Codex are reminders only, not guided setup steps.

---

## Target Product

### macOS output

1. `Hermes CEO Console.dmg`
2. Signed/notarized `Hermes CEO Console.app` in a later release stage
3. First-run wizard:
   - install/update Hermes Agent
   - clone/update Hermes for Web CEO Console repo
   - install/check Codex CLI
   - launch `codex login`
   - collect Telegram bot token locally
   - collect Paperclip URL/company locally
   - run `hermes doctor`
   - start WebUI on `localhost:8788`

### Windows output

Recommended default:
1. `Hermes CEO Console Setup.exe`
2. Windows Electron shell
3. WSL2 runtime wizard:
   - check/install WSL2 + Ubuntu
   - install Hermes Agent inside WSL
   - clone/update WebUI inside WSL
   - start WebUI in WSL bound to `127.0.0.1:8788`
   - Windows Electron app loads `http://127.0.0.1:8788`

Fallback native Windows mode:
- only if Hermes Agent and dependencies are verified on native Windows for the selected version.
- keep as advanced option, not default.

---

## Non-Negotiable Security Rules

1. Do not bundle API keys, Telegram tokens, Paperclip credentials, Codex tokens, or OAuth files.
2. Never commit generated `.env` with secrets.
3. Installer may create `~/.hermes/.env` from user input, but output/logs must redact secrets.
4. Telegram sending remains explicit approval only.
5. Paperclip reflection remains explicit approval only.
6. Codex login must be initiated by user and completed in browser/device flow.
7. On Windows, avoid storing secrets in the Electron app directory; store them under user home / WSL home.

---

## Recommended Implementation Phases

## Phase 1: Upgrade Existing Install Pack to Production-Ready Scripts

### Task 1.1: Add installer manifest

**Objective:** Centralize app identity, repo URL, port, runtime mode, and required tools.

**Files:**
- Create: `desktop-install-pack/installer.manifest.json`

**Content shape:**

```json
{
  "productName": "Hermes CEO Console",
  "appId": "com.fmg.hermes-ceo-console",
  "defaultPort": 8788,
  "repoUrl": "https://github.com/contentscoin/hermes-for-web-ceo-console.git",
  "fallbackRepoUrl": "https://github.com/reallygood83/hermes-for-web.git",
  "installDirMac": "~/.hermes/webui/workspace/hermes-for-web",
  "installDirWindowsWsl": "~/.hermes/webui/workspace/hermes-for-web",
  "requires": ["git", "python3", "curl", "hermes", "codex"]
}
```

**Verification:**

```bash
python3 -m json.tool desktop-install-pack/installer.manifest.json
```

### Task 1.2: Harden macOS installer

**Objective:** Make `install-macos.sh` robust enough for non-technical users.

**Files:**
- Modify: `desktop-install-pack/install-macos.sh`

**Required behavior:**
- `--yes`, `--port`, `--repo`, `--dir`, `--skip-codex`, `--skip-telegram`, `--skip-paperclip`, `--no-start`
- install Xcode command-line tools guidance if `git` missing
- install Hermes Agent if missing using official installer
- update Hermes if present
- install Codex CLI if missing when supported; otherwise tell user exact command
- run `codex login` interactively unless `--skip-codex`
- create/update `~/.hermes/.env` from prompts without printing secrets
- configure Paperclip base URL/company if user provides them
- configure Telegram bot token if user provides it, or launch instructions for BotFather
- clone/update CEO Console repo
- start WebUI and verify `/health`

**Verification:**

```bash
bash -n desktop-install-pack/install-macos.sh
./desktop-install-pack/install-macos.sh --help
```

### Task 1.3: Create first-run wizard CLI

**Objective:** Separate setup decisions from the installer so both macOS and Windows can reuse logic.

**Files:**
- Create: `desktop-install-pack/scripts/first_run_wizard.py`

**Required behavior:**
- show current status for Hermes, WebUI, Telegram, Paperclip, Codex
- prompt for missing values
- write only local config/env
- redact secrets in logs
- output a status JSON:

```json
{
  "hermes": "ok",
  "webui": "ok",
  "telegram": "configured | skipped | missing",
  "paperclip": "configured | skipped | missing",
  "codex": "logged_in | login_required | skipped",
  "webui_url": "http://127.0.0.1:8788"
}
```

### Task 1.4: Harden Windows installer around WSL2

**Objective:** Make Windows installation reliable by using WSL2 as the runtime.

**Files:**
- Modify: `desktop-install-pack/install-windows.ps1`
- Create: `desktop-install-pack/scripts/install-wsl-runtime.ps1`
- Create: `desktop-install-pack/scripts/wsl-hermes-start.ps1`

**Required behavior:**
- detect Windows version and WSL availability
- if WSL missing, guide or run `wsl --install -d Ubuntu` with user approval
- install Hermes Agent inside WSL
- clone/update WebUI inside WSL
- create Windows shortcut / scheduled task / app launcher
- start WebUI in WSL and verify from Windows via `http://127.0.0.1:8788/health`
- run Codex login inside WSL or explain native/WSL distinction

**Verification:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop-install-pack/install-windows.ps1 -Help
```

---

## Phase 2: Electron Desktop App Shell

### Task 2.1: Add setup status screen

**Objective:** The app should not just load localhost blindly; it should show setup progress if WebUI is not ready.

**Files:**
- Modify: `desktop-install-pack/electron-wrapper/main.js`
- Modify: `desktop-install-pack/electron-wrapper/preload.js`
- Create: `desktop-install-pack/electron-wrapper/setup.html`
- Create: `desktop-install-pack/electron-wrapper/setup.js`

**Behavior:**
- On launch, check `http://127.0.0.1:8788/health`.
- If healthy, load WebUI.
- If not healthy, show setup screen with buttons:
  - Start WebUI
  - Run Setup Wizard
  - Open Logs
  - Retry
- On macOS, run local `install-macos.sh --no-start` or launcher.
- On Windows, run WSL-backed start script.

### Task 2.2: Add log viewer

**Objective:** Non-technical users need visible failure messages.

**Files:**
- Create: `desktop-install-pack/electron-wrapper/logs.js`

**Log sources:**
- `/tmp/hermes-ceo-console.log` on macOS/Linux
- `%USERPROFILE%\.hermes\logs\hermes-ceo-console.log` on Windows
- `~/.hermes/logs/gateway.log`

### Task 2.3: Build packaging config

**Objective:** Make `.dmg` and `.exe` artifacts reproducible.

**Files:**
- Modify: `desktop-install-pack/electron-wrapper/package.json`
- Create: `desktop-install-pack/electron-wrapper/assets/`
- Create: `desktop-install-pack/electron-wrapper/build/entitlements.mac.plist`

**Scripts:**

```json
{
  "build:mac": "electron-builder --mac dmg",
  "build:win": "electron-builder --win nsis",
  "dist": "electron-builder -mwl"
}
```

**Verification:**

```bash
cd desktop-install-pack/electron-wrapper
npm install
npm run build:mac
```

Windows build should be done on Windows or CI runner:

```powershell
cd desktop-install-pack/electron-wrapper
npm install
npm run build:win
```

---

## Phase 3: Guided Integration Setup

### Task 3.1: Telegram setup wizard

**Objective:** Make Telegram bot setup understandable without embedding secrets.

**Wizard flow:**
1. Ask: use existing bot token or create via BotFather?
2. If create: open `https://t.me/BotFather` and show exact instructions.
3. User pastes token locally.
4. User chooses home chat / allowed group IDs.
5. Run Hermes gateway setup/check.
6. Display status, not token.

**Important:** Bot token cannot be generated automatically by the installer.

### Task 3.2: Paperclip setup wizard

**Objective:** Configure Paperclip locally and verify connection.

**Wizard fields:**
- `PAPERCLIP_BASE_URL`
- `PAPERCLIP_DEFAULT_COMPANY`
- optional token if Paperclip requires it

**Checks:**
- no raw token logging
- company lookup if Paperclip MCP/API is available
- dry-run only; no issue creation

### Task 3.3: Codex CLI login wizard

**Objective:** Get the user authenticated with Codex CLI.

**Flow:**
1. Check `codex --version`.
2. If missing, show install command or install with supported package manager.
3. Run `codex login` in a visible terminal.
4. Verify with a harmless status/version command.

**Important:** OAuth login cannot be completed silently.

### Task 3.4: Hermes setup wizard

**Objective:** Run Hermes setup and doctor in a guided way.

**Flow:**
1. Check `hermes --version`.
2. If missing, install official Hermes Agent.
3. Run `hermes setup` when model/provider credentials are missing.
4. Run `hermes doctor`.
5. Offer `hermes gateway setup` for Telegram.

---

## Phase 4: Paperclip-Aware Team Distribution

### Task 4.1: Add company/team install profiles

**Objective:** Let FMG distribute a preconfigured but secret-free installer profile.

**Files:**
- Create: `desktop-install-pack/profiles/fmg.profile.json`

**Example:**

```json
{
  "assistantName": "hela",
  "theme": "cherry-blossom",
  "defaultCompany": "FMG",
  "paperclipBaseUrl": "https://paperclip.example.com",
  "telegramDefaultTargetLabel": "Pax Team Group",
  "features": {
    "memoryCandidateInbox": true,
    "paperclipDecisionIntelligence": true,
    "sharenoteTelegramPack": true,
    "autoResearchPack": true
  },
  "secretsIncluded": false
}
```

**Security:**
- profiles may include URLs and company labels
- profiles must not include tokens/API keys

---

## Phase 5: CI/CD Release Build

### Task 5.1: GitHub Actions release workflow

**Objective:** Build installer artifacts on macOS and Windows runners.

**Files:**
- Create: `.github/workflows/desktop-release.yml`

**Artifacts:**
- macOS `.dmg`
- Windows `.exe`
- checksum files
- install pack zip

**Later production requirements:**
- Apple Developer ID signing
- macOS notarization
- Windows code signing certificate
- auto-update feed if desired

---

## User Onboarding Simulation

## Simulation A: macOS non-technical user

1. User downloads `Hermes CEO Console.dmg`.
2. User drags app to Applications.
3. User opens app.
4. App checks `localhost:8788`.
5. WebUI not running, so setup screen appears.
6. User clicks `Run Setup`.
7. Installer checks git/python/curl.
8. Hermes missing, official Hermes installer runs.
9. Wizard asks for model/provider setup via `hermes setup`.
10. Wizard asks about Codex. User clicks `Login`, browser/device login completes.
11. Wizard asks about Telegram. User opens BotFather, pastes token locally.
12. Wizard asks about Paperclip. User enters base URL/company.
13. Wizard starts WebUI.
14. Desktop app loads `http://127.0.0.1:8788`.
15. Setup status shows:
    - Hermes: OK
    - WebUI: OK
    - Codex: logged in
    - Telegram: configured
    - Paperclip: connected / dry-run verified

Expected result:
- User has desktop app experience.
- No secret is bundled or printed.
- Paperclip writes still require approval.

## Simulation B: Windows user

1. User downloads `Hermes CEO Console Setup.exe`.
2. Installer opens setup wizard.
3. Wizard checks WSL2.
4. If WSL2 missing, user approves WSL install and restarts if required.
5. Wizard installs Hermes inside Ubuntu WSL.
6. Wizard clones WebUI inside WSL home.
7. Wizard starts WebUI inside WSL on port `8788`.
8. Windows Electron app loads the localhost WebUI.
9. Codex login is run inside WSL to match Hermes runtime.
10. Telegram/Paperclip setup happens inside WSL config.

Expected result:
- Windows user gets a native-looking desktop app while Hermes runtime stays Linux-compatible.

## Simulation C: User skips integrations

1. User installs desktop app.
2. User skips Telegram, Paperclip, and Codex.
3. WebUI still works for local Hermes chat if model provider is configured.
4. Setup status shows skipped/missing integrations.
5. Setup page provides `Configure later` buttons.

Expected result:
- Installer is useful even before all integrations are connected.

## Simulation D: Paperclip action after install

1. User asks WebUI to turn a discussion into Paperclip tasks.
2. Hermes generates Decision Intelligence Report and Paperclip dry-run preview.
3. UI says: `아직 Paperclip에는 반영하지 않았습니다. 실행 승인 시에만 반영합니다.`
4. User approves.
5. Only then Paperclip issue/comment/update is executed.

Expected result:
- Installer improves setup convenience but does not weaken governance.

---

## What Can Be Automated vs User-Approved

| Area | Can automate | Needs user approval/input |
|---|---|---|
| Hermes Agent install | yes | admin prompts may appear |
| Hermes WebUI clone/update | yes | repo choice if private |
| Desktop app launch | yes | OS first-run warning |
| Telegram bot setup | partially | BotFather token, allowed chats |
| Paperclip setup | partially | URL/company/token |
| Codex CLI install | partially | package manager/admin approval |
| Codex CLI login | no silent login | OAuth/device approval |
| Paperclip issue creation | no auto-write | explicit execution approval |
| Telegram send | no auto-send | explicit target/message approval |

---

## Recommended Immediate Next Batch

Batch 1 should upgrade the current skeleton into a usable alpha installer pack:

1. Add `installer.manifest.json`.
2. Add `first_run_wizard.py` with status checks and secret-safe `.env` writes.
3. Harden `install-macos.sh` with flags, `--help`, and wizard call.
4. Harden `install-windows.ps1` to clearly choose WSL2 runtime.
5. Improve Electron wrapper setup screen instead of blind localhost load.
6. Add README with exact user flows and limitations.
7. Verify syntax and build mac alpha locally.

Do not do yet:
- code signing/notarization
- auto-update
- silent Telegram/Codex login
- automatic Paperclip writes

---

## Approval Needed Before Implementation

Recommended execution target: independent repo `contentscoin/hermes-for-web-ceo-console` / local path `/Users/jakeshin/.hermes/webui/workspace/hermes-for-web`, then push to independent repo after validation.

Before coding, confirm:

1. Installer product name: keep `Hermes CEO Console` or change to a more general `Hermes Desktop`?
2. Windows default: WSL2 runtime as recommended, or native Windows first?
3. Public distribution or private FMG/team distribution?
4. Should Paperclip URL/company be prefilled for FMG in a secret-free profile?
5. Should the first alpha generate only script installers, or also attempt Electron `.dmg` build on this Mac?

Recommended default:
- Product name: `Hermes CEO Console` for FMG alpha; later rename to `Hermes Desktop` for general users.
- Windows: WSL2-backed runtime.
- Distribution: private alpha.
- Paperclip: prefill company label only, no tokens.
- Alpha artifact: script installers + Electron mac `.dmg` attempt; Windows `.exe` via Windows runner later.
