# Cursor Spending

A Cursor/VS Code extension that shows your Cursor API usage (auto and API percent used) in the status bar. Data refreshes periodically (default: every 10 minutes).

## Features

- **Status bar**: Displays **Auto** (in-editor) and **API** usage percentages in the bottom bar.
- **Click to open**: Click either status bar item to open the Cursor dashboard.
- **Periodic refresh**: Fetches usage from the Cursor API every 10 minutes (configurable).
- **Manual refresh**: Run the command **Cursor Spending: Refresh usage** to fetch immediately.

## Setup

### 1. Get your session token

The extension needs your Cursor session cookie to call the usage API.

1. Open [cursor.com/dashboard](https://cursor.com/dashboard) in a browser and log in.
2. Open DevTools (e.g. **F12** or **Cmd+Option+I**).
3. Go to **Application** (Chrome) or **Storage** (Firefox) → **Cookies** → `https://cursor.com`.
4. Find the cookie named **WorkosCursorSessionToken**.
5. Copy its **Value** (the long string).

### 2. Configure the extension

1. In Cursor/VS Code, open **Settings** (**Cmd+,** / **Ctrl+,**).
2. Search for `cursor spending` or open your `settings.json`.
3. Set **Cursor Spending: Session Token** to the value you copied:

   ```json
   "cursorSpending.sessionToken": "user_01KF..."
   ```

   Or in the UI, paste the token into the "Cursor Spending: Session Token" field.

### 3. Optional settings

- **Cursor Spending: Refresh Interval** – Refresh interval in minutes (default: `10`). Min: 1, max: 60.

## Install locally

1. Clone or download this repo.
2. Run `npm install` then `npm run compile`.
3. In Cursor/VS Code: **Extensions** → **...** → **Install from VSIX...**, or run:
   - `npm install -g @vscode/vsce` then `vsce package` to create a `.vsix` and install it.

Or run from source:

1. Open this folder in Cursor/VS Code.
2. Press **F5** to launch "Extension Development Host"; the extension runs in the new window.

## Security

The session token is stored in your editor settings. Do not share it or commit it to a repo. The extension only uses it to call `https://cursor.com/api/dashboard/get-current-period-usage`.

## Commands

- **Cursor Spending: Refresh usage** – Fetches current usage and updates the status bar.
