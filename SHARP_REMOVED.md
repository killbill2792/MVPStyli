# Removed `sharp` from React Native Dependencies

## Why

`sharp` is a **Node.js library** with native bindings that's only used in API routes (server-side):
- `api/color/index.ts`
- `api/analyze-skin-tone/index.ts`
- `api/ocr-sizechart/index.ts`

It should **NOT** be in React Native dependencies because:
1. It's a Node.js library, not a React Native library
2. It has native bindings that could interfere with React Native's native module system
3. Metro bundler might try to bundle it, causing Fabric registration crashes

## Impact

- ✅ **API routes will still work** - They run on Vercel/server, not in the React Native app
- ✅ **React Native app won't try to bundle sharp** - This should fix the Fabric crash

## If API Routes Need Sharp

If your API routes need `sharp` and it's not available, you can:
1. Add it to `devDependencies` (for local development)
2. Or ensure it's installed in your Vercel/server environment separately

## Next Step

**Rebuild with --clear-cache:**

```bash
npx eas-cli build --platform ios --profile development --clear-cache
```

This should finally fix the Fabric crash!
