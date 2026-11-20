# CLAUDE.md

Two-branch dairy shop app. **React 19 + Vite + Tailwind v4** frontend, **FastAPI + SQLAlchemy + Alembic + PostgreSQL** backend.
Users are counter staff and owners **aged 50–60, mostly on Android phones**. Every UI change must respect that (see "UI rules").

## Commands

```bash
# Backend (from backend/)
pip install -r requirements-dev.txt
cp .env.example .env                      # DATABASE_URL, SECRET_KEY (>=32 chars), ADMIN_EMAIL/PASSWORD
alembic upgrade head
python -m src.seed                        # 2 branches, 7 products, first admin; safe to re-run
uvicorn src.main:app --reload             # http://localhost:8000, docs at /docs
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/dairy_test pytest
#   ^ needs a real PostgreSQL (advisory locks, timezone()); DB name must contain "test" - it is wiped

# Frontend (from frontend/)
npm install
npm run dev                               # http://localhost:5173, proxies /api -> localhost:8000
npm test                                  # vitest + Testing Library (jsdom)
npm run lint                              # ESLint flat config, react-hooks v7 rules (strict)
npm run format                            # Prettier, printWidth 120
npm run build
```
Before finishing frontend work run: `npm run format && npm run lint && npm test && npm run build`.

## Deployment (Vercel + Supabase PostgreSQL)
- One Vercel project at the repo root: `vercel.json` builds `frontend/` (output `frontend/dist`) and rewrites `/api/*` to the
  Python function `api/index.py`, which adds `backend/` to `sys.path` and imports `src.main:app`. Same origin, so no CORS needed.
- Root `requirements.txt` just does `-r backend/requirements.txt`; add Python packages to the backend file only.
- When `VERCEL` is set, `core/database.py` uses `NullPool`; `DATABASE_URL` on Vercel is Supabase's transaction pooler (port 6543).
  Migrations and seed run from a developer machine with the direct connection string.
- Stay on PostgreSQL: advisory locks and `timezone()` are relied on; SQLite would also be wiped on Vercel.

## Backend layout (`backend/src/`)
- `core/` config (env settings, incl. `APP_TIMEZONE`, `UNDO_WINDOW_MINUTES`), database (`MONEY`/`QTY` NUMERIC types), security (JWT/bcrypt), errors (every error -> `{"detail": "plain sentence"}`), dates (business-day helpers), registry (imports all models for Alembic).
- `modules/<feature>/` = `models.py`, `schemas.py`, `services.py`, `routes.py`. Features: auth, users, branches, products, prices, stock, sales, reports.
- New feature: add the module, import its model in `core/registry.py`, register router in `main.py`, `alembic revision --autogenerate`.

### Backend rules (do not break)
- **Branch security:** branch ids always come from `resolve_branch_id()` (actions on ONE branch) or `branch_filter()` (lists/reports, admin may get `None` = both) in `modules/auth/dependencies.py`. Never trust `branch_id` from the request directly. Staff are locked to their own branch.
- **Stock is a ledger** (`stock_movements`): available = SUM(quantity_change). Never overwrite. Anything that *reduces* stock must `lock_stock()` each (branch, product) in **ascending product id order**, re-read `available_stock()`, refuse if < 0, then insert + commit in one transaction.
- **Sales:** server looks up prices (browser never sends them); price and cost are frozen on each `SaleItem`; each line rounded half-up to the paisa, total = sum of lines. `create_sale` is split into `_merge_quantities -> _load_products_and_prices -> _lock_and_check_stock -> _build_items -> _receipt`.
- **Undo sale:** `POST /api/sales/{id}/undo`, within `UNDO_WINDOW_MINUTES` (default 5). Staff: own sales in own branch only (other branch -> 404, other user -> 403); owner: any. It **deletes** the sale and its stock movements (no audit record - deliberate).
- **Money/quantities:** `Decimal` + NUMERIC; quantities stored in base units (litre/kg, 500 ml = `0.500`).
- **Dates:** "today" and day boundaries use `APP_TIMEZONE` (Asia/Kolkata), not UTC.
- Error messages are plain English sentences for non-technical users (the frontend translates common ones - see i18n).
- Gross profit = sales − frozen cost. It is NOT net profit; screens say so.

## Frontend layout (`frontend/src/`)
```
app/            AppShell.jsx (phone bottom menu / desktop sidebar), navigation.js (menu per role - single source)
App.jsx         routes; Dashboard + Reports are lazy-loaded (only they pull in recharts)
api/            client.js (axios, token, 401 -> logout, errorMessage()), endpoints.js (EVERY server call, by name)
i18n/           en.js, mr.js (nested keys, {placeholder}s), LanguageContext.jsx -> useT()
context/        AuthContext (useAuth), BranchContext (useBranchScope("work" | "view"))
hooks/          useLoad + usePagedList (useLoad.js), useAction, useConfirm, useOnChange, useTextSize
components/ui/  Button/ButtonLink, Form (Field, TextInput, NumberInput, Select, Checkbox), Feedback (Notice,
                ErrorNotice, Loading, EmptyState), Sheet (modal / bottom sheet), Segmented, Layout (Card,
                PageHeader, Section, Tile, Facts), Badge, StatCard (+ GrossProfitNote)
components/     BranchPicker, LanguagePicker, StockStatus, Charts, QuickButtonsEditor, ErrorBoundary, ProtectedRoute
pages/          Login, Account, More, Dashboard, sales/, stock/, reports/, products/, users/
utils/          cart.js (exact cart maths in paise / thousandths), format.js (lang-aware formatters), storage.js
test/           setup.js, render.jsx (renderPage = MemoryRouter + LanguageProvider + BranchProvider)
```

