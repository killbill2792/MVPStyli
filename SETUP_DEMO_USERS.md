# Setup Demo Users - Quick Guide

## Step 1: Activate Existing User & Create New Users

### Option A: Using Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard → Authentication → Users**
2. For each user, click **"Add User"** or **"Invite User"**:
   - Email: [user email]
   - Password: `Stylit@123`
   - **Auto Confirm User**: ✅ (Check this to skip email verification)
   - **User Metadata** (click "Add Metadata"):
     ```json
     {
       "name": "Esther",
       "gender": "female",
       "location": "New York, USA"
     }
     ```

3. Repeat for all users:
   - stylit@stylit.com (activate existing)
   - esther@stylit.com
   - sheba@stylit.com
   - amy@stylit.com
   - john@stylit.com
   - helloworld27@stylit.com

### Option B: Using SQL Script

Run `scripts/activateAndSetupUsers.sql` in Supabase SQL Editor. This will:
- Activate all users (bypass email verification)
- Set user metadata (name, gender, location)
- Create necessary tables (profiles, saved_fits, boards)

## Step 2: Create Demo Data

After users are created, demo data will be automatically created when they:
1. Sign up through the app, OR
2. Sign in for the first time (if you manually create users)

The app will automatically:
- Create 3 saved fits per user
- Create 2 boards per user
- Create 1 demo pod per user

## User Details

| Email | Name | Gender | Location | Password |
|-------|------|--------|----------|----------|
| stylit@stylit.com | Stylit User | other | San Francisco, USA | Stylit@123 |
| esther@stylit.com | Esther | female | New York, USA | Stylit@123 |
| sheba@stylit.com | Sheba | female | Los Angeles, USA | Stylit@123 |
| amy@stylit.com | Amy | female | Chicago, USA | Stylit@123 |
| john@stylit.com | John | male | Tokyo, Japan | Stylit@123 |
| helloworld27@stylit.com | Hello World | male | Paris, France | Stylit@123 |

## Testing Flow

1. **Sign in** with any user (e.g., esther@stylit.com / Stylit@123)
2. **Check Style Vault** - should see saved fits, boards, demo pod
3. **Create a Pod** - test pod creation flow
4. **Vote on Pods** - test voting functionality
5. **Try-On** - test AI try-on feature
6. **Save Outfits** - test saving from try-on results

## Notes

- All users are pre-activated (no email verification needed)
- Demo data is created automatically on first sign-in
- Each user has unique location and gender for testing
- Pods, votes, and comments are ready for testing



