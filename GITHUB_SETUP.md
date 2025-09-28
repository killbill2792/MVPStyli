# GitHub Setup Instructions

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `MVPStyli`
5. Description: `AI-powered fashion try-on app built with React Native, Expo, Supabase, and Replicate AI`
6. Make it **Public**
7. **DO NOT** initialize with README, .gitignore, or license
8. Click "Create repository"

## Step 2: Connect Local Repository

After creating the repository, GitHub will show you commands. Use these:

```bash
git remote add origin https://github.com/YOUR_USERNAME/MVPStyli.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 3: Verify Upload

After pushing, you should see all your files on GitHub including:
- App.js (main app file)
- lib/ folder (API integrations)
- api/ folder (Vercel functions)
- SETUP_GUIDE.md
- package.json
- All other project files

## Step 4: Deploy on Vercel

Once on GitHub, you can:
1. Go to [Vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Deploy the API functions
4. Get your Vercel URL for the app

## Step 5: Set up Supabase

1. Go to [Supabase.com](https://supabase.com)
2. Create a new project
3. Get your credentials
4. Update .env.local with real values

## Next Steps

After everything is set up, you'll have:
- ✅ Code on GitHub
- ✅ API deployed on Vercel
- ✅ Database on Supabase
- ✅ Fully functional app ready for testing
