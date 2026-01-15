# Installing CocoaPods - Step by Step

## Problem
Your system Ruby (2.6.10) is too old. CocoaPods requires Ruby 3.0+.

## Solution: Use Homebrew Ruby

Homebrew is currently installing Ruby 4.0. Once it finishes, follow these steps:

### Step 1: Wait for Ruby Installation to Complete

Check if Ruby is ready:
```bash
brew list ruby
```

If it shows Ruby files, proceed to Step 2.

### Step 2: Use Homebrew Ruby to Install CocoaPods

```bash
# Add Homebrew Ruby to your PATH (for this session)
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"

# OR if using Intel Mac:
export PATH="/usr/local/opt/ruby/bin:$PATH"

# Verify you're using the new Ruby
ruby --version  # Should show 4.0.x

# Install CocoaPods using the new Ruby
gem install cocoapods

# Verify CocoaPods is installed
pod --version
```

### Step 3: Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 4: Build the App

```bash
npx expo run:ios
```

## Alternative: Make Homebrew Ruby Permanent

Add to your `~/.zshrc` or `~/.bash_profile`:
```bash
# For Apple Silicon Mac
export PATH="/opt/homebrew/opt/ruby/bin:$PATH"

# OR for Intel Mac
export PATH="/usr/local/opt/ruby/bin:$PATH"
```

Then reload:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

## Quick Check Script

Run this to see if everything is ready:
```bash
# Check Ruby version
ruby --version

# Check if CocoaPods is installed
pod --version

# If both work, you're ready!
```
