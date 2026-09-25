# Graph Report - .  (2026-09-25)

## Corpus Check
- Corpus is ~5,837 words - fits in a single context window. You may not need a graph.

## Summary
- 139 nodes · 146 edges · 23 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Platform and Data Architecture|Platform and Data Architecture]]
- [[_COMMUNITY_Performance Chart|Performance Chart]]
- [[_COMMUNITY_Database and Page Loading|Database and Page Loading]]
- [[_COMMUNITY_Authentication Session Flow|Authentication Session Flow]]
- [[_COMMUNITY_Ledger View|Ledger View]]
- [[_COMMUNITY_Financial Calculations|Financial Calculations]]
- [[_COMMUNITY_Administrator Bootstrap|Administrator Bootstrap]]
- [[_COMMUNITY_Transaction API|Transaction API]]
- [[_COMMUNITY_Excel Import Parser|Excel Import Parser]]
- [[_COMMUNITY_Export and Grouping|Export and Grouping]]
- [[_COMMUNITY_Formatting Utilities|Formatting Utilities]]
- [[_COMMUNITY_App Icon|App Icon]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Next Configuration|Next Configuration]]
- [[_COMMUNITY_Dashboard Orchestration|Dashboard Orchestration]]
- [[_COMMUNITY_Login UI|Login UI]]
- [[_COMMUNITY_Logout UI|Logout UI]]
- [[_COMMUNITY_Setup Error UI|Setup Error UI]]
- [[_COMMUNITY_Dashboard Controls|Dashboard Controls]]
- [[_COMMUNITY_Upload Interface|Upload Interface]]
- [[_COMMUNITY_Next Type Declarations|Next Type Declarations]]
- [[_COMMUNITY_Domain Types|Domain Types]]

## God Nodes (most connected - your core abstractions)
1. `KasTok Ledger` - 10 edges
2. `POST()` - 7 edges
3. `getCurrentUser()` - 6 edges
4. `getAppEnv()` - 5 edges
5. `parseWorkbook()` - 5 edges
6. `assertAppEnv()` - 4 edges
7. `sign()` - 4 edges
8. `PostgreSQL` - 4 edges
9. `dynamic` - 3 edges
10. `Home()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Home()` --calls--> `getCurrentUser()`  [INFERRED]
  app\page.tsx → lib\auth\session.ts
- `POST()` --calls--> `sessionCookieOptions()`  [INFERRED]
  app\api\transactions\route.ts → lib\auth\session.ts
- `POST()` --calls--> `query()`  [INFERRED]
  app\api\transactions\route.ts → lib\db.ts
- `getCurrentUser()` --calls--> `GET()`  [INFERRED]
  lib\auth\session.ts → app\api\transactions\route.ts
- `DashboardPage()` --calls--> `getCurrentUser()`  [INFERRED]
  app\dashboard\page.tsx → lib\auth\session.ts

## Hyperedges (group relationships)
- **Secure Transaction Ingestion** — readme_browser_side_xlsx_parsing, readme_application_api, readme_postgresql, readme_transaction_deduplication [INFERRED 0.85]
- **Application Security Controls** — readme_server_side_database_access, readme_signed_http_only_session_cookie, readme_transactions_unique_constraint, readme_database_ssl [INFERRED 0.85]

## Communities

### Community 0 - "Platform and Data Architecture"

Cohesion: 0.14
Nodes (16): Application API, AUTH_SECRET, Browser-side XLSX Parsing, Create Superadmin Command, Database SSL, KasTok Ledger, Next.js, Node.js VPS (+8 more)

### Community 1 - "Performance Chart"

Cohesion: 0.13
Nodes (14): avg, chartTransactions, cumulative, cumulativeSeries, data, delta, grossSeries, grouped (+6 more)

### Community 2 - "Database and Page Loading"

