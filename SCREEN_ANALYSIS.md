# Screen Analysis: AccountScreen vs StyleVaultScreen

## Finding: AccountScreen is Currently Unused (Redundant)

### Current State:
- **AccountScreen** (`screens/AccountScreen.js`): Imported in `App.js` but **never used** in routing
- **StyleVaultScreen** (`screens/StyleVaultScreen.js`): **Actually used** when route is `'account'` (line 2287 in App.js)
- **UserProfileScreen** (`screens/UserProfileScreen.js`): Used for viewing **other users' profiles** (friends/public profiles)

### Routing Logic:
```javascript
// App.js line 2285-2289
{!isCheckingAuth && route === 'account' &&
  <>
    <StyleVaultScreen />  // ← Uses StyleVaultScreen, NOT AccountScreen
    <BottomBar route={route} go={setRoute} />
  </>
}

// App.js line 2242-2248
{!isCheckingAuth && route === 'userprofile' && routeParams?.userId && (
  <UserProfileScreen  // ← Used for viewing OTHER users' profiles
    userId={routeParams.userId}
    onBack={goBack}
    onPodGuest={(id) => handleSetRoute('podguest', { id: String(id) })}
  />
)}
```

### Purpose of Each Screen:
1. **StyleVaultScreen**: User's own profile/settings screen (accessed via 'account' route)
   - Face/body photo upload
   - Color profile analysis
   - Fit profile (measurements)
   - Saved fits
   - Friends management
   - Pods management
   - Admin panel (for admin@stylit.ai)

2. **UserProfileScreen**: Viewing other users' public profiles
   - Friend's profile
   - Public profile viewing
   - Friend requests
   - Viewing their try-ons/pods

3. **AccountScreen**: Currently unused/redundant
   - Similar UI to StyleVaultScreen but simpler
   - Has theme color picker
   - Has AI insights section
   - Has try-on results section
   - **Not connected to any route**

### Recommendation:
- **Option 1**: Remove `AccountScreen` if it's truly redundant
- **Option 2**: Keep it for future use (maybe a simplified account view)
- **Option 3**: Merge useful features from `AccountScreen` into `StyleVaultScreen` (like theme picker)

### Current Usage:
- When user taps "Account" in bottom bar → Shows `StyleVaultScreen`
- When user views a friend's profile → Shows `UserProfileScreen`
- `AccountScreen` is never shown anywhere

