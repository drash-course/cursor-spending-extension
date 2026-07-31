# Changelog

All notable changes to Cursor Spending are documented here.

## [1.1.1]

- Error status-bar tooltip is trusted Markdown with **Refresh now** (same as success).
- Tooltip footer: **Models & Pricing** link next to Refresh now.
- Projection day count is inclusive of today (`today is day N of M`); pace uses that day number so reset day is day 1 and fair-share math is not one day behind.

## [1.1.0]

- Tooltip: billing period reset line (`billingCycleStart` / `End`; optional `billingCycleDay` fallback).
- Tooltip + status bar: on-demand usage when `spendLimitUsage.individualLimit` and `individualRemaining` are present; message when no finite on-demand cap.
- Tooltip: straight-line projection (`projectionMode`: all days vs weekdays), crossing hints when projected over 100%.
- Settings: `billingCycleDay`, `projectionMode`.
- Progress bars use shade characters for even height; tooltip layout and copy updates (bonus spend, included API allowance).
- Output channel **Cursor Spending** logs each successful API JSON response for debugging.
- Development: `.vscode/launch.json` + `tasks.json` for **Run Extension**.
- Docs: [docs/api-get-current-period-usage.md](docs/api-get-current-period-usage.md) for observed response shape.
- Removed ad-hoc Python dump script from `scripts/` (icon build remains).

## [1.0.5]

- Mirror Cursor dashboard wording in tooltips: Auto and Composer models vs other models, API quota for overage, and plan API usage when the API returns it.

## [1.0.4]

- Add preview screenshot to README.

## [1.0.3]

- Use Cursor icon instead of run icon for Auto usage in the status bar.
- Increase max refresh interval to 1 day (1440 minutes).
- Add "Refresh now" link in the usage tooltip.
- Show "Refreshing..." in the status bar while fetching, then update with the result.
- Change default refresh interval to 20 minutes.

## [1.0.2]

- Add CHANGELOG for the Open VSX extension page.

## [1.0.1]

- Added extension icon (spend_icon.png).

## [1.0.0]

- Initial release.
- Status bar: Auto and API usage percentages.
- Rich tooltip with progress bars and spend summary.
- Token setup panel when session token is missing.
- Periodic refresh (default 10 minutes) and manual refresh command.
