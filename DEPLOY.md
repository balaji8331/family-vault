# FamilyVault Deployment & Staging Checklist

This document outlines the step-by-step process for deploying FamilyVault to Vercel and configuring the necessary Supabase backend services.

## 1. Vercel Deployment

1. **Connect Repository:**
   - Log in to Vercel and click **Add New Project**.
   - Import the FamilyVault GitHub repository.
   - Leave the framework preset as **Next.js**.

2. **Set Environment Variables:**
   Add the following environment variables in the Vercel dashboard before clicking deploy.

   | Variable Name | Description |
   | ------------- | ----------- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxxxxx.supabase.co`) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public anon key for Supabase client-side requests |
   | `SUPABASE_SERVICE_ROLE_KEY` | The secret service role key for bypassing RLS on the server (Keep Secret!) |
   | `RESEND_API_KEY` | Your Resend API key for sending transactional emails (sharing & expiry) |
   | `NEXT_PUBLIC_APP_URL` | The fully qualified domain name of your app (e.g., `https://familyvault.vercel.app`) |

3. **Deploy:**
   - Click **Deploy**. Vercel will automatically build the Next.js app using Turbopack and deploy it.

## 2. Supabase Configuration

### Edge Functions
Deploy the `check-expiry` edge function to your Supabase project. This handles automated expiry notification emails.

Run this command locally using the Supabase CLI:
```bash
supabase functions deploy check-expiry
```
*Note: Ensure you have linked your local project to the remote Supabase project (`supabase link`). You will also need to set the `RESEND_API_KEY` secret in Supabase for the edge function: `supabase secrets set RESEND_API_KEY=your_key`*

### Cron Jobs
Set up `pg_cron` to trigger the edge function daily.
1. Go to the Supabase Dashboard -> **Database** -> **Cron Jobs**.
2. Create a new job:
   - **Name:** `daily_expiry_check`
   - **Schedule:** `30 2 * * *` (e.g., 2:30 AM UTC / 8:00 AM IST)
   - **Command:** Add an HTTP request (`net.http_post`) pointing to your deployed Edge Function URL with your anon key in the Authorization header.

## 3. PWA Icons Reminder
Before final production launch, replace the placeholder icons in the `public/icons/` directory:
- `public/icons/icon-192.png` (192x192 pixels)
- `public/icons/icon-512.png` (512x512 pixels)

## 4. Post-Deploy Smoke Test Checklist

Once deployed, run through this list to verify all systems are operational:
- [ ] **Auth:** Register a new user via Magic Link / Google OAuth. Verify Passkey registration works.
- [ ] **Upload:** Upload a test document. Verify the progress indicator completes and the file appears in the dashboard.
- [ ] **View:** Click the document and ensure the local decryption works properly.
- [ ] **Share:** Share the document with another user. Verify the recipient gets the Resend email.
- [ ] **Audit Logs:** Go to Settings -> Audit Logs. Verify your upload, view, and share actions were tracked.
- [ ] **Delete:** Test the new delete flow. Verify the file is completely removed.
- [ ] **Expiry Toggle:** In the document viewer, toggle the "Expiry Reminders" switch.
- [ ] **CSP Verification:** Open browser DevTools (F12) -> Console. Ensure there are no Content Security Policy violation errors breaking functionality (especially OCR).