### Frontend conventions
- **Pages handle data and flow; `components/ui` handles looks.** Don't write raw Tailwind buttons/inputs in pages - use the ui components. Keep page files ≲150 lines; split into sibling files in the page's folder.
- **Data loading:** `const loader = useCallback(() => getX(scope.params), [scope.params]); const { data, error, loading, reload } = useLoad(loader, { enabled: scope.ready });` Lists with "Show more" use `usePagedList(fetchPage, { pageSize })`.
- **Saving:** `const { busy, notice, run, fail } = useAction(); await run(() => saveX(...), t("..."))` returns true/false and sets the green/red `notice`. `fail(text)` for checks done in the browser. Show it with `<Notice notice={notice} />`.
- **Confirm before anything hard to undo:** `const { confirm, confirmDialog } = useConfirm(); if (await confirm({ title, message, yes, tone: "danger" })) ...` and render `{confirmDialog}`.
- **Branch:** `useBranchScope("work")` for Sell/Stock (always one branch), `useBranchScope("view")` for Home/Reports (owner may pick "Both", `branchId === null`). Spread `scope.params` / `scope.body` into API calls ({} for staff). Show `<BranchPicker scope={scope} />` under the page title.
- **After a sub-page saves**, navigate back with `navigate("/stock", { state: { notice: { ok: true, text } } })`; the target page shows `location.state?.notice`.
- Reset state when a value changes with `useOnChange(value, reset)` (not an effect - lint forbids setState in effects).
- Never define components inside components (lint error). Never call setState synchronously in useEffect.
- localStorage only through `utils/storage.js` (it can throw on some phones).

### i18n (English + Marathi)
- **Every visible word goes through `t("section.key", vars)`** from `useT()`. Add every new key to **both** `en.js` and `mr.js` with the same `{placeholders}` - `i18n/i18n.test.js` fails otherwise.
- Quantities/dates/prices via `fmt` from `useT()`: `fmt.qty`, `fmt.rupees`, `fmt.pricePerUnit`, `fmt.unitShort/unitLong`, `fmt.quickLabel`, `fmt.day`, `fmt.dateTime`. Digits stay 0-9 in Marathi.
- Server errors: `tError(errorMessage(err))` (already done inside useAction/useLoad). To translate a new common server message, add a regex to `SERVER_MESSAGES` in `LanguageContext.jsx` and a `server.*` key in `mr.js`.
- Data is stored in English (e.g. stock-correction reasons in `pages/stock/reasons.js`) and translated only for display. Product names are shown as typed.
- `mr.js` was machine-written - a Marathi speaker should review changes.

## UI rules (users are 50–60, on phones)
- Design phone-first at **360px wide**; no sideways scrolling. Bottom menu height is the CSS var `--nav-height`; sticky bottom elements use `bottom-[calc(var(--nav-height)+0.75rem)] md:bottom-4`.
- Base font 20px (`html[data-text-size="large"]` = 23px). Tap targets ≥ `min-h-14`. Important text no lighter than `text-slate-700`.
- Use strong-contrast colours (`sky-700`, `green-700`, `red-700` with white text). Icons (lucide-react) always **with** words; meaning never by colour alone (chosen Segmented option shows a tick).
- Labels above inputs in bold, never placeholder-only. Number boxes show their unit (`<NumberInput unit=...>`) and open the number keypad.
- One job per screen; big `Tile` menus; sub-pages get `PageHeader backTo=...`. Messages are big, stay until the next action, and say what to do next.
- Confirm before: saving/undoing sales, stock corrections and new stock, hiding products, turning off/moving users, logging out.
- Disable buttons while saving (`busy` + `busyText`) to stop double taps.

## Testing notes
- Frontend tests mock `api/client.js` (default `get`/`post`) and `context/AuthContext.jsx` (`useAuth`) with `vi.mock`, then render with `renderPage()` from `test/render.jsx`. `localStorage` is cleared after each test; set `dairy_language` to `"mr"` before render to test Marathi.
- Sheets render in a portal with `role="dialog"`; query inside with `within(screen.getByRole("dialog"))`. Notices have `role="status"`; in-sheet errors `role="alert"`.
- Keep English test strings in sync with `en.js`.
- Backend tests: fixtures in `tests/conftest.py` (`client`, `admin_h`, `staff1_h`, `auth(client, email)`), helpers in `tests/helpers.py` (`setup_shop`, `sell`, `receive`, `stock_of`, ...). Branch 1 / Branch 2, staff1 in branch 1, staff2 in branch 2.

## Gotchas
- `UNDO_MINUTES` in `frontend/src/api/endpoints.js` must match backend `UNDO_WINDOW_MINUTES`.
- ESLint uses `eslint-plugin-react-hooks` only (eslint-plugin-react doesn't support ESLint 10); `no-unused-vars` ignores capitalised names because JSX usage isn't detected.
- Quick-button labels are built from the quantity by `quickLabel()` in `utils/format.js` (both languages): `{ main, detail }`,
  e.g. 0.25 kg -> "Pav kilo" + "250 g", 0.5 L -> "Half litre" / "अर्धा लिटर". The stored `label` is not shown (kept for the API;
  `makeQuickButton` and `seed.py` store the same English words). Bill/stock screens always show exact amounts.
- Default quick buttons live in `backend/src/seed.py` (new databases) and migration `0003_shop_quick_buttons.py` (existing
  databases; only replaces buttons still equal to the old defaults). Change both if the shop's defaults change.
- Old route `/stock-overview` redirects to `/stock`.
