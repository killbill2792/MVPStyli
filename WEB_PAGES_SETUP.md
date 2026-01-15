# Web Pages Setup Guide

## Overview
The email confirmation and password reset flows are handled entirely on the web. Users receive email links, complete the action on the web page, and then can open the app.

## Files to Upload

Upload these files to your web server at `www.stylit.ai`:
- `index.html` → `www.stylit.ai/index.html` (handles redirects from base URL)
- `confirm_email.html` → `www.stylit.ai/confirm_email.html`
- `reset_password.html` → `www.stylit.ai/reset_password.html`

**Important:** The `index.html` file is crucial because Supabase sometimes redirects to the base URL (`stylit.ai`) instead of the specific pages. This file detects the token type and redirects to the correct page.

## Configuration

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 2: Update HTML Files

Open both `confirm_email.html` and `reset_password.html` and replace these placeholders:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your project URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your anon key
```

For example:
```javascript
const SUPABASE_URL = 'https://rlbfdnzwkgxzsaetddt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Step 3: Configure Supabase Dashboard

1. Go to **Authentication** → **URL Configuration**
2. Add these redirect URLs:
   - `https://www.stylit.ai` (base URL - will be handled by index.html)
   - `https://stylit.ai` (base URL without www - will be handled by index.html)
   - `https://www.stylit.ai/confirm_email.html`
   - `https://stylit.ai/confirm_email.html` (without www, as backup)
   - `https://www.stylit.ai/reset_password.html`
   - `https://stylit.ai/reset_password.html` (without www, as backup)

**Note:** Supabase may redirect to the base URL (`stylit.ai`) with hash fragments. The `index.html` file will detect the token type and redirect to the appropriate page automatically.

### Step 4: Server Configuration

Ensure your server:
- Serves HTML files with `Content-Type: text/html`
- Allows the Supabase JS library to load from CDN (https://cdn.jsdelivr.net)
- Handles hash fragments in URLs (the `#access_token=...` part)

## How It Works

### Email Confirmation Flow:
1. User signs up → receives email with link to `stylit.ai/confirm_email.html#access_token=...`
2. User clicks link → web page automatically confirms email by setting Supabase session
3. Web page shows success message with "Open App" button
4. User clicks "Open App" → app opens (no tokens needed, email already confirmed)

### Password Reset Flow:
1. User requests password reset → receives email with link to `stylit.ai/reset_password.html#access_token=...`
2. User clicks link → web page shows password reset form
3. User enters new password and confirms → web page updates password via Supabase
4. Web page shows success message with "Open App" button
5. User clicks "Open App" → app opens (user can now sign in with new password)

## Testing

1. **Test Email Confirmation:**
   - Sign up with a new account
   - Check email and click confirmation link
   - Verify email is confirmed on web page
   - Click "Open App" button to verify app opens

2. **Test Password Reset:**
   - Request password reset
   - Check email and click reset link
   - Enter new password on web page
   - Verify password is updated
   - Click "Open App" button and sign in with new password

## Troubleshooting

- **HTML files downloading instead of displaying:** Check server MIME type configuration
- **Supabase errors:** Verify credentials are correct in HTML files
- **Links not working:** Ensure redirect URLs are added in Supabase Dashboard
- **"Open App" button not working:** Verify `stylit://` deep link is configured in your app
