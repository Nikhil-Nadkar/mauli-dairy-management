# Dairy Management System

Simple two-branch dairy app: **React** (Vite, Tailwind, Recharts) + **FastAPI** (SQLAlchemy, Alembic, JWT) + **PostgreSQL**.
Runs locally (below) or for free on **Vercel + Supabase** (see "Deploy free").

## Run it locally

You need Python 3.12+, Node 20+ and a PostgreSQL database.

```bash
# 1. Backend  ->  http://localhost:8000  (API docs at /docs)
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt                      # requirements.txt if you don't need tests
cp .env.example .env                                     # then edit DATABASE_URL, SECRET_KEY, ADMIN_*
alembic upgrade head                                     # create the tables
python -m src.seed                                       # 2 branches, 7 products, first admin (safe to re-run)
uvicorn src.main:app --reload

# 2. Frontend  ->  http://localhost:5173  (forwards /api to the backend)
cd frontend
npm install
npm run dev
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`, then:
1. **Products & Prices** - set selling and cost price for both branches (nothing can be sold before this).
2. **Users** - create staff accounts and assign a branch.
3. **Stock → Stock arrived** - record incoming stock. Staff can now sell on **Sell**.

## Made for staff aged 50+ on Android phones
- Big text (20px base) and an extra **Bigger text** option in **My account**; strong contrast; every icon has words next to it.
- **English / मराठी** switch on the login screen and in My account (remembered on the phone).
  All screen text is in `frontend/src/i18n/en.js` and `mr.js` (same keys; a test fails if a Marathi key is missing).
  **Please have a Marathi speaker check `mr.js`.** Server error messages are English; the common ones are shown in Marathi.
- Bottom menu on phones (sidebar on bigger screens). One job per screen; sub-pages have a **Back** link.
- Selling: tap product → tap amount → **Check bill** → **Save sale**. Nothing is saved without seeing the bill.
- **Undo this sale** is offered for 5 minutes after saving (`UNDO_WINDOW_MINUTES`). Staff can undo only their own sales.
- Everything hard to take back asks first: undo, stock corrections, new stock, hiding a product, turning off a user, log out.

## Deploy free: Vercel (app) + Supabase (database)

One Vercel project serves both the app and the API from the same address (`vercel.json`, `api/index.py`),
so there is nothing to configure for CORS and `VITE_API_URL` stays empty.

**Why PostgreSQL (Supabase) and not SQLite:** the app relies on PostgreSQL to stop two staff selling the last litre
at the same moment, and to count "today" in India time. On Vercel the disk is wiped between requests, so a
SQLite file would lose your data.

### 1. Database (Supabase, free)
1. Create a project at supabase.com and pick the **Mumbai** region.
2. Go to **Connect**. Copy two connection strings and put your database password in both:
   - **Direct / Session** (port 5432): used from your own computer for setup.
   - **Transaction pooler** (port **6543**): used by Vercel.
3. On your computer, in `backend/`, put the **direct** string in `.env` as `DATABASE_URL`, then run:
   ```bash
   alembic upgrade head      # creates the tables
   python -m src.seed        # 2 branches, 7 products with the shop's quick buttons, your admin login
   ```

### 2. App (Vercel, free)
1. Push this folder to a GitHub repository. Make sure `.env` is **not** committed; `.gitignore` already excludes it.
2. At vercel.com choose **Add New → Project**, import the repository, and leave **Root Directory** as the repository root.
3. Under **Environment Variables**, add:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the **transaction pooler** string (port 6543) |
   | `SECRET_KEY` | a long random string: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
   | `APP_TIMEZONE` | `Asia/Kolkata` |
   | `CORS_ORIGINS` | your app address, e.g. `https://dairy.vercel.app` |
4. Click **Deploy**. Open the address, then check that `https://<your-app>.vercel.app/api/health` shows `{"status":"ok"}`.
5. Log in as the admin, then on **Products & Prices** set the selling and cost prices for both branches.
   For example, Lassi and Chaas at **₹200 per litre** give 100 ml = ₹20 and 150 ml = ₹30.
6. On **Users**, create the staff logins.

### Changing data directly (your "admin panel")
Supabase's **Table Editor** lets you see and edit every table.
- **Safe:** product names, branch names, user names and emails, viewing anything.
- **Never edit or delete rows in `sales`, `sale_items` or `stock_movements` by hand.** Stock is calculated from these rows.
  Use the app instead: **Undo this sale** within 5 minutes, or **Stock → Correct stock**.
- Prices and quick buttons are easier to change in the app (**Products & Prices**).

### Good to know (free plans)
- **Supabase pauses a free project after about 7 days without use.** Daily use keeps it awake; if it pauses, press **Restore** in the dashboard.
- **The free plan has no automatic backups.** Once a week, download a copy of the data, for example with
  `pg_dump "<direct connection string>" > backup.sql`, or use the dashboard's export.
