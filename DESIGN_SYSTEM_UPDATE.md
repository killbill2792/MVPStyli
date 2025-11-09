# Design System Update Status

## ✅ Completed
- Created unified design system (`lib/designSystem.js`)
- Updated Shop screen to use design system
- Committed and pushed to GitHub main branch

## 🔄 In Progress
- Updating Product screen
- Updating other main screens

## 📋 Remaining Screens to Update

### High Priority (User-facing)
1. **Product Screen** (`App.js` - Product function)
   - Buttons, text styles, colors
   - Price display, tracking UI

2. **TryOn Screen** (`App.js` - TryOn function)
   - Buttons, overlays, text styles

3. **Explore/Feed Screen** (`App.js` - Explore function)
   - Card styles, text styles

4. **Account Screen** (`screens/AccountScreen.js`)
   - Profile UI, settings, buttons

### Medium Priority
5. **PodsHome** (`screens/PodsHome.tsx`)
   - Header, tabs, pod cards

6. **PodRecap** (`screens/PodRecap.tsx`)
   - Results display, buttons, cards

7. **PodLive** (`screens/PodLive.tsx`)
   - Voting UI, comments, buttons

8. **StyleCraftScreen** (`screens/StyleCraftScreen.js`)
   - Upload UI, buttons, inputs

9. **PodsScreen** (`screens/PodsScreen.js`)
   - Create pod UI, buttons

10. **Inbox** (`screens/Inbox.tsx`)
    - Message list, buttons

### Low Priority
11. **AIAnalytics** (`App.js`)
12. **SuggestedOutfits** (`App.js`)
13. **AskHelp** (`App.js`)
14. **RoomsInbox** (`App.js`)
15. **RoomOwner** (`App.js`)
16. **RoomGuest** (`App.js`)
17. **Recap** (`App.js`)

## Design System Usage Guide

### Import
```javascript
import { Colors, Typography, Spacing, BorderRadius, ButtonStyles, InputStyles, TextStyles, createButtonStyle, getButtonTextStyle } from './lib/designSystem';
```

### Colors
- `Colors.background` - Main background (#000)
- `Colors.primary` - Brand green (#10b981)
- `Colors.textPrimary` - Main text (#e4e4e7)
- `Colors.textSecondary` - Secondary text (#a1a1aa)

### Typography
- `Typography.base` - 16px (default)
- `Typography.sm` - 14px
- `Typography.lg` - 18px
- `Typography.bold` - '700'

### Spacing
- `Spacing.xs` - 4px
- `Spacing.sm` - 8px
- `Spacing.md` - 12px
- `Spacing.lg` - 16px

### Buttons
```javascript
// Primary button
<Pressable style={createButtonStyle('primary')}>
  <Text style={getButtonTextStyle('primary')}>Button</Text>
</Pressable>

// Secondary button
<Pressable style={createButtonStyle('secondary')}>
  <Text style={getButtonTextStyle('secondary')}>Button</Text>
</Pressable>
```

### Text Styles
```javascript
<Text style={TextStyles.h1}>Heading</Text>
<Text style={TextStyles.body}>Body text</Text>
<Text style={TextStyles.caption}>Caption</Text>
```

## Common Patterns to Replace

### Old Pattern
```javascript
backgroundColor: '#000'
color: '#e4e4e7'
fontSize: 16
fontWeight: '600'
padding: 16
borderRadius: 12
```

### New Pattern
```javascript
backgroundColor: Colors.background
color: Colors.textPrimary
fontSize: Typography.base
fontWeight: Typography.semibold
padding: Spacing.lg
borderRadius: BorderRadius.md
```

