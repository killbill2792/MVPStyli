# Creating Demo Users - Instructions

## Option 1: Using Supabase Dashboard (Recommended for Testing)

1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add User" or "Invite User" for each email:
   - stylit@stylit.com (activate existing)
   - esther@stylit.com
   - sheba@stylit.com
   - amy@stylit.com
   - john@stylit.com
   - helloworld27@stylit.com

3. For each user:
   - Email: [user email]
   - Password: Stylit@123
   - Auto Confirm: ✅ (check this to skip email verification)
   - User Metadata: Add these fields:
     ```json
     {
       "name": "Esther",
       "gender": "female",
       "location": "New York, USA"
     }
     ```

4. After creating users, run the SQL script in `scripts/activateUsers.sql` to:
   - Activate the existing stylit@stylit.com user
   - Create necessary tables (profiles, saved_fits, boards)

5. Then use the app to sign in with each user, and the demo data will be automatically created.

## Option 2: Using SQL (Direct Database)

Run this in Supabase SQL Editor:

```sql
-- First, create the users via Supabase Auth API or Dashboard
-- Then run this to activate and add metadata:

-- Activate stylit@stylit.com
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    confirmed_at = NOW(),
    raw_user_meta_data = jsonb_build_object(
      'name', 'Stylit User',
      'gender', 'other',
      'location', 'San Francisco, USA'
    )
WHERE email = 'stylit@stylit.com';

-- For other users, you'll need their user IDs after creation
-- Update their metadata:
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
  'name', 'Esther',
  'gender', 'female',
  'location', 'New York, USA'
)
WHERE email = 'esther@stylit.com';

-- Repeat for other users...
```

## Option 3: Using the App (Automatic)

The app now automatically:
1. Activates users on signup (bypasses email verification)
2. Creates demo data when users sign up
3. Stores user metadata (name, gender, location)

Just sign up each user through the app, and demo data will be created automatically.

## User Details

| Email | Name | Gender | Location | Password |
|-------|------|--------|----------|----------|
| stylit@stylit.com | Stylit User | other | San Francisco, USA | Stylit@123 |
| esther@stylit.com | Esther | female | New York, USA | Stylit@123 |
| sheba@stylit.com | Sheba | female | Los Angeles, USA | Stylit@123 |
| amy@stylit.com | Amy | female | Chicago, USA | Stylit@123 |
| john@stylit.com | John | male | Tokyo, Japan | Stylit@123 |
| helloworld27@stylit.com | Hello World | male | Paris, France | Stylit@123 |

## Demo Data Created for Each User

- **3 Saved Fits**: Mix of public and private visibility
- **2 Boards**: "Summer Vibes" (public) and "Work Essentials" (private)
- **1 Demo Pod**: Global mix pod for testing voting/comments