- The first request after a quiet period can take a few seconds while Vercel starts the function.
- Database changes later (new migration files): run `alembic upgrade head` from your computer with the **direct** string.
- **If the deploy fails:** check the Vercel build log.
  - Python packages come from the root `requirements.txt`, which points to `backend/requirements.txt`.
  - The function is `api/index.py`.
  - Make sure `DATABASE_URL` uses port **6543**.

## Tests

```bash
cd backend
createdb dairy_test                                      # separate throw-away database - it is wiped every run
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/dairy_test pytest

cd frontend
npm test                                                 # tests
npm run lint                                             # ESLint (React hooks rules)
npm run format                                           # Prettier
```

## Backend layout (one self-contained folder per feature)

```
backend/src/
├── core/            config, database, security (JWT/bcrypt), error handlers, date helpers
├── modules/
│   ├── auth/        login, current user, branch-permission helpers   (routes, services, schemas, dependencies)
│   ├── users/       staff accounts                                   (routes, services, schemas, models)
│   ├── branches/    Branch 1 / Branch 2
│   ├── products/    products, quick buttons, low-stock limit, branch catalog
│   ├── prices/      selling + cost price per branch
│   ├── stock/       stock ledger, incoming stock, corrections, history
│   ├── sales/       sale creation (one transaction), sales records
│   └── reports/     totals, product/branch/daily numbers, low-stock list
├── seed.py          python -m src.seed
└── main.py          registers every module's router
```
To add a feature: create `modules/<name>/` with `models.py`, `schemas.py`, `services.py`, `routes.py`,
import its model in `core/registry.py`, register its router in `main.py`, then `alembic revision --autogenerate`.

## Frontend layout

```
frontend/src/
├── app/             AppShell (bottom menu / sidebar), navigation.js (menu items per role)
├── api/             client.js (axios + token), endpoints.js (every server call, by name)
├── i18n/            en.js, mr.js, LanguageContext (useT: t(), fmt.*, tError())
├── context/         AuthContext, BranchContext (useBranchScope("work" | "view"))
├── hooks/           useLoad / usePagedList (loading), useAction (save + message), useConfirm, useOnChange, useTextSize
├── components/ui/   Button, Form fields, Notice, Sheet, Segmented, Card/PageHeader/Tile, Badge, StatCard
├── components/      BranchPicker, LanguagePicker, StockStatus, Charts, QuickButtonsEditor
└── pages/           sales/, stock/, reports/, products/, users/, Dashboard, Login, Account, More
```
Pages decide data and flow; `components/ui` decides looks. New text goes in both `en.js` and `mr.js`.

## Rules the code enforces

**Branch security** - staff accounts have exactly one branch (a database rule). Every branch-related endpoint gets its branch from
`resolve_branch_id()` / `branch_filter()` in `modules/auth/dependencies.py`, never straight from the request, so a Branch 1 user who
edits a request to ask for Branch 2 gets `403`. The user is re-read on every request, so turning off an account or changing a
branch takes effect at once.

**Stock** - a ledger (`stock_movements`): available = received − sold + corrections. Nothing is ever overwritten. Anything that
reduces stock takes a per-branch-and-product lock, re-checks the stock, then saves; two cashiers selling the last litre at the same
moment cannot both succeed (there is a test that fails if the lock is removed).

**Sales** - one transaction: validate → lock → re-check stock → save the sale with a frozen copy of price and cost → deduct stock.
If anything fails, nothing is saved. Prices are never sent by the browser; the server looks them up for the branch.
Each line is rounded half-up to the paisa and the sale total is the sum of the lines (the browser uses the same rule).

**Money and quantities** - `NUMERIC` in the database, `Decimal` in Python, whole numbers (paise, thousandths) in the browser.
Quantities are stored in litres/kg (500 ml = `0.500`).

**Reports** - "today" and every day boundary use `APP_TIMEZONE` (default `Asia/Kolkata`), not UTC.
Gross profit = selling amount − cost saved at the time of sale. It is **not** net profit: rent, electricity, salaries and other
expenses are not included (the screens say so).

## Decisions you may want to change
- **Reports are owner-only.** They show cost and profit, and the menu you specified gives staff no Dashboard/Reports. The branch
  filter is already wired in, so opening a staff-safe view (without cost/profit) later is a small change.
- **Low-stock limit** is one number per product (default 5 L/kg), shared by both branches. Set it on Products & Prices.
- **"Items sold"** on the dashboard counts product lines across all sales (litres and kilos can't be added together).
- **Undo deletes the sale** (with its stock deductions), so it leaves no record. That is fine for "tapped by mistake within
  5 minutes". Older mistakes are fixed with a stock correction. If you want a record of undone sales, add a `voided_at` column
  and filter it out of reports.
- Logins are not rate-limited, and the token is kept in the browser's localStorage (12 hours). Fine for an internal app.
