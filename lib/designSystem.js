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
  emerald: {
    primary: '#10b981', // Emerald
    primaryDark: '#059669',
    primaryLight: 'rgba(16, 185, 129, 0.1)',
    primaryBorder: 'rgba(16, 185, 129, 0.3)',
  },
  blue: {
    primary: '#3b82f6', // Blue
    primaryDark: '#2563eb',
    primaryLight: 'rgba(59, 130, 246, 0.1)',
    primaryBorder: 'rgba(59, 130, 246, 0.3)',
  },
  purple: {
    primary: '#8b5cf6', // Purple
    primaryDark: '#7c3aed',
    primaryLight: 'rgba(139, 92, 246, 0.1)',
    primaryBorder: 'rgba(139, 92, 246, 0.3)',
  },
  pink: {
    primary: '#ec4899', // Pink
    primaryDark: '#db2777',
    primaryLight: 'rgba(236, 72, 153, 0.1)',
    primaryBorder: 'rgba(236, 72, 153, 0.3)',
  },
  orange: {
    primary: '#f97316', // Orange
    primaryDark: '#ea580c',
    primaryLight: 'rgba(249, 115, 22, 0.1)',
    primaryBorder: 'rgba(249, 115, 22, 0.3)',
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
  rose: {
    primary: '#f43f5e', // Rose
    primaryDark: '#e11d48',
    primaryLight: 'rgba(244, 63, 94, 0.1)',
    primaryBorder: 'rgba(244, 63, 94, 0.3)',
  },
  cyan: {
    primary: '#06b6d4', // Cyan
    primaryDark: '#0891b2',
    primaryLight: 'rgba(6, 182, 212, 0.1)',
    primaryBorder: 'rgba(6, 182, 212, 0.3)',
  },
};

// Custom color storage
let customColor = null;

// Default to teal theme - stored in module
let currentTheme = 'teal';

export const setTheme = (themeName) => {
  if (ThemeColors[themeName]) {
    currentTheme = themeName;
    customColor = null; // Clear custom color when selecting preset
  }
};

export const setCustomColor = (hexColor) => {
  customColor = hexColor;
  currentTheme = 'custom';
};

export const getCurrentTheme = () => {
  if (currentTheme === 'custom' && customColor) {
    // Generate theme from custom color
    const rgb = hexToRgb(customColor);
    return {
      primary: customColor,
      primaryDark: darkenColor(customColor, 0.2),
      primaryLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
      primaryBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
    };
  }
  return ThemeColors[currentTheme] || ThemeColors.teal;
};

export const getCurrentThemeName = () => currentTheme;

export const getCustomColor = () => customColor;

// Helper functions for color manipulation
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 20, g: 184, b: 166 }; // Default teal
}

function darkenColor(hex, amount) {
  const rgb = hexToRgb(hex);
  const r = Math.max(0, Math.floor(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - amount)));
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

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