Cohesion: 0.19
Nodes (9): getPool(), globalForPg, query(), assertAppEnv(), getAppEnv(), DashboardPage(), dynamic, Home() (+1 more)

### Community 3 - "Authentication Session Flow"

Cohesion: 0.26
Nodes (9): POST(), createSessionToken(), decode(), encode(), getCurrentUser(), SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions() (+1 more)

### Community 4 - "Ledger View"

Cohesion: 0.22
Nodes (8): [activeKey, setActiveKey], currentKey, grouped, keys, list, pageRef, summary, tabSummary

### Community 5 - "Financial Calculations"

Cohesion: 0.28
Nodes (4): isoWeekInfo(), periodKey(), periodLabel(), shortDate()

### Community 6 - "Administrator Bootstrap"

Cohesion: 0.25
Nodes (7): databaseUrl, email, hashPassword(), password, passwordHash, pool, scrypt

### Community 7 - "Transaction API"

Cohesion: 0.25
Nodes (4): config, middleware(), GET(), TYPES

### Community 8 - "Excel Import Parser"

Cohesion: 0.48
Nodes (6): fixSheetRange(), normalizeAmount(), parseDate(), parseFiles(), parseWorkbook(), validTypes

### Community 9 - "Export and Grouping"

Cohesion: 0.29
Nodes (3): groupByPeriod(), exportMonthlyRecap(), keys

### Community 10 - "Formatting Utilities"

Cohesion: 0.33
Nodes (1): idMonths

### Community 11 - "App Icon"

Cohesion: 0.5
Nodes (3): contentType, runtime, size

### Community 12 - "Brand Identity"

Cohesion: 0.83
Nodes (4): Kastok Logo, Musical Note Shopping Bag, Owl Shopping Bag Mascot, Social Commerce Branding

### Community 13 - "Root Layout"

Cohesion: 0.67
Nodes (1): metadata

### Community 14 - "Next Configuration"

Cohesion: 1.0
Nodes (1): nextConfig

### Community 15 - "Dashboard Orchestration"

Cohesion: 1.0
Nodes (0): 

### Community 16 - "Login UI"

Cohesion: 1.0
Nodes (0): 

### Community 17 - "Logout UI"

Cohesion: 1.0
Nodes (0): 

### Community 18 - "Setup Error UI"

Cohesion: 1.0
Nodes (0): 

### Community 19 - "Dashboard Controls"

Cohesion: 1.0
Nodes (1): value

### Community 20 - "Upload Interface"

Cohesion: 1.0
Nodes (0): 

### Community 21 - "Next Type Declarations"

Cohesion: 1.0
Nodes (0): 

### Community 22 - "Domain Types"

Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **48 isolated node(s):** `config`, `nextConfig`, `runtime`, `size`, `contentType` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Next Configuration`** (2 nodes): `nextConfig`, `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Orchestration`** (2 nodes): `Dashboard.tsx`, `Dashboard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login UI`** (2 nodes): `LoginForm.tsx`, `LoginForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logout UI`** (2 nodes): `LogoutButton.tsx`, `LogoutButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Setup Error UI`** (2 nodes): `SetupRequired.tsx`, `SetupRequired()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Controls`** (2 nodes): `SplitControls.tsx`, `value`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upload Interface`** (2 nodes): `UploadDropzone.tsx`, `UploadDropzone()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Type Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Domain Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `keys` connect `Export and Grouping` to `Excel Import Parser`, `Performance Chart`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `groupByPeriod()` connect `Export and Grouping` to `Financial Calculations`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `POST()` (e.g. with `createSessionToken()` and `sessionCookieOptions()`) actually correct?**
  _`POST()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getCurrentUser()` (e.g. with `Home()` and `GET()`) actually correct?**
  _`getCurrentUser()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `getAppEnv()` (e.g. with `Home()` and `DashboardPage()`) actually correct?**
  _`getAppEnv()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `nextConfig`, `runtime` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Platform and Data Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._