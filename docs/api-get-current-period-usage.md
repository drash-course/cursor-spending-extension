# `get-current-period-usage` response (reference)

This describes the JSON shape returned by Cursor’s dashboard endpoint, as observed in the wild. **It is not a public, versioned API** and may change without notice.

## Request

- **URL:** `https://cursor.com/api/dashboard/get-current-period-usage`
- **Method:** `POST`
- **Body:** `{}`
- **Auth:** browser-style session cookie  
  `Cookie: WorkosCursorSessionToken=<token>`

This extension mirrors the headers the dashboard uses (see `src/extension.ts`).

## Sample response

Numeric money fields (`totalSpend`, `includedSpend`, `bonusSpend`, `limit`, `individualLimit`, `individualRemaining`) are in **cents**.  
`billingCycleStart` / `billingCycleEnd` are **Unix timestamps in milliseconds**, as **strings**.

```json
{
  "billingCycleStart": "1777418105000",
  "billingCycleEnd": "1780010105000",
  "planUsage": {
    "totalSpend": 10776,
    "includedSpend": 7000,
    "bonusSpend": 3776,
    "limit": 7000,
    "remainingBonus": false,
    "bonusTooltip": "We work with model providers to give you free usage beyond what you've purchased. Amounts may vary.",
    "autoPercentUsed": 15.9,
    "apiPercentUsed": 40.14545454545455,
    "totalPercentUsed": 21.129411764705882
  },
  "spendLimitUsage": {
    "individualLimit": 5000,
    "individualRemaining": 5000,
    "limitType": "user"
  },
  "displayThreshold": 200,
  "enabled": true,
  "displayMessage": "You've used 58% of your included usage",
  "autoModelSelectedDisplayMessage": "You've used 21% of your included total usage",
  "namedModelSelectedDisplayMessage": "You've used 40% of your included API usage",
  "autoBucketModels": [
    "default",
    "composer-1.5",
    "composer-1.5-auto",
    "composer-2",
    "composer-2-fast",
    "composer-2.5",
    "composer-2.5-fast",
    "composer-1",
    "composer-1-alpha"
  ]
}
```

## Field notes

| Path | Meaning (observed) |
|------|---------------------|
| `billingCycleStart` / `billingCycleEnd` | Current billing period window (ms strings). |
| `planUsage.autoPercentUsed` | Auto / Composer bucket usage (%). |
| `planUsage.apiPercentUsed` | “Other models” / API allowance usage (%). |
| `planUsage.totalPercentUsed` | Combined usage figure (not shown directly in this extension). |
| `planUsage.limit` | Included API allowance (**cents**). Shown in the tooltip as dollars. |
| `planUsage.totalSpend` / `includedSpend` / `bonusSpend` / `remaining` | Spend breakdown (**cents**); this extension does not surface the full spend line in the tooltip but logs the raw payload to the Output channel for debugging. |
| `planUsage.bonusTooltip` / `remainingBonus` | Copy and flags for provider bonus credits. |
| `spendLimitUsage` | **Optional.** When the user sets a **finite** on-demand spending cap, the API may include `individualLimit` and `individualRemaining` (**cents**). If either is missing (e.g. on-demand off or “unlimited”), the extension treats that as “no configured cap.” Team/org shapes may add pooled fields; this build only uses **individual** limits for the status bar and tooltip. |
| `spendLimitUsage.limitType` | e.g. `"user"`. |
| `displayMessage` / `*DisplayMessage` | Human strings for dashboard UI; not used by the extension today. |
| `autoBucketModels` | Model id list for the auto bucket; not used by the extension today. |
| `displayThreshold` / `enabled` | Dashboard metadata; not used by the extension today. |

## Extension behaviour summary

- **Status bar:** `autoPercentUsed`, `apiPercentUsed`, and when present `spendLimitUsage` individual cap (`$: %` of cap used).
- **Tooltip:** progress bars for Auto and API, plan API dollar allowance from `limit`, bonus line when `bonusSpend > 0`, on-demand section when individual cap fields exist, straight-line projection when billing dates resolve, optional `billingCycleDay` fallback when API omits cycle dates.
