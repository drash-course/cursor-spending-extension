import * as vscode from "vscode";

const API_URL = "https://cursor.com/api/dashboard/get-current-period-usage";
const DASHBOARD_URL = "https://cursor.com/dashboard?tab=spending";

interface PlanUsage {
  autoPercentUsed?: number;
  apiPercentUsed?: number;
  totalPercentUsed?: number;
  limit?: number;
  totalSpend?: number;
  includedSpend?: number;
  bonusSpend?: number;
  remaining?: number;
  remainingBonus?: boolean;
  bonusTooltip?: string;
}

/** Present when user has set a finite on-demand spending cap (not off / not unlimited). */
interface SpendLimitUsage {
  individualLimit?: number;
  individualRemaining?: number;
  limitType?: string;
  pooledLimit?: number;
  pooledUsed?: number;
  pooledRemaining?: number;
}

interface UsageResponse {
  billingCycleStart?: string;
  billingCycleEnd?: string;
  planUsage?: PlanUsage;
  spendLimitUsage?: SpendLimitUsage;
  displayThreshold?: number;
  enabled?: boolean;
  displayMessage?: string;
  autoModelSelectedDisplayMessage?: string;
  namedModelSelectedDisplayMessage?: string;
  autoBucketModels?: string[];
}

let statusBarItem: vscode.StatusBarItem;
let refreshIntervalId: ReturnType<typeof setInterval> | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );

  outputChannel = vscode.window.createOutputChannel("Cursor Spending");
  context.subscriptions.push(outputChannel);
  context.subscriptions.push(statusBarItem);

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
  const intervalMinutes = config.get<number>("refreshInterval", 20);
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
      statusBarItem,
      "$(cursor) Auto: —  $(cloud) API: —  $: —",
      "Token not configured. Click to set up."
    );
    statusBarItem.show();
    return;
  }

  statusBarItem.text = "$(sync~spin) Refreshing...";
  statusBarItem.tooltip = "Fetching usage…";
  statusBarItem.show();

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

    // Log full API response for diagnostics
    if (outputChannel) {
      outputChannel.appendLine(`[${new Date().toISOString()}] API response:`);
      outputChannel.appendLine(JSON.stringify(data, null, 2));
    }

    const planUsage = data?.planUsage;

    if (!planUsage) {
      throw new Error("Invalid response: missing planUsage");
    }

    setStatusBarUsage(
      statusBarItem,
      planUsage,
      data.billingCycleStart,
      data.billingCycleEnd,
      data.spendLimitUsage
    );

    statusBarItem.show();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatusBarError(
      statusBarItem,
      "$(cursor) Auto: $(error)  $(cloud) API: $(error)  $: $(error)",
      `Failed to fetch usage: ${message}`
    );
    statusBarItem.show();
  }
}

const PROGRESS_BAR_WIDTH = 24;
const PROGRESS_FILL = "▓";
const PROGRESS_EMPTY = "░";

/** Thick horizontal rule for tooltip section breaks (monospace; boxed for visibility). */
const TOOLTIP_DIVIDER_LINE = "━".repeat(Math.max(PROGRESS_BAR_WIDTH, 60));

function progressBar(percent: number, width: number = PROGRESS_BAR_WIDTH): string {
  const filled = Math.min(width, Math.round((percent / 100) * width));
  const empty = width - filled;
  return PROGRESS_FILL.repeat(filled) + PROGRESS_EMPTY.repeat(empty);
}

/**
 * Resolves the billing period start and end dates.
 * Prefers API-provided Unix-ms strings; falls back to config billingCycleDay.
 */
function resolveBillingPeriod(
  billingCycleStart?: string,
  billingCycleEnd?: string
): { start: Date; end: Date } | null {
  if (billingCycleStart && billingCycleEnd) {
    const start = new Date(parseInt(billingCycleStart, 10));
    const end = new Date(parseInt(billingCycleEnd, 10));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end };
    }
  }

  const config = vscode.workspace.getConfiguration("cursorSpending");
  const billingCycleDay = config.get<number>("billingCycleDay", 0);
  if (billingCycleDay >= 1 && billingCycleDay <= 31) {
    const now = new Date();
    const currentDay = now.getDate();
    let startMonth = now.getMonth();
    let startYear = now.getFullYear();
    if (currentDay < billingCycleDay) {
      startMonth -= 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
    }
    const start = new Date(startYear, startMonth, billingCycleDay);
    const endMonth = (startMonth + 1) % 12;
    const endYear = startMonth === 11 ? startYear + 1 : startYear;
    const end = new Date(endYear, endMonth, billingCycleDay);
    return { start, end };
  }

  return null;
}

/**
 * Counts days between two dates.
 * When weekdaysOnly is true, counts Monday–Friday only.
 */
