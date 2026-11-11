# Turn on your real login (about 5 minutes)

You do this once. You need no technical skills. Nothing here shows a password to anyone else.

## 1. Make your login in Supabase
1. Open Vercel, team `cc-5748`, then **Storage**. Click the Supabase database, then **Open in Supabase**.
2. In Supabase, click **Authentication** in the left bar, then **Users**.
3. Click **Add user**, then **Create new user**.
4. Type your work email (`leo@cornellcommunities.com`) and a long password of your own (12 characters or more). Tick **Auto Confirm User**. Click **Create user**.

## 2. Turn off public sign-up
1. In Supabase, click **Authentication**, then **Sign In / Providers** (the name may read **Providers**).
2. Open **Email** and switch **Allow new users to sign up** off. Save.
This portal is invitation only. Without this switch, a stranger could make a Supabase login. They would still get no access, because the portal gives nothing to people it does not know, but closing the door is cleaner.

## 3. Sign in
Go to the portal, enter that email and password. The first time, the portal makes you the owner. It does this only for the email stored in the Vercel setting `CCOS_OWNER_EMAIL`, and only while no owner exists.

## What works today
- Real sign-in with your own password
- Your role is read from the database on every click. Remove a person's access and their next click fails.
- The demo accounts keep working for testers (fictional data)

## What does not work yet
- Adding teammates inside the portal (the Admin page still uses demo data). For now add them in Supabase as in step 1, and ask Claude to give them a role.
- Two-step login (MFA), password reset by email, invitation emails
- Live data. Everything on screen is still fictional until Asana and Rent Manager are connected.
