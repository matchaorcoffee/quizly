# Deploying to GitHub Pages with Supabase

Quizly is deployed to GitHub Pages via `npm run deploy` (uses `gh-pages`).
Because environment variables are embedded at **build time** by Vite, you must
provide them to the build environment before running the deploy.

---

## Option A — GitHub Actions (recommended for CI/CD)

1. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
2. Add two repository secrets:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon public key

3. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Option B — Manual deploy from your machine

Create a `.env` file in the project root (already gitignored):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Then run:

```bash
npm run deploy
```

This builds the app (Vite reads `.env` and embeds the values) and pushes the
`dist/` folder to the `gh-pages` branch.

---

## Important

- The **anon key** is safe to expose in a built frontend — it is a public key
  restricted by Row Level Security. It is NOT a secret.
- Never expose the **service role key** anywhere in frontend code or secrets
  that end up in the built bundle.
