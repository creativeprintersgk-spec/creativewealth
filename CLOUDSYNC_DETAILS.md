# WealthCore Cloud Sync & Recovery Details

This document contains critical information for maintaining and recovering the WealthCore PMS cloud infrastructure.

## 📁 Source Control (GitHub)
*   **Repository URL**: `https://github.com/creativeprintersgk-spec/creativewealth`
*   **Primary Branch**: `main`
*   **Git Config Email**: `creativeprintersgk@gmail.com`
*   **Git Config Name**: `creativeprintersgk`

## 🚀 Deployment (Vercel)
*   **Production URL**: `https://wealthcore-clean.vercel.app`
*   **Project Dashboard**: `https://vercel.com/saahil-s-projects/wealthcore-clean`
*   **Deployment Method**: Linked to GitHub (Auto-deploys on push to `main`)
*   **Manual Deploy Command**: `npx vercel --prod --yes` (Run from local project folder)

## 🗄️ Database (Supabase)
*   **Project URL**: `https://ajjeoijjsklgkioxqkrb.supabase.co`
*   **Project Dashboard**: `https://supabase.com/dashboard/project/ajjeoijjsklgkioxqkrb`
*   **API Credentials** (Also found in `.env`):
    *   `VITE_SUPABASE_URL`: `https://ajjeoijjsklgkioxqkrb.supabase.co`
    *   `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (See .env for full key)

## 🛠️ Critical Maintenance Scripts
If you ever need to re-migrate data or debug the cloud sync, use these scripts in the `scratch/` folder:
1.  **`migrate_to_supabase.ts`**: Re-syncs local `db.json` to the cloud.
2.  **`inspect_holdings_data.ts`**: Verifies if investment data is correctly visible in Supabase.
3.  **`simulate_holdings.ts`**: Tests the accounting engine logic against live cloud data.

## 🔐 Recovery Steps
If you lose access to the local environment:
1.  **Clone the Repo**: `git clone https://github.com/creativeprintersgk-spec/creativewealth.git`
2.  **Install Dependencies**: `npm install`
3.  **Setup Environment**: Create a `.env` file with the Supabase credentials listed above.
4.  **Run Locally**: `npm run dev`

---
**Note**: Keep this file safe. It contains the keys to your financial data infrastructure.
