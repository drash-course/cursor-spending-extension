import * as vscode from "vscode";

const API_URL = "https://cursor.com/api/dashboard/get-current-period-usage";
const DASHBOARD_URL = "https://cursor.com/dashboard?tab=spending";

interface PlanUsage {
  autoPercentUsed?: number;
  apiPercentUsed?: number;
}

interface UsageResponse {
  planUsage?: PlanUsage;
}

let autoStatusBarItem: vscode.StatusBarItem;
let apiStatusBarItem: vscode.StatusBarItem;
let refreshIntervalId: ReturnType<typeof setInterval> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  autoStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  apiStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );

  context.subscriptions.push(autoStatusBarItem, apiStatusBarItem);

  const refreshCommand = vscode.commands.registerCommand(
    "cursorSpending.refresh",
    () => {
      fetchAndUpdateStatusBar();
    }
  );
  context.subscriptions.push(refreshCommand);

  const openTokenSetupCommand = vscode.commands.registerCommand(
    "cursorSpending.openTokenSetup",
    () => {
      openTokenSetupPanel(context);
    }
  );
  context.subscriptions.push(openTokenSetupCommand);

  fetchAndUpdateStatusBar();
  startRefreshTimer();
}

export function deactivate(): void {
  if (refreshIntervalId !== undefined) {
    clearInterval(refreshIntervalId);
  }
}

function startRefreshTimer(): void {
  const config = vscode.workspace.getConfiguration("cursorSpending");
  const intervalMinutes = config.get<number>("refreshInterval", 10);
  const intervalMs = intervalMinutes * 60 * 1000;

  refreshIntervalId = setInterval(() => {
    fetchAndUpdateStatusBar();
  }, intervalMs);
}

async function fetchAndUpdateStatusBar(): Promise<void> {
  const config = vscode.workspace.getConfiguration("cursorSpending");
  const token = config.get<string>("sessionToken", "").trim();

  if (!token) {
    setStatusBarNoToken(
      autoStatusBarItem,
      "Auto: —",
      "Token not configured. Click to set up."
    );
    setStatusBarNoToken(
      apiStatusBarItem,
      "API: —",
      "Token not configured. Click to set up."
    );
    autoStatusBarItem.show();
    apiStatusBarItem.show();
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        Pragma: "no-cache",
        Origin: "https://cursor.com",
        Referer: DASHBOARD_URL,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Safari/605.1.15",
        Cookie: `WorkosCursorSessionToken=${token}`,
      },
      body: "{}",
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as UsageResponse;
    const planUsage = data?.planUsage;

    if (!planUsage) {
      throw new Error("Invalid response: missing planUsage");
    }

    const autoPercent =
      typeof planUsage.autoPercentUsed === "number"
        ? planUsage.autoPercentUsed
        : null;
    const apiPercent =
      typeof planUsage.apiPercentUsed === "number"
        ? planUsage.apiPercentUsed
        : null;

    setStatusBarUsage(
      autoStatusBarItem,
      "Auto",
      autoPercent,
      "Auto (in-editor) usage percent"
    );
    setStatusBarUsage(
      apiStatusBarItem,
      "API",
      apiPercent,
      "API usage percent"
    );

    autoStatusBarItem.show();
    apiStatusBarItem.show();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatusBarError(
      autoStatusBarItem,
      "Auto: $(error)",
      `Failed to fetch usage: ${message}`
    );
    setStatusBarError(
      apiStatusBarItem,
      "API: $(error)",
      `Failed to fetch usage: ${message}`
    );
    autoStatusBarItem.show();
    apiStatusBarItem.show();
  }
}

function setStatusBarUsage(
  item: vscode.StatusBarItem,
  label: string,
  percent: number | null,
  tooltip: string
): void {
  const icon = label === "Auto" ? "$(cpu)" : "$(cloud)";
  const text =
    percent !== null ? `${icon} ${label}: ${percent.toFixed(1)}%` : `${icon} ${label}: —`;
  item.text = text;
  item.tooltip = tooltip;
  item.command = {
    title: "Open Cursor Dashboard",
    command: "vscode.open",
    arguments: [vscode.Uri.parse(DASHBOARD_URL)],
  };
}

function setStatusBarNoToken(
  item: vscode.StatusBarItem,
  text: string,
  tooltip: string
): void {
  item.text = text;
  item.tooltip = tooltip;
  item.command = {
    title: "Configure session token",
    command: "cursorSpending.openTokenSetup",
  };
}

function setStatusBarError(
  item: vscode.StatusBarItem,
  text: string,
  tooltip: string
): void {
  item.text = text;
  item.tooltip = tooltip;
  item.command = {
    title: "Open Cursor Dashboard",
    command: "vscode.open",
    arguments: [vscode.Uri.parse(DASHBOARD_URL)],
  };
}

function openTokenSetupPanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    "cursorSpendingTokenSetup",
    "Cursor Spending – Session Token",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const dashboardLink = DASHBOARD_URL;
  const nonce = getNonce();

  panel.webview.html = getTokenSetupWebviewContent(dashboardLink, nonce);

  panel.webview.onDidReceiveMessage(
    async (message: { type: string; token?: string; url?: string }) => {
      if (message.type === "save" && typeof message.token === "string") {
        const trimmed = message.token.trim();
        if (!trimmed) {
          return;
        }
        await vscode.workspace
          .getConfiguration("cursorSpending")
          .update("sessionToken", trimmed, vscode.ConfigurationTarget.Global);
        panel.dispose();
        vscode.window.showInformationMessage(
          "Cursor Spending: Session token saved. Fetching usage…"
        );
        fetchAndUpdateStatusBar();
      } else if (message.type === "openLink" && typeof message.url === "string") {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
    }
  );
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getTokenSetupWebviewContent(dashboardLink: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cursor Spending – Session Token</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 1rem 1.5rem;
      box-sizing: border-box;
    }
    p {
      margin: 0 0 1rem 0;
      line-height: 1.5;
    }
    label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }
    input[type="text"] {
      width: 100%;
      padding: 0.5rem;
      margin-bottom: 1rem;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: inherit;
      font-size: inherit;
      box-sizing: border-box;
    }
    input[type="text"]:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    a {
      color: var(--vscode-textLink-foreground);
    }
    a:hover {
      color: var(--vscode-textLink-activeForeground);
    }
    .button-row {
      margin-top: 1.25rem;
    }
    button {
      padding: 0.5rem 1rem;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <p>Paste your <strong>WorkosCursorSessionToken</strong> cookie value below. Get it from your browser while logged into the Cursor dashboard:</p>
  <ol style="margin: 0.5rem 0 1rem 1.25rem;">
    <li>Open the <a href="${dashboardLink}" id="dashboard-link">Cursor dashboard</a> and log in.</li>
    <li>Open DevTools (F12 or Cmd+Option+I) → Application → Cookies → cursor.com.</li>
    <li>Copy the value of <strong>WorkosCursorSessionToken</strong>.</li>
  </ol>
  <label for="token-input">Session token</label>
  <input type="text" id="token-input" placeholder="Paste token here..." />
  <div class="button-row">
    <button id="save-btn">Save</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('token-input');
    const saveBtn = document.getElementById('save-btn');
    const dashboardLink = document.getElementById('dashboard-link');

    dashboardLink.addEventListener('click', function(e) {
      e.preventDefault();
      vscode.postMessage({ type: 'openLink', url: '${dashboardLink}' });
    });

    saveBtn.addEventListener('click', function() {
      const token = input.value.trim();
      if (token) {
        vscode.postMessage({ type: 'save', token: token });
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });
  </script>
</body>
</html>`;
}
