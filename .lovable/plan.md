

# Fix: Login "Invalid login credentials"

## Root Cause

The admin user `admin@gmail.com` was created in Supabase Auth, but the password stored does not match "Admin@2015". This is a credential mismatch in the Supabase Auth database, not a code bug.

## Solution

Run a Supabase migration to update the user's password using the `auth.admin` API. Since we cannot modify `auth.users` directly via SQL migration, we will:

1. **Create a short-lived Edge Function** (or use the Supabase dashboard) to reset the password. However, the simplest approach is:

2. **Use `supabase.auth.admin.updateUserById`** — but we don't have direct admin access from code.

**Recommended approach:** Delete and re-create the user with the correct password via the Supabase dashboard:
   - Go to [Supabase Auth Users](https://supabase.com/dashboard/project/hkzytmnbqfmvknvqpsmc/auth/users)
   - Delete the existing `admin@gmail.com` user
   - Create a new user with email `admin@gmail.com` and password `Admin@2015`
   - Ensure "Auto Confirm User" is checked

**OR** (automated, no manual steps):

3. **Create an Edge Function** to reset the admin password using the service role key, call it once, then delete it.

## Technical Details

- The login code itself is working correctly — it calls `supabase.auth.signInWithPassword()` and properly displays the error from Supabase
- The error "Invalid login credentials" confirms the auth flow reaches Supabase but the credentials don't match
- No code changes are needed — only the Supabase user password needs to be corrected

## Recommended Action

I will create a one-time Edge Function that uses the service role key to update the admin user's password to `Admin@2015`, invoke it, then delete it. This avoids any manual dashboard steps.

