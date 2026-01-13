/**
 * BitChat In Browser - App Store Links Database
 *
 * Comprehensive database of iOS App Store and Google Play Store links
 * for all countries where these stores are available.
 *
 * Placeholder app IDs - update when apps are published:
 * - iOS: Update APP_STORE_APP_ID
 * - Android: Update PLAY_STORE_PACKAGE_ID
 */

// ============================================================================
// Configuration - Update these when apps are published
// ============================================================================

/**
 * iOS App Store app ID (numeric ID from App Store Connect)
 * Example: 284882215 for Facebook
 */
export const APP_STORE_APP_ID = 'id0000000000';

/**
 * iOS App Store app name (URL-friendly name)
 */
export const APP_STORE_APP_NAME = 'bitchat-encrypted-messenger';

/**
 * Android Play Store package ID
 * Example: com.facebook.katana for Facebook
 */
export const PLAY_STORE_PACKAGE_ID = 'com.bitchat.messenger';

// ============================================================================
// Types
// ============================================================================

export interface CountryStoreLinks {
  /** ISO 3166-1 alpha-2 country code (lowercase) */
  code: string;
  /** Country name in English */
  name: string;
  /** iOS App Store URL for this country */
  ios: string;
  /** Google Play Store URL for this country */
  android: string;
  /** Whether iOS App Store is available in this country */
  hasIOS: boolean;
  /** Whether Google Play Store is available in this country */
  hasAndroid: boolean;
}

export type Region =
  | 'americas'
  | 'europe'
  | 'asia'
  | 'africa'
  | 'oceania'
  | 'middle-east';

