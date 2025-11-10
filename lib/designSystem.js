// Unified Design System for MVPStyli
// This file contains all design tokens and reusable styles

// Theme colors - can be changed by user
export const ThemeColors = {
  teal: {
    primary: '#14b8a6', // Teal
    primaryDark: '#0d9488',
    primaryLight: 'rgba(20, 184, 166, 0.1)',
    primaryBorder: 'rgba(20, 184, 166, 0.3)',
  },
  neutral: {
    primary: '#6b7280', // Neutral gray
    primaryDark: '#4b5563',
    primaryLight: 'rgba(107, 114, 128, 0.1)',
    primaryBorder: 'rgba(107, 114, 128, 0.3)',
  },
  slate: {
    primary: '#64748b', // Slate
    primaryDark: '#475569',
    primaryLight: 'rgba(100, 116, 139, 0.1)',
    primaryBorder: 'rgba(100, 116, 139, 0.3)',
  },
  emerald: {
    primary: '#10b981', // Emerald
    primaryDark: '#059669',
    primaryLight: 'rgba(16, 185, 129, 0.1)',
    primaryBorder: 'rgba(16, 185, 129, 0.3)',
  }
};

// Default to teal theme - stored in module
let currentTheme = 'teal';

export const setTheme = (themeName) => {
  if (ThemeColors[themeName]) {
    currentTheme = themeName;
  }
};

export const getCurrentTheme = () => {
  return ThemeColors[currentTheme] || ThemeColors.teal;
};

export const getCurrentThemeName = () => currentTheme;

// Helper to get color values - use function to get current theme
export const getColors = () => {
  const theme = getCurrentTheme();
  return {
    primary: theme.primary,
    primaryDark: theme.primaryDark,
    primaryLight: theme.primaryLight,
    primaryBorder: theme.primaryBorder,
    // Background colors
    background: '#000000',
    backgroundSecondary: 'rgba(255,255,255,0.05)',
    backgroundTertiary: 'rgba(255,255,255,0.1)',
    backgroundOverlay: 'rgba(0,0,0,0.8)',
    // Text colors
    textPrimary: '#e4e4e7',
    textSecondary: '#a1a1aa',
    textTertiary: '#6b7280',
    textWhite: '#ffffff',
    textBlack: '#000000',
    // Status colors
    success: theme.primary, // Using primary color
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    // Border colors
    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.2)',
    borderDark: 'rgba(255,255,255,0.05)',
  };
};

// Export Colors as object with getters that call getColors
export const Colors = new Proxy({}, {
  get(target, prop) {
    return getColors()[prop];
  }
});

export const Typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  
  // Font weights
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  
  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const ButtonStyles = {
  // Primary button (green)
  primary: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: Colors.textWhite,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  
  // Secondary button (outlined)
  secondary: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  secondaryText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  
  // Ghost button (subtle)
  ghost: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
  },
  
  // Danger button (red)
  danger: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    color: Colors.textWhite,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  
  // Disabled state
  disabled: {
    opacity: 0.5,
  },
};

export const CardStyles = {
  container: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    marginBottom: Spacing.md,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    lineHeight: Typography.base * Typography.lineHeightNormal,
  },
};

export const InputStyles = {
  container: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
  },
  placeholder: {
    color: Colors.textSecondary,
  },
};

export const TextStyles = {
  h1: {
    color: Colors.textPrimary,
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    lineHeight: Typography['3xl'] * Typography.lineHeightTight,
  },
  h2: {
    color: Colors.textPrimary,
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    lineHeight: Typography['2xl'] * Typography.lineHeightTight,
  },
  h3: {
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    lineHeight: Typography.xl * Typography.lineHeightTight,
  },
  body: {
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: Typography.normal,
    lineHeight: Typography.base * Typography.lineHeightNormal,
  },
  bodySecondary: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: Typography.normal,
    lineHeight: Typography.base * Typography.lineHeightNormal,
  },
  caption: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: Typography.normal,
    lineHeight: Typography.sm * Typography.lineHeightNormal,
  },
  small: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    fontWeight: Typography.normal,
    lineHeight: Typography.xs * Typography.lineHeightNormal,
  },
};

// Helper function to create consistent button component
export const createButtonStyle = (variant = 'primary', disabled = false) => {
  const baseStyle = ButtonStyles[variant] || ButtonStyles.primary;
  return {
    ...baseStyle,
    ...(disabled && ButtonStyles.disabled),
  };
};

// Helper function to get button text style
export const getButtonTextStyle = (variant = 'primary') => {
  return ButtonStyles[`${variant}Text`] || ButtonStyles.primaryText;
};

