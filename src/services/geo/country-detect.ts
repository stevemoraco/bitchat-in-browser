/**
 * BitChat In Browser - Country Detection Service
 *
 * Detects user's country using local methods only (no external API calls)
 * for privacy. Uses timezone and browser language as signals.
 */

import {
  getCountryFromTimezone,
  getCountryFromLanguage,
  findCountryByCode,
  type CountryStoreLinks,
} from '../../data/app-store-links';

// ============================================================================
// Types
// ============================================================================

export interface DetectionResult {
  /** Detected country code (ISO 3166-1 alpha-2, lowercase) */
  countryCode: string;
  /** Country data if found */
  country: CountryStoreLinks | undefined;
  /** Detection method used */
  method: 'timezone' | 'language' | 'fallback';
  /** Confidence level (0-1) */
  confidence: number;
  /** Raw timezone string if available */
  timezone?: string;
  /** Raw language string if available */
  language?: string;
}

export interface PlatformInfo {
  /** Operating system */
  os: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  /** Is mobile device */
  isMobile: boolean;
  /** Is tablet */
  isTablet: boolean;
  /** Is desktop */
  isDesktop: boolean;
  /** Browser name */
  browser: string;
  /** User agent string */
  userAgent: string;
  /** Is PWA/standalone mode */
  isPWA: boolean;
  /** Screen width */
  screenWidth: number;
  /** Screen height */
  screenHeight: number;
}

// ============================================================================
// Timezone Detection
// ============================================================================

/**
 * Get the user's timezone using Intl API
 */
export function getUserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * Get country code from user's timezone
 */
export function detectCountryFromTimezone(): {
  code: string | undefined;
  timezone: string | undefined;
} {
  const timezone = getUserTimezone();
  if (!timezone) {
    return { code: undefined, timezone: undefined };
  }

  const code = getCountryFromTimezone(timezone);
  return { code, timezone };
}

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Get the user's preferred language
 */