function countDays(from: Date, to: Date, weekdaysOnly: boolean): number {
  if (!weekdaysOnly) {
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
  }
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const toMidnight = new Date(to);
  toMidnight.setHours(0, 0, 0, 0);
  while (cursor < toMidnight) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * When linear pace exceeds 100% by cycle end, estimate calendar date of the 100% cross.
 * Model matches projection: usage grows 0→current over elapsed units, extended linearly.
 */
function addBillingTimeFromStart(
  start: Date,
  units: number,
  weekdaysOnly: boolean
): Date {
  const n = Math.max(0, Math.round(units));
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  if (n === 0) {
    return d;
  }
  if (!weekdaysOnly) {
    d.setDate(d.getDate() + n);
    return d;
  }
  let remaining = n;
  while (remaining > 0) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
      if (remaining === 0) {
        return d;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function projectedCrossingNote(
  billingStart: Date,
  billingEnd: Date,
  now: Date,
  elapsedUnits: number,
  currentPercent: number,
  projectedPercent: number,
  weekdaysOnly: boolean
): string {
  if (projectedPercent <= 100 || currentPercent <= 0) {
    return "";
  }
  if (currentPercent >= 100) {
    return " (at/over limit now)";
  }
  const unitsToHundred = (100 / currentPercent) * elapsedUnits;
  const crossing = addBillingTimeFromStart(billingStart, unitsToHundred, weekdaysOnly);
  if (crossing.getTime() <= now.getTime()) {
    return " (already over limit)";
  }
  if (crossing.getTime() > billingEnd.getTime()) {
    return " (>100% pace after cycle end)";
  }
  return ` @ ~${formatResetDate(crossing)}`;
}

function formatResetDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Label width for projection monospace block (longest: "On-demand:"). */
const PROJECTION_MONO_LABEL_WIDTH = "On-demand:".length;

function projectionMonoLine(label: string, value: string): string {
  return `${label.padEnd(PROJECTION_MONO_LABEL_WIDTH)} ${value}`;
}

function formatUsdFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * On-demand cap is active only when the API includes both individual limit and remaining (cents).
 */
function getOnDemandCapMetrics(
  slu: SpendLimitUsage | undefined
): { limitCents: number; remainingCents: number; usedCents: number; percentUsed: number } | null {
  if (
    typeof slu?.individualLimit !== "number" ||
    typeof slu?.individualRemaining !== "number"
  ) {
    return null;
  }
  const limitCents = slu.individualLimit;
  if (limitCents <= 0) {
    return null;
  }
  const remainingCents = slu.individualRemaining;
  const usedCents = limitCents - remainingCents;
  const percentUsed = (usedCents / limitCents) * 100;
  return { limitCents, remainingCents, usedCents, percentUsed };
}

function buildUsageTooltip(
  planUsage: PlanUsage,
  billingCycleStart?: string,
  billingCycleEnd?: string,
  spendLimitUsage?: SpendLimitUsage
): vscode.MarkdownString {
  const config = vscode.workspace.getConfiguration("cursorSpending");
  const projectionMode = config.get<string>("projectionMode", "allDays");
  const weekdaysOnly = projectionMode === "weekdaysOnly";

  const autoPercent =
    typeof planUsage.autoPercentUsed === "number"
      ? planUsage.autoPercentUsed.toFixed(1)
      : "—";
  const autoPercentNum =
    typeof planUsage.autoPercentUsed === "number"
      ? planUsage.autoPercentUsed
      : 0;
  const apiPercent =
    typeof planUsage.apiPercentUsed === "number"
      ? planUsage.apiPercentUsed.toFixed(1)
      : "—";
  const apiPercentNum =
    typeof planUsage.apiPercentUsed === "number"
      ? planUsage.apiPercentUsed
      : 0;

  const billing = resolveBillingPeriod(billingCycleStart, billingCycleEnd);
  const resetLabel = billing ? `Resets ${formatResetDate(billing.end)}` : null;

  const hasLimit = typeof planUsage.limit === "number";
  const limitUsd = hasLimit ? planUsage.limit! / 100 : null;

  const lines: string[] = [];

  if (resetLabel) {
    lines.push(`*${resetLabel}*`);
    lines.push("");
  }

  // Auto: subtext inline with %, then extra air before the bar
  lines.push(
    `**Auto: ${autoPercent}%** — Consumed by Auto and Composer; overage billed at API rates.`
  );
  lines.push("");
  lines.push("");
  lines.push("```");
  lines.push(progressBar(autoPercentNum));
  lines.push("```");
  lines.push("");
  lines.push("```");
  lines.push(TOOLTIP_DIVIDER_LINE);
  lines.push("```");

  // API: same pattern
  lines.push("");
  lines.push(`**API: ${apiPercent}%** — Other models (not Auto or Composer).`);
  lines.push("");
  lines.push("");
  lines.push("```");
  lines.push(progressBar(apiPercentNum));
  lines.push("```");
  if (limitUsd !== null) {
    lines.push("");
    lines.push(`Your plan includes **$${limitUsd.toFixed(2)}** of API usage.`);
  }
  if (typeof planUsage.bonusSpend === "number" && planUsage.bonusSpend > 0) {
    lines.push(
      `Bonus usage so far this period: **$${formatUsdFromCents(planUsage.bonusSpend)}**`
    );
  }
  if (planUsage.bonusTooltip && planUsage.bonusTooltip.trim()) {
    lines.push("");
    lines.push(`*${planUsage.bonusTooltip.trim()}*`);
  }

  // On-demand (overage) cap
  const odMetrics = getOnDemandCapMetrics(spendLimitUsage);
  lines.push("");
  if (!odMetrics) {
    lines.push(
      "*You have not configured an on-demand spending cap (usage is off or unlimited).*"
    );
  } else {
    const odPct = odMetrics.percentUsed.toFixed(1);
    const usedUsd = formatUsdFromCents(odMetrics.usedCents);
    const limitOdUsd = formatUsdFromCents(odMetrics.limitCents);
    const remUsd = formatUsdFromCents(odMetrics.remainingCents);
    lines.push(
      `**On-demand: ${odPct}%** of cap — **$${usedUsd}** used · **$${remUsd}** left · **$${limitOdUsd}** cap.`
    );
    lines.push("");
    lines.push("");
    lines.push("```");
    lines.push(progressBar(odMetrics.percentUsed));
    lines.push("```");
  }

  // Straight-line projection (markdown list so each line renders separately)
  if (billing) {
    const now = new Date();
    const totalDays = countDays(billing.start, billing.end, weekdaysOnly);
    const elapsedDays = countDays(billing.start, now, weekdaysOnly);

    if (elapsedDays > 0 && totalDays > 0) {
      const ratio = totalDays / elapsedDays;
      const modeLabel = weekdaysOnly ? "weekdays" : "all days";
      const resetStr = formatResetDate(billing.end);

      lines.push("");
      lines.push("```");
      lines.push(TOOLTIP_DIVIDER_LINE);
      lines.push("```");
      lines.push(`**Projected usage** by ${resetStr} (${modeLabel} only, ${elapsedDays}/${totalDays} days)`);
      lines.push("");

      const projAuto = autoPercentNum * ratio;
      const projApi = apiPercentNum * ratio;
      const autoWarn = projAuto > 100 ? " ⚠️ over 100%" : "";
      const apiWarn = projApi > 100 ? " ⚠️ over 100%" : "";

      const autoCross = projectedCrossingNote(
        billing.start,
        billing.end,
        now,
        elapsedDays,
        autoPercentNum,
        projAuto,
        weekdaysOnly
      );
      const apiCross = projectedCrossingNote(
        billing.start,
        billing.end,
        now,
        elapsedDays,
        apiPercentNum,
        projApi,
        weekdaysOnly
      );

      lines.push("```");
      lines.push(
        projectionMonoLine("Auto:", `~${projAuto.toFixed(1)}%${autoWarn}${autoCross}`)
      );
      lines.push(
        projectionMonoLine("API:", `~${projApi.toFixed(1)}%${apiWarn}${apiCross}`)
      );
      if (odMetrics) {
        const projOd = odMetrics.percentUsed * ratio;
        const odWarn = projOd > 100 ? " ⚠️ over 100%" : "";
        const odCross = projectedCrossingNote(
          billing.start,
          billing.end,
          now,
          elapsedDays,
          odMetrics.percentUsed,
          projOd,
          weekdaysOnly
        );
        lines.push(
          projectionMonoLine(
            "On-demand:",
            `~${projOd.toFixed(1)}% of cap${odWarn}${odCross}`
          )
        );
      }
      lines.push("```");
    }
  }

  lines.push("");
  lines.push("[Refresh now](command:cursorSpending.refresh)");

  const md = new vscode.MarkdownString(lines.join("\n"));
  md.supportHtml = false;
  md.isTrusted = true;
  return md;
}

function setStatusBarUsage(
  item: vscode.StatusBarItem,
  planUsage: PlanUsage,
  billingCycleStart?: string,
  billingCycleEnd?: string,
  spendLimitUsage?: SpendLimitUsage
): void {
  const autoPercent =
    typeof planUsage.autoPercentUsed === "number"
      ? planUsage.autoPercentUsed
      : null;
  const apiPercent =
    typeof planUsage.apiPercentUsed === "number"
      ? planUsage.apiPercentUsed
      : null;

  const autoText =
    autoPercent !== null
      ? `$(cursor) Auto: ${autoPercent.toFixed(1)}%`
      : "$(cursor) Auto: —";
  const apiText =
    apiPercent !== null
      ? `$(cloud) API: ${apiPercent.toFixed(1)}%`
      : "$(cloud) API: —";

  const od = getOnDemandCapMetrics(spendLimitUsage);
  const odSegment = od
    ? `  $: ${od.percentUsed.toFixed(1)}%`
    : "";

  item.text = `${autoText}  ${apiText}${odSegment}`;
  item.tooltip = buildUsageTooltip(
    planUsage,
    billingCycleStart,
    billingCycleEnd,
    spendLimitUsage
  );
  item.command = {
    title: "Open Cursor Dashboard",
    command: "vscode.open",
    arguments: [vscode.Uri.parse(DASHBOARD_URL)],
  };
}

function setStatusBarNoToken(
  item: vscode.StatusBarItem,
  displayText: string,
  tooltip: string
): void {
  item.text = displayText;
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
