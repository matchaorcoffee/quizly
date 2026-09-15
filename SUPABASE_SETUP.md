# Supabase Setup Guide

Follow these steps to connect Quizly to your own Supabase project.

---

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization, enter a project name (e.g. `quizly`), set a strong database password, and choose a region.
4. Wait for the project to finish provisioning (~1 minute).

---

## 2. Run the database schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) into the editor.
4. Click **Run** (or press `Ctrl+Enter`).

This creates the `profiles`, `quizzes`, `questions`, and `choices` tables, enables Row Level Security with appropriate policies, and installs a trigger that auto-creates a profile row when a user signs up.

---

## 3. Enable Email/Password authentication

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. Under **Authentication → Settings**, you can optionally disable **Confirm email** for development so users can sign in immediately without email verification.

---

## 4. Copy your project credentials

1. Go to **Settings → API** in the Supabase dashboard.
2. Copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public** key — the long JWT token under **Project API keys**

---

## 5. Create your `.env` file

In the root of the project, create a file named `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace the values with the URL and anon key from step 4.

> **Never commit `.env` to git.** It is already listed in `.gitignore`.

---

## 6. Run the development server

```bash
npm install
npm run dev
```

Open [http://localhost:5173/quizly/](http://localhost:5173/quizly/) and create an account to get started.

---

## Notes

- The **anon key** is safe to use in frontend code — it is restricted by Row Level Security policies.
- Never use the **service role key** in frontend code.
- Each user can only see and modify their own quizzes (enforced by RLS).