export function getUserLanguage(): string | undefined {
  try {
    // navigator.language is most specific
    if (navigator.language) {
      return navigator.language;
    }
    // Fall back to first language in languages array
    if (navigator.languages && navigator.languages.length > 0) {
      return navigator.languages[0];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get all user languages (for better detection)
 */
export function getUserLanguages(): string[] {
  try {
    const languages: string[] = [];
    if (navigator.languages && navigator.languages.length > 0) {
      languages.push(...navigator.languages);
    } else if (navigator.language) {
      languages.push(navigator.language);
    }
    return languages;
  } catch {
    return [];
  }
}

/**
 * Get country code from user's language preference
 */
export function detectCountryFromLanguage(): {
  code: string | undefined;
  language: string | undefined;
} {
  const languages = getUserLanguages();

  for (const lang of languages) {
    const code = getCountryFromLanguage(lang);
    if (code) {
      return { code, language: lang };
    }
  }

  return { code: undefined, language: languages[0] };
}

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect the user's operating system
 */
export function detectOS():
  | 'ios'
  | 'android'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // iOS detection (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  // iOS 13+ iPad detection (reports as MacIntel)
  if (
    platform === 'macintel' &&
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2
  ) {
    return 'ios';
  }

  // Android detection
  if (/android/.test(ua)) {
    return 'android';
  }

  // Desktop detection
  if (/win/.test(platform) || /windows/.test(ua)) {
    return 'windows';
  }
  if (/mac/.test(platform)) {
    return 'macos';
  }
  if (/linux/.test(platform) || /linux/.test(ua)) {
    return 'linux';
  }

  return 'unknown';
}

/**
 * Detect if device is mobile
 */
export function isMobileDevice(): boolean {
  const os = detectOS();
  if (os === 'ios' || os === 'android') {
    return true;
  }

  // Check for mobile user agent patterns
  const ua = navigator.userAgent.toLowerCase();
  const mobilePatterns =
    /mobile|phone|android|iphone|ipod|blackberry|opera mini|opera mobi|iemobile|wpdesktop/;
  return mobilePatterns.test(ua);
}

/**
 * Detect if device is a tablet
 */
export function isTabletDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // iPad detection
  if (/ipad/.test(ua)) {
    return true;
  }
  // iOS 13+ iPad
  if (
    platform === 'macintel' &&
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2
  ) {
    return true;
  }
  // Android tablet (has android but not mobile)
  if (/android/.test(ua) && !/mobile/.test(ua)) {
    return true;
  }
  // Tablet patterns
  if (/tablet|kindle|playbook/.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Detect browser name
 */
export function detectBrowser(): string {
  const ua = navigator.userAgent;

  // Order matters - check more specific browsers first
  if (ua.includes('Firefox/')) {
    return 'Firefox';
  }
  if (ua.includes('Opera') || ua.includes('OPR/')) {
    return 'Opera';
  }
  if (ua.includes('Edg/')) {
    return 'Edge';
  }
  if (ua.includes('Chrome/')) {
    // Could be Chrome or Chrome-based
    if (ua.includes('Safari/')) {
      return 'Chrome';
    }
    return 'Chromium';
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    return 'Safari';
  }
  if (ua.includes('MSIE') || ua.includes('Trident/')) {
    return 'Internet Explorer';
  }

  return 'Unknown';
}

/**
 * Detect if running as PWA (standalone mode)
 */
export function isPWAMode(): boolean {
  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // iOS Safari specific
  if ((navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }
  // Check if running from home screen
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  return false;
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const os = detectOS();
  const isMobile = isMobileDevice();
  const isTablet = isTabletDevice();

  return {
    os,
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    browser: detectBrowser(),
    userAgent: navigator.userAgent,
    isPWA: isPWAMode(),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

// ============================================================================
// Combined Detection
// ============================================================================

/**
 * Default country if no detection succeeds
 */
const DEFAULT_COUNTRY = 'us';

/**
 * Detect user's country using all available methods
 *
 * Priority:
 * 1. Timezone (highest confidence)
 * 2. Language locale (medium confidence)
 * 3. Default fallback (lowest confidence)
 */
export function detectCountry(): DetectionResult {
  // Try timezone first (most reliable)
  const timezoneResult = detectCountryFromTimezone();
  if (timezoneResult.code) {
    const country = findCountryByCode(timezoneResult.code);
    return {
      countryCode: timezoneResult.code,
      country,
      method: 'timezone',
      confidence: 0.9,
      timezone: timezoneResult.timezone,
    };
  }

  // Fall back to language
  const languageResult = detectCountryFromLanguage();
  if (languageResult.code) {
    const country = findCountryByCode(languageResult.code);
    return {
      countryCode: languageResult.code,
      country,
      method: 'language',
      confidence: 0.6,
      language: languageResult.language,
      timezone: timezoneResult.timezone,
    };
  }

  // Default fallback
  const country = findCountryByCode(DEFAULT_COUNTRY);
  return {
    countryCode: DEFAULT_COUNTRY,
    country,
    method: 'fallback',
    confidence: 0.1,
    timezone: timezoneResult.timezone,
    language: languageResult.language,
  };
}

/**
 * Detect user's country with all metadata
 */
export function detectCountryWithMetadata(): DetectionResult & {
  platform: PlatformInfo;
  allLanguages: string[];
} {
  const detection = detectCountry();
  return {
    ...detection,
    platform: getPlatformInfo(),
    allLanguages: getUserLanguages(),
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the detected country code
 */
export function getDetectedCountryCode(): string {
  return detectCountry().countryCode;
}

/**
 * Get the detected country data
 */
export function getDetectedCountry(): CountryStoreLinks | undefined {
  return detectCountry().country;
}

/**
 * Check if user is likely in a specific country
 */
export function isLikelyInCountry(countryCode: string): boolean {
  const detected = detectCountry();
  return detected.countryCode.toLowerCase() === countryCode.toLowerCase();
}

/**
 * Get appropriate store link for user's detected country and platform
 */
export function getRecommendedStoreLink(): {
  url: string;
  platform: 'ios' | 'android' | 'both';
  country: CountryStoreLinks | undefined;
} {
  const detection = detectCountry();
  const platform = getPlatformInfo();
  const country = detection.country;

  // Determine which platform link to return
  if (platform.os === 'ios' && country?.hasIOS) {
    return {
      url: country.ios,
      platform: 'ios',
      country,
    };
  }

  if (platform.os === 'android' && country?.hasAndroid) {
    return {
      url: country.android,
      platform: 'android',
      country,
    };
  }

  // Default to showing both or the available one
  if (country?.hasIOS && country?.hasAndroid) {
    return {
      url: country.ios, // Default to iOS
      platform: 'both',
      country,
    };
  }

  if (country?.hasIOS) {
    return {
      url: country.ios,
      platform: 'ios',
      country,
    };
  }

  if (country?.hasAndroid) {
    return {
      url: country.android,
      platform: 'android',
      country,
    };
  }

  // No store available - return empty
  return {
    url: '',
    platform: 'both',
    country,
  };
}

/**
 * Should we show the "Get Native App" prompt?
 *
 * Returns true if:
 * - User is on mobile
 * - User is not already in PWA mode
 * - Native app is available for their platform and country
 */
export function shouldShowNativeAppPrompt(): boolean {
  const platform = getPlatformInfo();
  const detection = detectCountry();
  const country = detection.country;

  // Already in PWA mode
  if (platform.isPWA) {
    return false;
  }

  // Not on mobile
  if (!platform.isMobile && !platform.isTablet) {
    return false;
  }

  // Check if native app available
  if (platform.os === 'ios' && country?.hasIOS) {
    return true;
  }
  if (platform.os === 'android' && country?.hasAndroid) {
    return true;
  }

  return false;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Detection
  detectCountry,
  detectCountryWithMetadata,
  getDetectedCountryCode,
  getDetectedCountry,
  isLikelyInCountry,

  // Platform
  getPlatformInfo,
  detectOS,
  isMobileDevice,
  isTabletDevice,
  detectBrowser,
  isPWAMode,

  // Timezone/Language
  getUserTimezone,
  getUserLanguage,
  getUserLanguages,
  detectCountryFromTimezone,
  detectCountryFromLanguage,

  // Store links
  getRecommendedStoreLink,
  shouldShowNativeAppPrompt,
};