export interface RegionData {
  name: string;
  displayName: string;
  countries: CountryStoreLinks[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate iOS App Store URL for a country
 */
export function getIOSStoreUrl(countryCode: string): string {
  return `https://apps.apple.com/${countryCode.toLowerCase()}/app/${APP_STORE_APP_NAME}/${APP_STORE_APP_ID}`;
}

/**
 * Generate Google Play Store URL (same for all countries, uses device locale)
 */
export function getAndroidStoreUrl(countryCode?: string): string {
  const baseUrl = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`;
  // Play Store uses device locale, but we can add gl parameter for country hint
  return countryCode ? `${baseUrl}&gl=${countryCode.toUpperCase()}` : baseUrl;
}

/**
 * Create a country store links object
 */
function createCountry(
  code: string,
  name: string,
  hasIOS: boolean = true,
  hasAndroid: boolean = true
): CountryStoreLinks {
  return {
    code: code.toLowerCase(),
    name,
    ios: hasIOS ? getIOSStoreUrl(code) : '',
    android: hasAndroid ? getAndroidStoreUrl(code) : '',
    hasIOS,
    hasAndroid,
  };
}

// ============================================================================
// Americas - North, Central, South America, Caribbean
// ============================================================================

export const americasCountries: CountryStoreLinks[] = [
  // North America
  createCountry('us', 'United States'),
  createCountry('ca', 'Canada'),
  createCountry('mx', 'Mexico'),

  // Central America
  createCountry('gt', 'Guatemala'),
  createCountry('bz', 'Belize'),
  createCountry('hn', 'Honduras'),
  createCountry('sv', 'El Salvador'),
  createCountry('ni', 'Nicaragua'),
  createCountry('cr', 'Costa Rica'),
  createCountry('pa', 'Panama'),

  // Caribbean
  createCountry('ai', 'Anguilla'),
  createCountry('ag', 'Antigua and Barbuda'),
  createCountry('aw', 'Aruba'),
  createCountry('bs', 'Bahamas'),
  createCountry('bb', 'Barbados'),
  createCountry('bm', 'Bermuda'),
  createCountry('vg', 'British Virgin Islands'),
  createCountry('ky', 'Cayman Islands'),
  createCountry('dm', 'Dominica'),
  createCountry('do', 'Dominican Republic'),
  createCountry('gd', 'Grenada'),
  createCountry('gp', 'Guadeloupe', true, false),
  createCountry('ht', 'Haiti'),
  createCountry('jm', 'Jamaica'),
  createCountry('mq', 'Martinique', true, false),
  createCountry('ms', 'Montserrat'),
  createCountry('cw', 'Curacao'),
  createCountry('pr', 'Puerto Rico'),
  createCountry('kn', 'Saint Kitts and Nevis'),
  createCountry('lc', 'Saint Lucia'),
  createCountry('vc', 'Saint Vincent and the Grenadines'),
  createCountry('sx', 'Sint Maarten'),
  createCountry('tt', 'Trinidad and Tobago'),
  createCountry('tc', 'Turks and Caicos Islands'),
  createCountry('vi', 'U.S. Virgin Islands'),
  createCountry('cu', 'Cuba', false, false), // Restricted

  // South America
  createCountry('ar', 'Argentina'),
  createCountry('bo', 'Bolivia'),
  createCountry('br', 'Brazil'),
  createCountry('cl', 'Chile'),
  createCountry('co', 'Colombia'),
  createCountry('ec', 'Ecuador'),
  createCountry('gy', 'Guyana'),
  createCountry('py', 'Paraguay'),
  createCountry('pe', 'Peru'),
  createCountry('sr', 'Suriname'),
  createCountry('uy', 'Uruguay'),
  createCountry('ve', 'Venezuela'),
  createCountry('gf', 'French Guiana', true, false),
  createCountry('fk', 'Falkland Islands', true, false),
];

// ============================================================================
// Europe - Western, Eastern, Northern, Southern Europe
// ============================================================================

export const europeCountries: CountryStoreLinks[] = [
  // Western Europe
  createCountry('gb', 'United Kingdom'),
  createCountry('ie', 'Ireland'),
  createCountry('fr', 'France'),
  createCountry('de', 'Germany'),
  createCountry('at', 'Austria'),
  createCountry('ch', 'Switzerland'),
  createCountry('be', 'Belgium'),
  createCountry('nl', 'Netherlands'),
  createCountry('lu', 'Luxembourg'),
  createCountry('mc', 'Monaco'),
  createCountry('li', 'Liechtenstein'),

  // Northern Europe
  createCountry('dk', 'Denmark'),
  createCountry('se', 'Sweden'),
  createCountry('no', 'Norway'),
  createCountry('fi', 'Finland'),
  createCountry('is', 'Iceland'),
  createCountry('ee', 'Estonia'),
  createCountry('lv', 'Latvia'),
  createCountry('lt', 'Lithuania'),
  createCountry('fo', 'Faroe Islands', true, false),
  createCountry('ax', 'Aland Islands', true, false),
  createCountry('gl', 'Greenland', true, false),

  // Southern Europe
  createCountry('es', 'Spain'),
  createCountry('pt', 'Portugal'),
  createCountry('it', 'Italy'),
  createCountry('gr', 'Greece'),
  createCountry('mt', 'Malta'),
  createCountry('cy', 'Cyprus'),
  createCountry('sm', 'San Marino'),
  createCountry('va', 'Vatican City', false, false),
  createCountry('ad', 'Andorra'),
  createCountry('gi', 'Gibraltar'),

  // Central Europe
  createCountry('pl', 'Poland'),
  createCountry('cz', 'Czech Republic'),
  createCountry('sk', 'Slovakia'),
  createCountry('hu', 'Hungary'),
  createCountry('si', 'Slovenia'),
  createCountry('hr', 'Croatia'),

  // Eastern Europe
  createCountry('ro', 'Romania'),
  createCountry('bg', 'Bulgaria'),
  createCountry('ua', 'Ukraine'),
  createCountry('md', 'Moldova'),
  createCountry('by', 'Belarus'),
  createCountry('ru', 'Russia', true, false), // Play Store restricted

  // Balkans
  createCountry('rs', 'Serbia'),
  createCountry('ba', 'Bosnia and Herzegovina'),
  createCountry('me', 'Montenegro'),
  createCountry('mk', 'North Macedonia'),
  createCountry('al', 'Albania'),
  createCountry('xk', 'Kosovo'),
];

// ============================================================================
// Asia - East, Southeast, South, Central Asia
// ============================================================================

export const asiaCountries: CountryStoreLinks[] = [
  // East Asia
  createCountry('jp', 'Japan'),
  createCountry('kr', 'South Korea'),
  createCountry('cn', 'China', true, false), // Play Store not available
  createCountry('hk', 'Hong Kong'),
  createCountry('mo', 'Macau'),
  createCountry('tw', 'Taiwan'),
  createCountry('mn', 'Mongolia'),
  createCountry('kp', 'North Korea', false, false), // Restricted

  // Southeast Asia
  createCountry('sg', 'Singapore'),
  createCountry('my', 'Malaysia'),
  createCountry('th', 'Thailand'),
  createCountry('id', 'Indonesia'),
  createCountry('ph', 'Philippines'),
  createCountry('vn', 'Vietnam'),
  createCountry('la', 'Laos'),
  createCountry('kh', 'Cambodia'),
  createCountry('mm', 'Myanmar'),
  createCountry('bn', 'Brunei'),
  createCountry('tl', 'Timor-Leste'),

  // South Asia
  createCountry('in', 'India'),
  createCountry('pk', 'Pakistan'),
  createCountry('bd', 'Bangladesh'),
  createCountry('lk', 'Sri Lanka'),
  createCountry('np', 'Nepal'),
  createCountry('bt', 'Bhutan'),
  createCountry('mv', 'Maldives'),
  createCountry('af', 'Afghanistan'),

  // Central Asia
  createCountry('kz', 'Kazakhstan'),
  createCountry('uz', 'Uzbekistan'),
  createCountry('tm', 'Turkmenistan'),
  createCountry('kg', 'Kyrgyzstan'),
  createCountry('tj', 'Tajikistan'),

  // Caucasus (transcontinental)
  createCountry('ge', 'Georgia'),
  createCountry('am', 'Armenia'),
  createCountry('az', 'Azerbaijan'),
];

// ============================================================================
// Africa - North, West, East, Central, Southern Africa
// ============================================================================

export const africaCountries: CountryStoreLinks[] = [
  // North Africa
  createCountry('eg', 'Egypt'),
  createCountry('ma', 'Morocco'),
  createCountry('tn', 'Tunisia'),
  createCountry('dz', 'Algeria'),
  createCountry('ly', 'Libya'),
  createCountry('sd', 'Sudan'),

  // West Africa
  createCountry('ng', 'Nigeria'),
  createCountry('gh', 'Ghana'),
  createCountry('sn', 'Senegal'),
  createCountry('ci', 'Ivory Coast'),
  createCountry('cm', 'Cameroon'),
  createCountry('ml', 'Mali'),
  createCountry('bf', 'Burkina Faso'),
  createCountry('ne', 'Niger'),
  createCountry('gn', 'Guinea'),
  createCountry('bj', 'Benin'),
  createCountry('tg', 'Togo'),
  createCountry('sl', 'Sierra Leone'),
  createCountry('lr', 'Liberia'),
  createCountry('mr', 'Mauritania'),
  createCountry('gw', 'Guinea-Bissau'),
  createCountry('gm', 'Gambia'),
  createCountry('cv', 'Cape Verde'),

  // East Africa
  createCountry('ke', 'Kenya'),
  createCountry('tz', 'Tanzania'),
  createCountry('ug', 'Uganda'),
  createCountry('et', 'Ethiopia'),
  createCountry('rw', 'Rwanda'),
  createCountry('bi', 'Burundi'),
  createCountry('so', 'Somalia'),
  createCountry('dj', 'Djibouti'),
  createCountry('er', 'Eritrea'),
  createCountry('ss', 'South Sudan'),
  createCountry('mw', 'Malawi'),
  createCountry('zm', 'Zambia'),
  createCountry('zw', 'Zimbabwe'),
  createCountry('mz', 'Mozambique'),
  createCountry('mg', 'Madagascar'),
  createCountry('mu', 'Mauritius'),
  createCountry('sc', 'Seychelles'),
  createCountry('km', 'Comoros'),
  createCountry('yt', 'Mayotte', true, false),
  createCountry('re', 'Reunion', true, false),

  // Central Africa
  createCountry('cd', 'Democratic Republic of the Congo'),
  createCountry('cg', 'Republic of the Congo'),
  createCountry('cf', 'Central African Republic'),
  createCountry('td', 'Chad'),
  createCountry('ga', 'Gabon'),
  createCountry('gq', 'Equatorial Guinea'),
  createCountry('ao', 'Angola'),
  createCountry('st', 'Sao Tome and Principe'),

  // Southern Africa
  createCountry('za', 'South Africa'),
  createCountry('na', 'Namibia'),
  createCountry('bw', 'Botswana'),
  createCountry('ls', 'Lesotho'),
  createCountry('sz', 'Eswatini'),
];

// ============================================================================
// Oceania - Australia, New Zealand, Pacific Islands
// ============================================================================

export const oceaniaCountries: CountryStoreLinks[] = [
  // Australia and New Zealand
  createCountry('au', 'Australia'),
  createCountry('nz', 'New Zealand'),

  // Melanesia
  createCountry('pg', 'Papua New Guinea'),
  createCountry('fj', 'Fiji'),
  createCountry('sb', 'Solomon Islands'),
  createCountry('vu', 'Vanuatu'),
  createCountry('nc', 'New Caledonia', true, false),

  // Micronesia
  createCountry('gu', 'Guam'),
  createCountry('pw', 'Palau'),
  createCountry('fm', 'Federated States of Micronesia'),
  createCountry('mh', 'Marshall Islands'),
  createCountry('nr', 'Nauru'),
  createCountry('ki', 'Kiribati'),
  createCountry('mp', 'Northern Mariana Islands'),

  // Polynesia
  createCountry('ws', 'Samoa'),
  createCountry('to', 'Tonga'),
  createCountry('tv', 'Tuvalu'),
  createCountry('pf', 'French Polynesia', true, false),
  createCountry('ck', 'Cook Islands'),
  createCountry('nu', 'Niue'),
  createCountry('as', 'American Samoa'),
  createCountry('wf', 'Wallis and Futuna', true, false),
  createCountry('tk', 'Tokelau', false, false),
  createCountry('pn', 'Pitcairn Islands', false, false),
  createCountry('nf', 'Norfolk Island', true, false),
  createCountry('cc', 'Cocos Islands', true, false),
  createCountry('cx', 'Christmas Island', true, false),
  createCountry('hm', 'Heard Island', false, false),
];

// ============================================================================
// Middle East - Western Asia
// ============================================================================

export const middleEastCountries: CountryStoreLinks[] = [
  // Gulf States
  createCountry('ae', 'United Arab Emirates'),
  createCountry('sa', 'Saudi Arabia'),
  createCountry('qa', 'Qatar'),
  createCountry('kw', 'Kuwait'),
  createCountry('bh', 'Bahrain'),
  createCountry('om', 'Oman'),
  createCountry('ye', 'Yemen'),

  // Levant
  createCountry('il', 'Israel'),
  createCountry('ps', 'Palestine'),
  createCountry('jo', 'Jordan'),
  createCountry('lb', 'Lebanon'),
  createCountry('sy', 'Syria', false, false), // Restricted

  // Other
  createCountry('iq', 'Iraq'),
  createCountry('ir', 'Iran', false, false), // Restricted
  createCountry('tr', 'Turkey'),
];

// ============================================================================
// All Regions Combined
// ============================================================================

export const regionData: Record<Region, RegionData> = {
  americas: {
    name: 'americas',
    displayName: 'Americas',
    countries: americasCountries,
  },
  europe: {
    name: 'europe',
    displayName: 'Europe',
    countries: europeCountries,
  },
  asia: {
    name: 'asia',
    displayName: 'Asia',
    countries: asiaCountries,
  },
  africa: {
    name: 'africa',
    displayName: 'Africa',
    countries: africaCountries,
  },
  oceania: {
    name: 'oceania',
    displayName: 'Oceania',
    countries: oceaniaCountries,
  },
  'middle-east': {
    name: 'middle-east',
    displayName: 'Middle East',
    countries: middleEastCountries,
  },
};

/**
 * Get all countries as a flat array
 */
export function getAllCountries(): CountryStoreLinks[] {
  return [
    ...americasCountries,
    ...europeCountries,
    ...asiaCountries,
    ...africaCountries,
    ...oceaniaCountries,
    ...middleEastCountries,
  ];
}

/**
 * Get countries with iOS App Store availability
 */
export function getIOSCountries(): CountryStoreLinks[] {
  return getAllCountries().filter((c) => c.hasIOS);
}

/**
 * Get countries with Google Play Store availability
 */
export function getAndroidCountries(): CountryStoreLinks[] {
  return getAllCountries().filter((c) => c.hasAndroid);
}

/**
 * Find a country by code
 */
export function findCountryByCode(code: string): CountryStoreLinks | undefined {
  return getAllCountries().find(
    (c) => c.code.toLowerCase() === code.toLowerCase()
  );
}

/**
 * Find a country by name (case-insensitive partial match)
 */
export function findCountriesByName(query: string): CountryStoreLinks[] {
  const lowerQuery = query.toLowerCase();
  return getAllCountries().filter((c) =>
    c.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search countries by name or code
 */
export function searchCountries(query: string): CountryStoreLinks[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  return getAllCountries().filter(
    (c) =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.code.toLowerCase() === lowerQuery
  );
}

/**
 * Get region for a country code
 */
export function getRegionForCountry(code: string): Region | undefined {
  const lowerCode = code.toLowerCase();

  for (const [region, data] of Object.entries(regionData)) {
    if (data.countries.some((c) => c.code === lowerCode)) {
      return region as Region;
    }
  }

  return undefined;
}

/**
 * Get countries by region
 */
export function getCountriesByRegion(region: Region): CountryStoreLinks[] {
  return regionData[region]?.countries || [];
}

/**
 * Get all regions
 */
export function getAllRegions(): Region[] {
  return Object.keys(regionData) as Region[];
}

/**
 * Get region display names
 */
export function getRegionDisplayNames(): Record<Region, string> {
  return {
    americas: 'Americas',
    europe: 'Europe',
    asia: 'Asia',
    africa: 'Africa',
    oceania: 'Oceania',
    'middle-east': 'Middle East',
  };
}

/**
 * Get the total number of countries
 */
export function getTotalCountryCount(): number {
  return getAllCountries().length;
}

/**
 * Get statistics about store availability
 */
export function getStoreStats(): {
  totalCountries: number;
  iosCountries: number;
  androidCountries: number;
  bothStores: number;
  noStores: number;
} {
  const all = getAllCountries();
  return {
    totalCountries: all.length,
    iosCountries: all.filter((c) => c.hasIOS).length,
    androidCountries: all.filter((c) => c.hasAndroid).length,
    bothStores: all.filter((c) => c.hasIOS && c.hasAndroid).length,
    noStores: all.filter((c) => !c.hasIOS && !c.hasAndroid).length,
  };
}

// ============================================================================
// Country Code to Timezone Mapping (for reverse lookup)
// ============================================================================

/**
 * Map of primary timezone identifiers to country codes
 * Used for detecting user's country from their timezone
 */
export const timezoneToCountryCode: Record<string, string> = {
  // Americas
  'America/New_York': 'us',
  'America/Chicago': 'us',
  'America/Denver': 'us',
  'America/Los_Angeles': 'us',
  'America/Phoenix': 'us',
  'America/Anchorage': 'us',
  'America/Honolulu': 'us',
  'America/Detroit': 'us',
  'America/Indiana/Indianapolis': 'us',
  'America/Toronto': 'ca',
  'America/Vancouver': 'ca',
  'America/Edmonton': 'ca',
  'America/Winnipeg': 'ca',
  'America/Halifax': 'ca',
  'America/Montreal': 'ca',
  'America/St_Johns': 'ca',
  'America/Mexico_City': 'mx',
  'America/Cancun': 'mx',
  'America/Tijuana': 'mx',
  'America/Monterrey': 'mx',
  'America/Guatemala': 'gt',
  'America/Belize': 'bz',
  'America/Tegucigalpa': 'hn',
  'America/El_Salvador': 'sv',
  'America/Managua': 'ni',
  'America/Costa_Rica': 'cr',
  'America/Panama': 'pa',
  'America/Havana': 'cu',
  'America/Nassau': 'bs',
  'America/Jamaica': 'jm',
  'America/Port-au-Prince': 'ht',
  'America/Santo_Domingo': 'do',
  'America/Port_of_Spain': 'tt',
  'America/Puerto_Rico': 'pr',
  'America/Bogota': 'co',
  'America/Lima': 'pe',
  'America/Guayaquil': 'ec',
  'America/Caracas': 've',
  'America/La_Paz': 'bo',
  'America/Santiago': 'cl',
  'America/Buenos_Aires': 'ar',
  'America/Argentina/Buenos_Aires': 'ar',
  'America/Sao_Paulo': 'br',
  'America/Rio_Branco': 'br',
  'America/Manaus': 'br',
  'America/Recife': 'br',
  'America/Fortaleza': 'br',
  'America/Montevideo': 'uy',
  'America/Asuncion': 'py',
  'America/Paramaribo': 'sr',
  'America/Guyana': 'gy',
  'America/Cayenne': 'gf',

  // Europe
  'Europe/London': 'gb',
  'Europe/Dublin': 'ie',
  'Europe/Paris': 'fr',
  'Europe/Berlin': 'de',
  'Europe/Vienna': 'at',
  'Europe/Zurich': 'ch',
  'Europe/Brussels': 'be',
  'Europe/Amsterdam': 'nl',
  'Europe/Luxembourg': 'lu',
  'Europe/Monaco': 'mc',
  'Europe/Copenhagen': 'dk',
  'Europe/Stockholm': 'se',
  'Europe/Oslo': 'no',
  'Europe/Helsinki': 'fi',
  'Atlantic/Reykjavik': 'is',
  'Europe/Tallinn': 'ee',
  'Europe/Riga': 'lv',
  'Europe/Vilnius': 'lt',
  'Europe/Madrid': 'es',
  'Europe/Lisbon': 'pt',
  'Atlantic/Azores': 'pt',
  'Atlantic/Madeira': 'pt',
  'Europe/Rome': 'it',
  'Europe/Athens': 'gr',
  'Europe/Malta': 'mt',
  'Europe/Nicosia': 'cy',
  'Europe/Andorra': 'ad',
  'Europe/Gibraltar': 'gi',
  'Europe/Warsaw': 'pl',
  'Europe/Prague': 'cz',
  'Europe/Bratislava': 'sk',
  'Europe/Budapest': 'hu',
  'Europe/Ljubljana': 'si',
  'Europe/Zagreb': 'hr',
  'Europe/Bucharest': 'ro',
  'Europe/Sofia': 'bg',
  'Europe/Kiev': 'ua',
  'Europe/Kyiv': 'ua',
  'Europe/Chisinau': 'md',
  'Europe/Minsk': 'by',
  'Europe/Moscow': 'ru',
  'Europe/Kaliningrad': 'ru',
  'Europe/Samara': 'ru',
  'Asia/Yekaterinburg': 'ru',
  'Europe/Belgrade': 'rs',
  'Europe/Sarajevo': 'ba',
  'Europe/Podgorica': 'me',
  'Europe/Skopje': 'mk',
  'Europe/Tirane': 'al',
  'Atlantic/Faroe': 'fo',
  'America/Godthab': 'gl',
  'America/Nuuk': 'gl',
  'Europe/Vaduz': 'li',
  'Europe/San_Marino': 'sm',

  // Asia
  'Asia/Tokyo': 'jp',
  'Asia/Seoul': 'kr',
  'Asia/Shanghai': 'cn',
  'Asia/Hong_Kong': 'hk',
  'Asia/Macau': 'mo',
  'Asia/Taipei': 'tw',
  'Asia/Ulaanbaatar': 'mn',
  'Asia/Singapore': 'sg',
  'Asia/Kuala_Lumpur': 'my',
  'Asia/Bangkok': 'th',
  'Asia/Jakarta': 'id',
  'Asia/Makassar': 'id',
  'Asia/Jayapura': 'id',
  'Asia/Manila': 'ph',
  'Asia/Ho_Chi_Minh': 'vn',
  'Asia/Saigon': 'vn',
  'Asia/Vientiane': 'la',
  'Asia/Phnom_Penh': 'kh',
  'Asia/Yangon': 'mm',
  'Asia/Rangoon': 'mm',
  'Asia/Brunei': 'bn',
  'Asia/Dili': 'tl',
  'Asia/Kolkata': 'in',
  'Asia/Calcutta': 'in',
  'Asia/Mumbai': 'in',
  'Asia/Karachi': 'pk',
  'Asia/Dhaka': 'bd',
  'Asia/Colombo': 'lk',
  'Asia/Kathmandu': 'np',
  'Asia/Thimphu': 'bt',
  'Indian/Maldives': 'mv',
  'Asia/Kabul': 'af',
  'Asia/Almaty': 'kz',
  'Asia/Tashkent': 'uz',
  'Asia/Ashgabat': 'tm',
  'Asia/Bishkek': 'kg',
  'Asia/Dushanbe': 'tj',
  'Asia/Tbilisi': 'ge',
  'Asia/Yerevan': 'am',
  'Asia/Baku': 'az',

  // Africa
  'Africa/Cairo': 'eg',
  'Africa/Casablanca': 'ma',
  'Africa/Tunis': 'tn',
  'Africa/Algiers': 'dz',
  'Africa/Tripoli': 'ly',
  'Africa/Khartoum': 'sd',
  'Africa/Lagos': 'ng',
  'Africa/Accra': 'gh',
  'Africa/Dakar': 'sn',
  'Africa/Abidjan': 'ci',
  'Africa/Douala': 'cm',
  'Africa/Bamako': 'ml',
  'Africa/Ouagadougou': 'bf',
  'Africa/Niamey': 'ne',
  'Africa/Conakry': 'gn',
  'Africa/Porto-Novo': 'bj',
  'Africa/Lome': 'tg',
  'Africa/Freetown': 'sl',
  'Africa/Monrovia': 'lr',
  'Africa/Nouakchott': 'mr',
  'Africa/Bissau': 'gw',
  'Africa/Banjul': 'gm',
  'Atlantic/Cape_Verde': 'cv',
  'Africa/Nairobi': 'ke',
  'Africa/Dar_es_Salaam': 'tz',
  'Africa/Kampala': 'ug',
  'Africa/Addis_Ababa': 'et',
  'Africa/Kigali': 'rw',
  'Africa/Bujumbura': 'bi',
  'Africa/Mogadishu': 'so',
  'Africa/Djibouti': 'dj',
  'Africa/Asmara': 'er',
  'Africa/Juba': 'ss',
  'Africa/Blantyre': 'mw',
  'Africa/Lusaka': 'zm',
  'Africa/Harare': 'zw',
  'Africa/Maputo': 'mz',
  'Indian/Antananarivo': 'mg',
  'Indian/Mauritius': 'mu',
  'Indian/Mahe': 'sc',
  'Indian/Comoro': 'km',
  'Indian/Mayotte': 'yt',
  'Indian/Reunion': 're',
  'Africa/Kinshasa': 'cd',
  'Africa/Lubumbashi': 'cd',
  'Africa/Brazzaville': 'cg',
  'Africa/Bangui': 'cf',
  'Africa/Ndjamena': 'td',
  'Africa/Libreville': 'ga',
  'Africa/Malabo': 'gq',
  'Africa/Luanda': 'ao',
  'Africa/Sao_Tome': 'st',
  'Africa/Johannesburg': 'za',
  'Africa/Windhoek': 'na',
  'Africa/Gaborone': 'bw',
  'Africa/Maseru': 'ls',
  'Africa/Mbabane': 'sz',

  // Oceania
  'Australia/Sydney': 'au',
  'Australia/Melbourne': 'au',
  'Australia/Brisbane': 'au',
  'Australia/Perth': 'au',
  'Australia/Adelaide': 'au',
  'Australia/Hobart': 'au',
  'Australia/Darwin': 'au',
  'Australia/Canberra': 'au',
  'Pacific/Auckland': 'nz',
  'Pacific/Chatham': 'nz',
  'Pacific/Port_Moresby': 'pg',
  'Pacific/Fiji': 'fj',
  'Pacific/Guadalcanal': 'sb',
  'Pacific/Efate': 'vu',
  'Pacific/Noumea': 'nc',
  'Pacific/Guam': 'gu',
  'Pacific/Palau': 'pw',
  'Pacific/Chuuk': 'fm',
  'Pacific/Pohnpei': 'fm',
  'Pacific/Majuro': 'mh',
  'Pacific/Nauru': 'nr',
  'Pacific/Tarawa': 'ki',
  'Pacific/Saipan': 'mp',
  'Pacific/Apia': 'ws',
  'Pacific/Tongatapu': 'to',
  'Pacific/Funafuti': 'tv',
  'Pacific/Tahiti': 'pf',
  'Pacific/Rarotonga': 'ck',
  'Pacific/Niue': 'nu',
  'Pacific/Pago_Pago': 'as',
  'Pacific/Wallis': 'wf',
  'Pacific/Norfolk': 'nf',
  'Indian/Cocos': 'cc',
  'Indian/Christmas': 'cx',

  // Middle East
  'Asia/Dubai': 'ae',
  'Asia/Riyadh': 'sa',
  'Asia/Qatar': 'qa',
  'Asia/Kuwait': 'kw',
  'Asia/Bahrain': 'bh',
  'Asia/Muscat': 'om',
  'Asia/Aden': 'ye',
  'Asia/Jerusalem': 'il',
  'Asia/Tel_Aviv': 'il',
  'Asia/Gaza': 'ps',
  'Asia/Hebron': 'ps',
  'Asia/Amman': 'jo',
  'Asia/Beirut': 'lb',
  'Asia/Damascus': 'sy',
  'Asia/Baghdad': 'iq',
  'Asia/Tehran': 'ir',
  'Europe/Istanbul': 'tr',
  'Asia/Istanbul': 'tr',
};

/**
 * Get country code from timezone identifier
 */
export function getCountryFromTimezone(timezone: string): string | undefined {
  return timezoneToCountryCode[timezone];
}

// ============================================================================
// Language Code to Country Code Mapping (fallback)
// ============================================================================

/**
 * Map of language codes to most likely country codes
 * Used as fallback when timezone detection fails
 */
export const languageToCountryCode: Record<string, string> = {
  'en-US': 'us',
  'en-GB': 'gb',
  'en-AU': 'au',
  'en-CA': 'ca',
  'en-NZ': 'nz',
  'en-IE': 'ie',
  'en-ZA': 'za',
  'en-IN': 'in',
  'en-SG': 'sg',
  en: 'us', // Default English to US
  'es-ES': 'es',
  'es-MX': 'mx',
  'es-AR': 'ar',
  'es-CO': 'co',
  'es-CL': 'cl',
  'es-PE': 'pe',
  'es-VE': 've',
  es: 'es', // Default Spanish to Spain
  'fr-FR': 'fr',
  'fr-CA': 'ca',
  'fr-BE': 'be',
  'fr-CH': 'ch',
  fr: 'fr', // Default French to France
  'de-DE': 'de',
  'de-AT': 'at',
  'de-CH': 'ch',
  de: 'de', // Default German to Germany
  'it-IT': 'it',
  'it-CH': 'ch',
  it: 'it', // Default Italian to Italy
  'pt-BR': 'br',
  'pt-PT': 'pt',
  pt: 'br', // Default Portuguese to Brazil
  'ru-RU': 'ru',
  ru: 'ru',
  'ja-JP': 'jp',
  ja: 'jp',
  'ko-KR': 'kr',
  ko: 'kr',
  'zh-CN': 'cn',
  'zh-TW': 'tw',
  'zh-HK': 'hk',
  zh: 'cn', // Default Chinese to mainland China
  'ar-SA': 'sa',
  'ar-EG': 'eg',
  'ar-AE': 'ae',
  ar: 'sa', // Default Arabic to Saudi Arabia
  'nl-NL': 'nl',
  'nl-BE': 'be',
  nl: 'nl',
  'pl-PL': 'pl',
  pl: 'pl',
  'tr-TR': 'tr',
  tr: 'tr',
  'th-TH': 'th',
  th: 'th',
  'vi-VN': 'vn',
  vi: 'vn',
  'id-ID': 'id',
  id: 'id',
  'ms-MY': 'my',
  ms: 'my',
  'hi-IN': 'in',
  hi: 'in',
  'bn-BD': 'bd',
  'bn-IN': 'in',
  bn: 'bd',
  'sv-SE': 'se',
  sv: 'se',
  'da-DK': 'dk',
  da: 'dk',
  'fi-FI': 'fi',
  fi: 'fi',
  'no-NO': 'no',
  nb: 'no',
  nn: 'no',
  'cs-CZ': 'cz',
  cs: 'cz',
  'el-GR': 'gr',
  el: 'gr',
  'he-IL': 'il',
  he: 'il',
  'ro-RO': 'ro',
  ro: 'ro',
  'hu-HU': 'hu',
  hu: 'hu',
  'uk-UA': 'ua',
  uk: 'ua',
};

/**
 * Get country code from language/locale string
 */
export function getCountryFromLanguage(language: string): string | undefined {
  // Try exact match first
  if (languageToCountryCode[language]) {
    return languageToCountryCode[language];
  }

  // Try base language
  const baseLang = language.split('-')[0];
  if (baseLang) {
    return languageToCountryCode[baseLang];
  }
  return undefined;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Constants
  APP_STORE_APP_ID,
  APP_STORE_APP_NAME,
  PLAY_STORE_PACKAGE_ID,

  // Data
  regionData,
  americasCountries,
  europeCountries,
  asiaCountries,
  africaCountries,
  oceaniaCountries,
  middleEastCountries,

  // Lookup functions
  getAllCountries,
  getIOSCountries,
  getAndroidCountries,
  findCountryByCode,
  findCountriesByName,
  searchCountries,
  getRegionForCountry,
  getCountriesByRegion,
  getAllRegions,
  getRegionDisplayNames,
  getTotalCountryCount,
  getStoreStats,

  // URL generators
  getIOSStoreUrl,
  getAndroidStoreUrl,

  // Detection helpers
  timezoneToCountryCode,
  languageToCountryCode,
  getCountryFromTimezone,
  getCountryFromLanguage,
};
