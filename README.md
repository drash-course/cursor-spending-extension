# Cursor Spending

View your Cursor usage (Auto and API) in the status bar—with a single segment, progress bars in the tooltip, and spend details.

## Features

- **Status bar** – One segment showing **Auto** and **API** usage percentages (e.g. `Auto: 1.4%  API: 4.5%`). Click to open the [Cursor dashboard](https://cursor.com/dashboard?tab=spending).
- **Rich tooltip** – Hover to see:
  - Progress bars for Auto and API usage
  - Short descriptions of what each quota is for
  - Spend summary: total used, included, and remaining (when provided by the API)
  - Bonus tooltip text when present
- **Token setup** – If the session token is missing, clicking the status bar opens a panel to paste your token, with a link to the dashboard and a Save button. The token is stored in your settings.
- **Refresh** – Data refreshes automatically (default: every 10 minutes). Use **Cursor Spending: Refresh usage** to refresh immediately.

## Requirements

- **VS Code** or **Cursor** `^1.85.0`
- A Cursor account (used to obtain the session token)

## Installation

### From the Marketplace

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **Cursor Spending**.
3. Click **Install**.

### Install from VSIX (local build)

1. Clone the repo and run: `npm install && npm run compile`
2. Run: `npx @vscode/vsce package`
3. In the editor: **Extensions** → **...** → **Install from VSIX...** and select the generated `.vsix` file.

## Quick Start

1. **Get your session token**
   - Open [cursor.com/dashboard](https://cursor.com/dashboard) in a browser and sign in.
   - Open DevTools (**F12** or **Cmd+Option+I**) → **Application** (Chrome) or **Storage** (Firefox) → **Cookies** → `https://cursor.com`.
   - Copy the **Value** of the **WorkosCursorSessionToken** cookie.

2. **Configure the extension**
   - Open Settings (`Ctrl+,` / `Cmd+,`), search for **Cursor Spending**, and paste the token into **Cursor Spending: Session Token**.
   - Or leave the token empty and click the status bar segment; the setup panel will open so you can paste and save the token there.

3. The status bar will show usage and refresh on the configured interval (default 10 minutes).

## Extension Settings

| Setting | Description | Default |
|--------|-------------|---------|
| `cursorSpending.sessionToken` | Your WorkosCursorSessionToken cookie value from [cursor.com/dashboard](https://cursor.com/dashboard). Get it from DevTools → Application → Cookies. | `""` |
| `cursorSpending.refreshInterval` | How often to fetch usage, in minutes. | `10` (min: 1, max: 60) |

## Commands

| Command | Description |
|--------|-------------|
| **Cursor Spending: Refresh usage** | Fetches current usage and updates the status bar. |
| **Cursor Spending: Configure session token** | Opens the token setup panel (input, dashboard link, Save). |

## Security and Privacy

- The session token is stored in your editor **user settings** (global). Do not share it or commit it to a repository.
- The extension uses your token to call `https://cursor.com/api/dashboard/get-current-period-usage` (POST, with the token in a Cookie header). Your token is not sent anywhere else.

## Development

- Open this folder in VS Code or Cursor.
- Run `npm install` and `npm run compile`.
- Press **F5** to launch an Extension Development Host with the extension loaded.
- Use **Developer: Reload Window** in the host to pick up code changes after recompiling.

## License

MIT
