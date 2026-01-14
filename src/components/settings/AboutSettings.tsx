/**
 * About Settings Component
 *
 * Displays app information and links:
 * - App version and build info
 * - Links to native apps (ALL country App Store/Play Store links)
 * - Source code link
 * - License information
 *
 * @module components/settings/AboutSettings
 */

import type { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

interface AppStoreLink {
  country: string;
  code: string;
  iosUrl: string;
  androidUrl: string;
}

type StoreRegion = 'americas' | 'europe' | 'asia' | 'oceania' | 'africa' | 'middle_east';

// ============================================================================
// Constants
// ============================================================================

const APP_VERSION = '0.1.0';
const BUILD_NUMBER = '1';
const BUILD_DATE = '2025-01-12';

// BitChat App Store ID
const IOS_APP_ID = 'com.bitchat.app'; // Placeholder - replace with real ID
const ANDROID_PACKAGE = 'com.bitchat.app'; // Placeholder - replace with real ID

// Base URLs
const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details';

/**
 * All country App Store and Play Store links
 * Organized by region for easier navigation
 */
const APP_STORE_LINKS: Record<StoreRegion, AppStoreLink[]> = {
  americas: [
    { country: 'United States', code: 'us', iosUrl: `https://apps.apple.com/us/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=US` },
    { country: 'Canada', code: 'ca', iosUrl: `https://apps.apple.com/ca/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CA` },
    { country: 'Mexico', code: 'mx', iosUrl: `https://apps.apple.com/mx/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MX` },
    { country: 'Brazil', code: 'br', iosUrl: `https://apps.apple.com/br/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BR` },
    { country: 'Argentina', code: 'ar', iosUrl: `https://apps.apple.com/ar/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=AR` },
    { country: 'Chile', code: 'cl', iosUrl: `https://apps.apple.com/cl/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CL` },
    { country: 'Colombia', code: 'co', iosUrl: `https://apps.apple.com/co/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CO` },
    { country: 'Peru', code: 'pe', iosUrl: `https://apps.apple.com/pe/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PE` },
    { country: 'Venezuela', code: 've', iosUrl: `https://apps.apple.com/ve/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=VE` },
    { country: 'Ecuador', code: 'ec', iosUrl: `https://apps.apple.com/ec/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=EC` },
    { country: 'Bolivia', code: 'bo', iosUrl: `https://apps.apple.com/bo/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BO` },
    { country: 'Paraguay', code: 'py', iosUrl: `https://apps.apple.com/py/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PY` },
    { country: 'Uruguay', code: 'uy', iosUrl: `https://apps.apple.com/uy/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=UY` },
    { country: 'Costa Rica', code: 'cr', iosUrl: `https://apps.apple.com/cr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CR` },
    { country: 'Panama', code: 'pa', iosUrl: `https://apps.apple.com/pa/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PA` },
    { country: 'Guatemala', code: 'gt', iosUrl: `https://apps.apple.com/gt/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=GT` },
    { country: 'Honduras', code: 'hn', iosUrl: `https://apps.apple.com/hn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=HN` },
    { country: 'El Salvador', code: 'sv', iosUrl: `https://apps.apple.com/sv/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SV` },
    { country: 'Nicaragua', code: 'ni', iosUrl: `https://apps.apple.com/ni/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NI` },
    { country: 'Dominican Republic', code: 'do', iosUrl: `https://apps.apple.com/do/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=DO` },
    { country: 'Puerto Rico', code: 'pr', iosUrl: `https://apps.apple.com/pr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PR` },
    { country: 'Jamaica', code: 'jm', iosUrl: `https://apps.apple.com/jm/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=JM` },
    { country: 'Trinidad and Tobago', code: 'tt', iosUrl: `https://apps.apple.com/tt/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TT` },
  ],
  europe: [
    { country: 'United Kingdom', code: 'gb', iosUrl: `https://apps.apple.com/gb/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=GB` },
    { country: 'Germany', code: 'de', iosUrl: `https://apps.apple.com/de/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=DE` },
    { country: 'France', code: 'fr', iosUrl: `https://apps.apple.com/fr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=FR` },
    { country: 'Italy', code: 'it', iosUrl: `https://apps.apple.com/it/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IT` },
    { country: 'Spain', code: 'es', iosUrl: `https://apps.apple.com/es/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ES` },
    { country: 'Netherlands', code: 'nl', iosUrl: `https://apps.apple.com/nl/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NL` },
    { country: 'Belgium', code: 'be', iosUrl: `https://apps.apple.com/be/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BE` },
    { country: 'Switzerland', code: 'ch', iosUrl: `https://apps.apple.com/ch/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CH` },
    { country: 'Austria', code: 'at', iosUrl: `https://apps.apple.com/at/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=AT` },
    { country: 'Poland', code: 'pl', iosUrl: `https://apps.apple.com/pl/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PL` },
    { country: 'Portugal', code: 'pt', iosUrl: `https://apps.apple.com/pt/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PT` },
    { country: 'Sweden', code: 'se', iosUrl: `https://apps.apple.com/se/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SE` },
    { country: 'Norway', code: 'no', iosUrl: `https://apps.apple.com/no/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NO` },
    { country: 'Denmark', code: 'dk', iosUrl: `https://apps.apple.com/dk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=DK` },
    { country: 'Finland', code: 'fi', iosUrl: `https://apps.apple.com/fi/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=FI` },
    { country: 'Ireland', code: 'ie', iosUrl: `https://apps.apple.com/ie/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IE` },
    { country: 'Czech Republic', code: 'cz', iosUrl: `https://apps.apple.com/cz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CZ` },
    { country: 'Hungary', code: 'hu', iosUrl: `https://apps.apple.com/hu/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=HU` },
    { country: 'Romania', code: 'ro', iosUrl: `https://apps.apple.com/ro/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=RO` },
    { country: 'Greece', code: 'gr', iosUrl: `https://apps.apple.com/gr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=GR` },
    { country: 'Slovakia', code: 'sk', iosUrl: `https://apps.apple.com/sk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SK` },
    { country: 'Bulgaria', code: 'bg', iosUrl: `https://apps.apple.com/bg/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BG` },
    { country: 'Croatia', code: 'hr', iosUrl: `https://apps.apple.com/hr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=HR` },
    { country: 'Slovenia', code: 'si', iosUrl: `https://apps.apple.com/si/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SI` },
    { country: 'Estonia', code: 'ee', iosUrl: `https://apps.apple.com/ee/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=EE` },
    { country: 'Latvia', code: 'lv', iosUrl: `https://apps.apple.com/lv/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LV` },
    { country: 'Lithuania', code: 'lt', iosUrl: `https://apps.apple.com/lt/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LT` },
    { country: 'Luxembourg', code: 'lu', iosUrl: `https://apps.apple.com/lu/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LU` },
    { country: 'Malta', code: 'mt', iosUrl: `https://apps.apple.com/mt/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MT` },
    { country: 'Cyprus', code: 'cy', iosUrl: `https://apps.apple.com/cy/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CY` },
    { country: 'Iceland', code: 'is', iosUrl: `https://apps.apple.com/is/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IS` },
    { country: 'Ukraine', code: 'ua', iosUrl: `https://apps.apple.com/ua/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=UA` },
    { country: 'Russia', code: 'ru', iosUrl: `https://apps.apple.com/ru/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=RU` },
    { country: 'Belarus', code: 'by', iosUrl: `https://apps.apple.com/by/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BY` },
    { country: 'Serbia', code: 'rs', iosUrl: `https://apps.apple.com/rs/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=RS` },
    { country: 'Albania', code: 'al', iosUrl: `https://apps.apple.com/al/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=AL` },
    { country: 'North Macedonia', code: 'mk', iosUrl: `https://apps.apple.com/mk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MK` },
    { country: 'Bosnia and Herzegovina', code: 'ba', iosUrl: `https://apps.apple.com/ba/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BA` },
    { country: 'Montenegro', code: 'me', iosUrl: `https://apps.apple.com/me/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ME` },
    { country: 'Moldova', code: 'md', iosUrl: `https://apps.apple.com/md/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MD` },
  ],
  asia: [
    { country: 'Japan', code: 'jp', iosUrl: `https://apps.apple.com/jp/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=JP` },
    { country: 'South Korea', code: 'kr', iosUrl: `https://apps.apple.com/kr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=KR` },
    { country: 'China', code: 'cn', iosUrl: `https://apps.apple.com/cn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CN` },
    { country: 'Hong Kong', code: 'hk', iosUrl: `https://apps.apple.com/hk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=HK` },
    { country: 'Taiwan', code: 'tw', iosUrl: `https://apps.apple.com/tw/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TW` },
    { country: 'Singapore', code: 'sg', iosUrl: `https://apps.apple.com/sg/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SG` },
    { country: 'Malaysia', code: 'my', iosUrl: `https://apps.apple.com/my/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MY` },
    { country: 'Indonesia', code: 'id', iosUrl: `https://apps.apple.com/id/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ID` },
    { country: 'Thailand', code: 'th', iosUrl: `https://apps.apple.com/th/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TH` },
    { country: 'Vietnam', code: 'vn', iosUrl: `https://apps.apple.com/vn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=VN` },
    { country: 'Philippines', code: 'ph', iosUrl: `https://apps.apple.com/ph/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PH` },
    { country: 'India', code: 'in', iosUrl: `https://apps.apple.com/in/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IN` },
    { country: 'Pakistan', code: 'pk', iosUrl: `https://apps.apple.com/pk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PK` },
    { country: 'Bangladesh', code: 'bd', iosUrl: `https://apps.apple.com/bd/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BD` },
    { country: 'Sri Lanka', code: 'lk', iosUrl: `https://apps.apple.com/lk/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LK` },
    { country: 'Nepal', code: 'np', iosUrl: `https://apps.apple.com/np/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NP` },
    { country: 'Myanmar', code: 'mm', iosUrl: `https://apps.apple.com/mm/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MM` },
    { country: 'Cambodia', code: 'kh', iosUrl: `https://apps.apple.com/kh/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=KH` },
    { country: 'Laos', code: 'la', iosUrl: `https://apps.apple.com/la/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LA` },
    { country: 'Kazakhstan', code: 'kz', iosUrl: `https://apps.apple.com/kz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=KZ` },
    { country: 'Uzbekistan', code: 'uz', iosUrl: `https://apps.apple.com/uz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=UZ` },
    { country: 'Mongolia', code: 'mn', iosUrl: `https://apps.apple.com/mn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MN` },
  ],
  middle_east: [
    { country: 'Turkey', code: 'tr', iosUrl: `https://apps.apple.com/tr/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TR` },
    { country: 'Israel', code: 'il', iosUrl: `https://apps.apple.com/il/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IL` },
    { country: 'United Arab Emirates', code: 'ae', iosUrl: `https://apps.apple.com/ae/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=AE` },
    { country: 'Saudi Arabia', code: 'sa', iosUrl: `https://apps.apple.com/sa/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SA` },
    { country: 'Qatar', code: 'qa', iosUrl: `https://apps.apple.com/qa/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=QA` },
    { country: 'Kuwait', code: 'kw', iosUrl: `https://apps.apple.com/kw/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=KW` },
    { country: 'Bahrain', code: 'bh', iosUrl: `https://apps.apple.com/bh/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BH` },
    { country: 'Oman', code: 'om', iosUrl: `https://apps.apple.com/om/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=OM` },
    { country: 'Jordan', code: 'jo', iosUrl: `https://apps.apple.com/jo/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=JO` },
    { country: 'Lebanon', code: 'lb', iosUrl: `https://apps.apple.com/lb/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=LB` },
    { country: 'Egypt', code: 'eg', iosUrl: `https://apps.apple.com/eg/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=EG` },
    { country: 'Iraq', code: 'iq', iosUrl: `https://apps.apple.com/iq/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IQ` },
    { country: 'Iran', code: 'ir', iosUrl: `https://apps.apple.com/ir/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=IR` },
  ],
  africa: [
    { country: 'South Africa', code: 'za', iosUrl: `https://apps.apple.com/za/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ZA` },
    { country: 'Nigeria', code: 'ng', iosUrl: `https://apps.apple.com/ng/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NG` },
    { country: 'Kenya', code: 'ke', iosUrl: `https://apps.apple.com/ke/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=KE` },
    { country: 'Ghana', code: 'gh', iosUrl: `https://apps.apple.com/gh/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=GH` },
    { country: 'Morocco', code: 'ma', iosUrl: `https://apps.apple.com/ma/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MA` },
    { country: 'Tunisia', code: 'tn', iosUrl: `https://apps.apple.com/tn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TN` },
    { country: 'Algeria', code: 'dz', iosUrl: `https://apps.apple.com/dz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=DZ` },
    { country: 'Ethiopia', code: 'et', iosUrl: `https://apps.apple.com/et/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ET` },
    { country: 'Tanzania', code: 'tz', iosUrl: `https://apps.apple.com/tz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=TZ` },
    { country: 'Uganda', code: 'ug', iosUrl: `https://apps.apple.com/ug/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=UG` },
    { country: 'Senegal', code: 'sn', iosUrl: `https://apps.apple.com/sn/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=SN` },
    { country: 'Cameroon', code: 'cm', iosUrl: `https://apps.apple.com/cm/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CM` },
    { country: "Cote d'Ivoire", code: 'ci', iosUrl: `https://apps.apple.com/ci/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=CI` },
    { country: 'Zambia', code: 'zm', iosUrl: `https://apps.apple.com/zm/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ZM` },
    { country: 'Zimbabwe', code: 'zw', iosUrl: `https://apps.apple.com/zw/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=ZW` },
    { country: 'Botswana', code: 'bw', iosUrl: `https://apps.apple.com/bw/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=BW` },
    { country: 'Namibia', code: 'na', iosUrl: `https://apps.apple.com/na/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NA` },
    { country: 'Mauritius', code: 'mu', iosUrl: `https://apps.apple.com/mu/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=MU` },
  ],
  oceania: [
    { country: 'Australia', code: 'au', iosUrl: `https://apps.apple.com/au/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=AU` },
    { country: 'New Zealand', code: 'nz', iosUrl: `https://apps.apple.com/nz/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=NZ` },
    { country: 'Fiji', code: 'fj', iosUrl: `https://apps.apple.com/fj/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=FJ` },
    { country: 'Papua New Guinea', code: 'pg', iosUrl: `https://apps.apple.com/pg/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=PG` },
    { country: 'Guam', code: 'gu', iosUrl: `https://apps.apple.com/gu/app/bitchat/id${IOS_APP_ID}`, androidUrl: `${PLAY_STORE_BASE}?id=${ANDROID_PACKAGE}&gl=GU` },
  ],
};

const REGION_LABELS: Record<StoreRegion, string> = {
  americas: 'Americas',
  europe: 'Europe',
  asia: 'Asia',
  middle_east: 'Middle East',
  africa: 'Africa',
  oceania: 'Oceania',
};

// ============================================================================
// Component
// ============================================================================

export const AboutSettings: FunctionComponent = () => {
  const [expandedRegion, setExpandedRegion] = useState<StoreRegion | null>(null);

  const toggleRegion = (region: StoreRegion) => {
    setExpandedRegion((current) => (current === region ? null : region));
  };

  // Count total countries
  const totalCountries = Object.values(APP_STORE_LINKS).reduce(
    (sum, links) => sum + links.length,
    0
  );

  return (
    <div class="space-y-6">
      {/* Version Info */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Version Information</h4>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-terminal-green/60">Version:</span>
            <span class="ml-2 text-terminal-green">{APP_VERSION}</span>
          </div>
          <div>
            <span class="text-terminal-green/60">Build:</span>
            <span class="ml-2 text-terminal-green">{BUILD_NUMBER}</span>
          </div>
          <div>
            <span class="text-terminal-green/60">Build Date:</span>
            <span class="ml-2 text-terminal-green">{BUILD_DATE}</span>
          </div>
          <div>
            <span class="text-terminal-green/60">Platform:</span>
            <span class="ml-2 text-terminal-green">PWA</span>
          </div>
        </div>
      </div>

      {/* Native Apps */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Native Apps</h4>
        <p class="text-xs text-terminal-green/60 mb-4">
          BitChat is available as native apps for iOS and Android with additional
          features like BLE mesh networking. Select your region to find store links.
        </p>

        {/* Region Selector */}
        <div class="space-y-2">
          {(Object.keys(APP_STORE_LINKS) as StoreRegion[]).map((region) => (
            <div key={region} class="border border-terminal-green/20">
              <button
                onClick={() => toggleRegion(region)}
                class="w-full p-3 text-left flex items-center justify-between hover:bg-terminal-green/5"
              >
                <span class="text-terminal-green">
                  {REGION_LABELS[region]}{' '}
                  <span class="text-terminal-green/50">
                    ({APP_STORE_LINKS[region].length} countries)
                  </span>
                </span>
                <span
                  class={`transform transition-transform ${
                    expandedRegion === region ? 'rotate-90' : ''
                  }`}
                >
                  {'>'}
                </span>
              </button>

              {expandedRegion === region && (
                <div class="border-t border-terminal-green/20 p-3 max-h-60 overflow-y-auto">
                  <div class="grid gap-2">
                    {APP_STORE_LINKS[region].map((link) => (
                      <div
                        key={link.code}
                        class="flex items-center justify-between py-2 border-b border-terminal-green/10 last:border-0"
                      >
                        <span class="text-sm text-terminal-green">
                          {link.country}
                        </span>
                        <div class="flex gap-2">
                          <a
                            href={link.iosUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-2 py-1 text-xs border border-terminal-green/30 text-terminal-green hover:bg-terminal-green hover:text-terminal-bg"
                          >
                            iOS
                          </a>
                          <a
                            href={link.androidUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="px-2 py-1 text-xs border border-terminal-green/30 text-terminal-green hover:bg-terminal-green hover:text-terminal-bg"
                          >
                            Android
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div class="mt-4 text-xs text-terminal-green/50">
          {totalCountries} country-specific store links available
        </div>
      </div>

      {/* Links */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Links</h4>
        <div class="space-y-3">
          <a
            href="https://github.com/example/bitchat"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between p-2 border border-terminal-green/20 hover:border-terminal-green/50"
          >
            <span class="text-terminal-green">Source Code (GitHub)</span>
            <span class="text-terminal-green/50">-{'>'}</span>
          </a>
          <a
            href="https://bitbrowse.eth.limo"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between p-2 border border-terminal-green/20 hover:border-terminal-green/50"
          >
            <span class="text-terminal-green">Web App (bitbrowse.eth.limo)</span>
            <span class="text-terminal-green/50">-{'>'}</span>
          </a>
          <a
            href="https://nostr.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between p-2 border border-terminal-green/20 hover:border-terminal-green/50"
          >
            <span class="text-terminal-green">About Nostr Protocol</span>
            <span class="text-terminal-green/50">-{'>'}</span>
          </a>
        </div>
      </div>

      {/* License */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; License</h4>
        <div class="text-sm text-terminal-green/70 space-y-2">
          <p>
            BitChat In Browser is open source software released under the MIT
            License.
          </p>
          <p class="text-xs">
            Copyright (c) 2025 BitChat Contributors
          </p>
          <p class="text-xs text-terminal-green/50">
            Permission is hereby granted, free of charge, to any person obtaining a
            copy of this software and associated documentation files (the
            "Software"), to deal in the Software without restriction, including
            without limitation the rights to use, copy, modify, merge, publish,
            distribute, sublicense, and/or sell copies of the Software.
          </p>
        </div>
      </div>

      {/* Credits */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Built With</h4>
        <div class="grid grid-cols-2 gap-2 text-xs text-terminal-green/60">
          <span>Preact</span>
          <span>TypeScript</span>
          <span>Tailwind CSS</span>
          <span>Zustand</span>
          <span>nostr-tools</span>
          <span>libsodium</span>
          <span>Trystero (WebRTC)</span>
          <span>Workbox (PWA)</span>
        </div>
      </div>

      {/* Footer */}
      <div class="text-center text-xs text-terminal-green/40 pt-4">
        <p>Your keys, your messages, your privacy.</p>
        <p class="mt-1">No tracking. No analytics. No servers (except relays).</p>
      </div>
    </div>
  );
};

export default AboutSettings;
