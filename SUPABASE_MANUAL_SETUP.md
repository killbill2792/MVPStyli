# Manual Supabase Setup Guide

Since you prefer to setup tables manually, here are the exact steps to create the `friends` table and add sample data.

## 1. Create the `friends` table

1. Go to your Supabase project dashboard.
2. Click **Table Editor** (spreadsheet icon) in the left sidebar.
3. Click **New Table**.
4. **Name**: `friends`
5. **Columns**:
   - `id`: UUID (Primary Key) - *Leave default*
   - `user_id`: UUID - *Required*
     - Click the link icon 🔗 next to it.
     - Select `auth.users` table and `id` column.
     - Action: `Cascade` (for both Update and Delete).
   - `friend_id`: UUID - *Required*
     - Click the link icon 🔗 next to it.
     - Select `auth.users` table and `id` column.
     - Action: `Cascade`.
   - `status`: Text - *Default Value: 'accepted'*
   - `created_at`: Timestamptz - *Leave default*
6. Click **Save**.

## 2. Disable RLS (temporarily for testing)

For easiest testing, you can disable RLS on the `friends` table:
1. In the Table Editor, click `friends` table.
2. Click **RLS** button in the top bar.
3. Click **Disable RLS**.
*(If you want RLS enabled, you'll need to add a policy allowing SELECT/INSERT for authenticated users).*

## 3. Add Friends Manually

1. Go to **Authentication** -> **Users** to find the User IDs (UUIDs) for:
   - `stylit@stylit.com` (Copy this ID, let's call it `ID_A`)
   - `esther@stylit.com` (Copy this ID, let's call it `ID_B`)
   - `john@stylit.com` (Copy this ID, let's call it `ID_C`)

2. Go back to **Table Editor** -> `friends`.
3. Click **Insert Row**.
4. **Row 1**:
   - `user_id`: Paste `ID_A` (Stylit)
   - `friend_id`: Paste `ID_B` (Esther)
   - `status`: `accepted`
5. Click **Save**.

6. **Row 2** (Reverse direction - important for both to see each other):
   - `user_id`: Paste `ID_B` (Esther)
   - `friend_id`: Paste `ID_A` (Stylit)
   - `status`: `accepted`
7. Click **Save**.

8. Repeat for John (`ID_C`) if you want him as a friend too.

## 4. Add `product_url` column to `pods` table (if missing)

1. Go to **Table Editor** -> `pods`.
2. Click the **+** (Add Column) button.
3. **Name**: `product_url`
4. **Type**: Text
5. Click **Save**.

This will fix the "Could not find product_url" error.



