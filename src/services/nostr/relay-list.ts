/**
 * Default Relay List for BitChat In Browser
 *
 * This list is synchronized with the native BitChat iOS and Android apps
 * to ensure interoperability across all platforms.
 *
 * Source: online_relays_gps.csv from native app repositories
 * Total: 290+ relays with geographic coordinates
 */

/**
 * Relay information including geographic coordinates for proximity-based selection
 */
export interface RelayInfo {
  /** WebSocket URL of the relay */
  url: string;
  /** Latitude coordinate for geographic proximity calculation */
  latitude: number;
  /** Longitude coordinate for geographic proximity calculation */
  longitude: number;
  /** Whether this is a primary/trusted relay */
  isPrimary?: boolean;
  /** Optional region identifier */
  region?: string;
}

/**
 * Primary relays - most reliable and well-maintained
 * These are always connected first and used for critical operations
 */
export const PRIMARY_RELAYS: readonly RelayInfo[] = [
  { url: 'wss://relay.damus.io', latitude: 43.6532, longitude: -79.3832, isPrimary: true },
  { url: 'wss://nos.lol', latitude: 50.4754, longitude: 12.3683, isPrimary: true },
  { url: 'wss://relay.primal.net', latitude: 43.6532, longitude: -79.3832, isPrimary: true },
  { url: 'wss://relay.nostr.band', latitude: 60.1699, longitude: 24.9384, isPrimary: true },
  { url: 'wss://relay.snort.social', latitude: 43.6532, longitude: -79.3832, isPrimary: true },
  { url: 'wss://offchain.pub', latitude: 47.6743, longitude: -117.112, isPrimary: true },
  { url: 'wss://relay.0xchat.com', latitude: 1.35208, longitude: 103.82, isPrimary: true },
  { url: 'wss://nostr-pub.wellorder.net', latitude: 45.5201, longitude: -122.99, isPrimary: true },
] as const;

/**
 * Full relay list with geographic coordinates
 * Imported from native BitChat apps for compatibility
 */
export const ALL_RELAYS: readonly RelayInfo[] = [
  // Primary relays first
  ...PRIMARY_RELAYS,

  // North America
  { url: 'wss://relay-admin.thaliyal.com', latitude: 40.8218, longitude: -74.45, region: 'na' },
  { url: 'wss://nostr.notribe.net', latitude: 40.8302, longitude: -74.1299, region: 'na' },
  { url: 'wss://strfry.bonsai.com', latitude: 37.8715, longitude: -122.273, region: 'na' },
  { url: 'wss://nostr-relay.online', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr.spicyz.io', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://vitor.nostr1.com', latitude: 40.7128, longitude: -74.006, region: 'na' },
  { url: 'wss://nostr-relay-1.trustlessenterprise.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr.bilthon.dev', latitude: 25.8128, longitude: -80.2377, region: 'na' },
  { url: 'wss://nostr.girino.org', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://purpura.cloud', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.holzeis.me', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.spaceshell.xyz', latitude: 40.7128, longitude: -74.006, region: 'na' },
  { url: 'wss://nostr.liberty.fans', latitude: 36.9104, longitude: -89.5875, region: 'na' },
  { url: 'wss://relay.fundstr.me', latitude: 42.3601, longitude: -71.0589, region: 'na' },
  { url: 'wss://relay.satlantis.io', latitude: 32.8769, longitude: -80.0114, region: 'na' },
  { url: 'wss://slick.mjex.me', latitude: 39.048, longitude: -77.4817, region: 'na' },
  { url: 'wss://nostr-relay.nextblockvending.com', latitude: 47.2343, longitude: -119.853, region: 'na' },
  { url: 'wss://nostr.fbxl.net', latitude: 48.382, longitude: -89.2502, region: 'na' },
  { url: 'wss://relay.nostr.place', latitude: 32.7767, longitude: -96.797, region: 'na' },
  { url: 'wss://nostream.breadslice.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.mostro.network', latitude: 40.8302, longitude: -74.1299, region: 'na' },
  { url: 'wss://no.str.cr', latitude: 9.92857, longitude: -84.0528, region: 'na' },
  { url: 'wss://relay.utxo.farm', latitude: 35.6916, longitude: 139.768, region: 'na' },
  { url: 'wss://nostr.pleb.one', latitude: 38.6327, longitude: -90.1961, region: 'na' },
  { url: 'wss://relay-dev.satlantis.io', latitude: 40.8302, longitude: -74.1299, region: 'na' },
  { url: 'wss://satsage.xyz', latitude: 37.3986, longitude: -121.964, region: 'na' },
  { url: 'wss://nostr-relay.psfoundation.info', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://cyberspace.nostr1.com', latitude: 40.7128, longitude: -74.006, region: 'na' },
  { url: 'wss://relay.endfiat.money', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.trustroots.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.wellorder.net', latitude: 45.5201, longitude: -122.99, region: 'na' },
  { url: 'wss://relay.coinos.io', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay-testnet.k8s.layer3.news', latitude: 37.3387, longitude: -121.885, region: 'na' },
  { url: 'wss://relay.nostriot.com', latitude: 41.5695, longitude: -83.9786, region: 'na' },
  { url: 'wss://nostr.casa21.space', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://premium.primal.net', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.tagayasu.xyz', latitude: 43.6715, longitude: -79.38, region: 'na' },
  { url: 'wss://nostr.zenon.network', latitude: 43.5009, longitude: -70.4428, region: 'na' },
  { url: 'wss://dizzyspells.nostr1.com', latitude: 40.7057, longitude: -74.0136, region: 'na' },
  { url: 'wss://relay.barine.co', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.mattybs.lol', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.nostrdice.com', latitude: -33.8688, longitude: 151.209, region: 'oceania' },
  { url: 'wss://relay.nostraddress.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.tapestry.ninja', latitude: 40.8054, longitude: -74.0241, region: 'na' },
  { url: 'wss://talon.quest', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr-rs-relay.dev.fedibtc.com', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://fanfares.nostr1.com', latitude: 40.7128, longitude: -74.006, region: 'na' },
  { url: 'wss://nostrcheck.tnsor.network', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostrelites.org', latitude: 41.8781, longitude: -87.6298, region: 'na' },
  { url: 'wss://relay.bitcoindistrict.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay2.ngengine.org', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.ngengine.org', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr-relay.cbrx.io', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://dev-relay.lnfi.network', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay.jeffg.fyi', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.coincrowd.fund', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://relay.digitalezukunft.cyou', latitude: 45.5019, longitude: -73.5674, region: 'na' },
  { url: 'wss://r.lostr.net', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://relay.etch.social', latitude: 41.2619, longitude: -95.8608, region: 'na' },
  { url: 'wss://nostr.tac.lol', latitude: 47.4748, longitude: -122.273, region: 'na' },
  { url: 'wss://relay.hasenpfeffr.com', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://relay.illuminodes.com', latitude: 47.6061, longitude: -122.333, region: 'na' },
  { url: 'wss://strfry.shock.network', latitude: 41.8959, longitude: -88.2169, region: 'na' },
  { url: 'wss://nostr.2b9t.xyz', latitude: 34.0549, longitude: -118.243, region: 'na' },
  { url: 'wss://relay.toastr.net', latitude: 40.8054, longitude: -74.0241, region: 'na' },
  { url: 'wss://relay.cosmicbolt.net', latitude: 37.3986, longitude: -121.964, region: 'na' },
  { url: 'wss://temp.iris.to', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.vrtmrz.net', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr-relay.zimage.com', latitude: 34.282, longitude: -118.439, region: 'na' },
  { url: 'wss://ribo.us.nostria.app', latitude: 41.5868, longitude: -93.625, region: 'na' },
  { url: 'wss://relay.fountain.fm', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay.aloftus.io', latitude: 34.0881, longitude: -118.379, region: 'na' },
  { url: 'wss://relay.magiccity.live', latitude: 25.8128, longitude: -80.2377, region: 'na' },
  { url: 'wss://relay.puresignal.news', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay02.lnfi.network', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay03.lnfi.network', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay04.lnfi.network', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay01.lnfi.network', latitude: 39.0997, longitude: -94.5786, region: 'na' },
  { url: 'wss://relay.artx.market', latitude: 43.652, longitude: -79.3633, region: 'na' },
  { url: 'wss://alien.macneilmediagroup.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://zap.watch', latitude: 45.5029, longitude: -73.5723, region: 'na' },
  { url: 'wss://relay.bullishbounty.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr.coincards.com', latitude: 53.5501, longitude: -113.469, region: 'na' },
  { url: 'wss://black.nostrcity.club', latitude: 41.8781, longitude: -87.6298, region: 'na' },
  { url: 'wss://relay.npubhaus.com', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.seq1.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.chakany.systems', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.lightning.pub', latitude: 41.8959, longitude: -88.2169, region: 'na' },
  { url: 'wss://relay.libernet.app', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.usefusion.ai', latitude: 38.7134, longitude: -78.1591, region: 'na' },
  { url: 'wss://relay.credenso.cafe', latitude: 43.3601, longitude: -80.3127, region: 'na' },
  { url: 'wss://relay.evanverma.com', latitude: 40.8302, longitude: -74.1299, region: 'na' },
  { url: 'wss://relay.getsafebox.app', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.goodmorningbitcoin.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.faultables.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://soloco.nl', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.overmind.lol', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.luisschwab.net', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://librerelay.aaroniumii.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.88mph.life', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.hook.cafe', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.ditto.pub', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay2.angor.io', latitude: 48.1046, longitude: 11.6002, region: 'eu' },
  { url: 'wss://srtrelay.c-stellar.net', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relayone.soundhsa.com', latitude: 33.1384, longitude: -95.6011, region: 'na' },
  { url: 'wss://wheat.happytavern.co', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://santo.iguanatech.net', latitude: 40.8302, longitude: -74.1299, region: 'na' },
  { url: 'wss://relay.13room.space', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.lostr.space', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay.jmoose.rocks', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://nostr.thaliyal.com', latitude: 40.8218, longitude: -74.45, region: 'na' },
  { url: 'wss://nostr.tadryanom.me', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://articles.layer3.news', latitude: 37.3387, longitude: -121.885, region: 'na' },
  { url: 'wss://nostr.red5d.dev', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr2.girino.org', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://nostr.kungfu-g.rip', latitude: 33.7946, longitude: -84.4488, region: 'na' },
  { url: 'wss://nostr.thebiglake.org', latitude: 32.71, longitude: -96.6745, region: 'na' },
  { url: 'wss://relay.electriclifestyle.com', latitude: 26.2897, longitude: -80.1293, region: 'na' },
  { url: 'wss://wot.tealeaf.dev', latitude: 33.7488, longitude: -84.3877, region: 'na' },
  { url: 'wss://wot.soundhsa.com', latitude: 33.1384, longitude: -95.6011, region: 'na' },
  { url: 'wss://wot.nostr.place', latitude: 30.2672, longitude: -97.7431, region: 'na' },
  { url: 'wss://wot.brightbolt.net', latitude: 47.6735, longitude: -116.781, region: 'na' },
  { url: 'wss://wot.nostr.party', latitude: 36.1627, longitude: -86.7816, region: 'na' },

  // Europe
  { url: 'wss://shu05.shugur.net', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://relay.nostrhub.tech', latitude: 49.0291, longitude: 8.35696, region: 'eu' },
  { url: 'wss://relay.davidebtc.me', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.moinsen.com', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://relay.olas.app', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://orangepiller.org', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://relay.guggero.org', latitude: 47.3769, longitude: 8.54169, region: 'eu' },
  { url: 'wss://nostr.blankfors.se', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://wot.sovbit.host', latitude: 64.1466, longitude: -21.9426, region: 'eu' },
  { url: 'wss://nostr.huszonegy.world', latitude: 47.4979, longitude: 19.0402, region: 'eu' },
  { url: 'wss://wot.sebastix.social', latitude: 51.8933, longitude: 4.42083, region: 'eu' },
  { url: 'wss://nostr.oxtr.dev', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://relay.mwaters.net', latitude: 50.9871, longitude: 2.12554, region: 'eu' },
  { url: 'wss://relay.lumina.rocks', latitude: 49.0291, longitude: 8.35695, region: 'eu' },
  { url: 'wss://a.nos.lol', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://wot.basspistol.org', latitude: 49.4521, longitude: 11.0767, region: 'eu' },
  { url: 'wss://ribo.eu.nostria.app', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://relay.stream.labs.h3.se', latitude: 59.4016, longitude: 17.9455, region: 'eu' },
  { url: 'wss://nostr.stakey.net', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://nostr-2.21crypto.ch', latitude: 47.4988, longitude: 8.72369, region: 'eu' },
  { url: 'wss://nostr.satstralia.com', latitude: 64.1476, longitude: -21.9392, region: 'eu' },
  { url: 'wss://nr.yay.so', latitude: 46.2126, longitude: 6.1154, region: 'eu' },
  { url: 'wss://wot.dergigi.com', latitude: 64.1476, longitude: -21.9392, region: 'eu' },
  { url: 'wss://nostr-relay.amethyst.name', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://nostr.mehdibekhtaoui.com', latitude: 49.4939, longitude: -1.54813, region: 'eu' },
  { url: 'wss://relay.mess.ch', latitude: 46.948, longitude: 7.44745, region: 'eu' },
  { url: 'wss://relay.sigit.io', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://relay-rpi.edufeed.org', latitude: 49.4543, longitude: 11.0746, region: 'eu' },
  { url: 'wss://nostrelay.circum.space', latitude: 51.2217, longitude: 6.77616, region: 'eu' },
  { url: 'wss://relay.bitcoinartclock.com', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nostr.einundzwanzig.space', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://nostr.mom', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://relay.g1sms.fr', latitude: 43.9432, longitude: 2.07537, region: 'eu' },
  { url: 'wss://nostr-rs-relay-ishosta.phamthanh.me', latitude: 40.7357, longitude: -74.1724, region: 'na' },
  { url: 'wss://relay1.nostrchat.io', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://nostr.21crypto.ch', latitude: 47.4988, longitude: 8.72369, region: 'eu' },
  { url: 'wss://relay.orangepill.ovh', latitude: 49.1689, longitude: -0.358841, region: 'eu' },
  { url: 'wss://wot.codingarena.top', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://gnostr.com', latitude: 42.6978, longitude: 23.3246, region: 'eu' },
  { url: 'wss://relay.fr13nd5.com', latitude: 52.5233, longitude: 13.3426, region: 'eu' },
  { url: 'wss://ithurtswhenip.ee', latitude: 51.223, longitude: 6.78245, region: 'eu' },
  { url: 'wss://relay.dwadziesciajeden.pl', latitude: 52.2297, longitude: 21.0122, region: 'eu' },
  { url: 'wss://relay.nostr.net', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nos.xmark.cc', latitude: 50.6924, longitude: 3.20113, region: 'eu' },
  { url: 'wss://relay.21e6.cz', latitude: 50.1682, longitude: 14.0546, region: 'eu' },
  { url: 'wss://relay.degmods.com', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nostr.myshosholoza.co.za', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://nostr.azzamo.net', latitude: 52.2633, longitude: 21.0283, region: 'eu' },
  { url: 'wss://nostr.4rs.nl', latitude: 49.0291, longitude: 8.35696, region: 'eu' },
  { url: 'wss://relay.copylaradio.com', latitude: 51.223, longitude: 6.78245, region: 'eu' },
  { url: 'wss://nproxy.kristapsk.lv', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://adre.su', latitude: 59.9311, longitude: 30.3609, region: 'eu' },
  { url: 'wss://nostr-02.czas.top', latitude: 53.471, longitude: 9.88208, region: 'eu' },
  { url: 'wss://relay.nosto.re', latitude: 51.8933, longitude: 4.42083, region: 'eu' },
  { url: 'wss://nostr.plantroon.com', latitude: 50.1013, longitude: 8.62643, region: 'eu' },
  { url: 'wss://nostr.rblb.it', latitude: 43.4633, longitude: 11.8796, region: 'eu' },
  { url: 'wss://relay.chorus.community', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.bitcoinveneto.org', latitude: 64.1466, longitude: -21.9426, region: 'eu' },
  { url: 'wss://relay.mccormick.cx', latitude: 52.3563, longitude: 4.95714, region: 'eu' },
  { url: 'wss://nostr.data.haus', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nostr.vulpem.com', latitude: 49.4543, longitude: 11.0746, region: 'eu' },
  { url: 'wss://relay.agora.social', latitude: 50.7383, longitude: 15.0648, region: 'eu' },
  { url: 'wss://nostr.ovia.to', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://orangesync.tech', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://nostr.hifish.org', latitude: 47.4043, longitude: 8.57398, region: 'eu' },
  { url: 'wss://nostr.rtvslawenia.com', latitude: 49.4543, longitude: 11.0746, region: 'eu' },
  { url: 'wss://relay.nostrhub.fr', latitude: 48.1046, longitude: 11.6002, region: 'eu' },
  { url: 'wss://strfry.openhoofd.nl', latitude: 51.9229, longitude: 4.40833, region: 'eu' },
  { url: 'wss://nostr.jfischer.org', latitude: 49.0291, longitude: 8.35696, region: 'eu' },
  { url: 'wss://relay.varke.eu', latitude: 52.6921, longitude: 6.19372, region: 'eu' },
  { url: 'wss://alienos.libretechsystems.xyz', latitude: 55.4724, longitude: 9.87335, region: 'eu' },
  { url: 'wss://pyramid.fiatjaf.com', latitude: 51.5072, longitude: -0.127586, region: 'eu' },
  { url: 'wss://nostr.davidebtc.me', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.cypherflow.ai', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://nostr.snowbla.de', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://inbox.azzamo.net', latitude: 52.2633, longitude: 21.0283, region: 'eu' },
  { url: 'wss://nostr.kalf.org', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://relay.angor.io', latitude: 48.1046, longitude: 11.6002, region: 'eu' },
  { url: 'wss://nostr.chaima.info', latitude: 51.223, longitude: 6.78245, region: 'eu' },
  { url: 'wss://x.kojira.io', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.basspistol.org', latitude: 46.2044, longitude: 6.14316, region: 'eu' },
  { url: 'wss://theoutpost.life', latitude: 64.1476, longitude: -21.9392, region: 'eu' },
  { url: 'wss://relay.freeplace.nl', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://ynostr.yael.at', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://relay.nostr.vet', latitude: 52.6467, longitude: 4.7395, region: 'eu' },
  { url: 'wss://wot.dtonon.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://wot.nostr.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.mikoshi.de', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.letsfo.com', latitude: 51.098, longitude: 17.0321, region: 'eu' },
  { url: 'wss://nostr.simplex.icu', latitude: 50.8198, longitude: -1.08798, region: 'eu' },
  { url: 'wss://nostr.night7.space', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nostr.rikmeijer.nl', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://khatru.nostrver.se', latitude: 51.8933, longitude: 4.42083, region: 'eu' },
  { url: 'wss://nostr.0x7e.xyz', latitude: 47.4988, longitude: 8.72369, region: 'eu' },
  { url: 'wss://relay.zone667.com', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://nostr.agentcampfire.com', latitude: 50.8933, longitude: 6.05805, region: 'eu' },
  { url: 'wss://relay.nostromo.social', latitude: 49.4543, longitude: 11.0746, region: 'eu' },
  { url: 'wss://relay.javi.space', latitude: 43.4633, longitude: 11.8796, region: 'eu' },
  { url: 'wss://nostr.carroarmato0.be', latitude: 50.9928, longitude: 3.26317, region: 'eu' },
  { url: 'wss://relay.arx-ccn.com', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://prl.plus', latitude: 55.7623, longitude: 37.6381, region: 'eu' },
  { url: 'wss://purplerelay.com', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://strfry.elswa-dev.online', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://wot.sudocarlos.com', latitude: 51.5072, longitude: -0.127586, region: 'eu' },
  { url: 'wss://relay.laantungir.net', latitude: -19.4692, longitude: -42.5315, region: 'sa' },
  { url: 'wss://nostr.sathoarder.com', latitude: 48.5734, longitude: 7.75211, region: 'eu' },
  { url: 'wss://nostr.makibisskey.work', latitude: 43.6532, longitude: -79.3832, region: 'na' },

  // Asia-Pacific
  { url: 'wss://dev-nostr.bityacht.io', latitude: 25.0797, longitude: 121.234, region: 'asia' },
  { url: 'wss://nostr.jerrynya.fun', latitude: 31.2304, longitude: 121.474, region: 'asia' },
  { url: 'wss://nostr-01.yakihonne.com', latitude: 1.32123, longitude: 103.695, region: 'asia' },
  { url: 'wss://relay.notoshi.win', latitude: 13.4166, longitude: 101.335, region: 'asia' },
  { url: 'wss://relay.origin.land', latitude: 35.6673, longitude: 139.751, region: 'asia' },
  { url: 'wss://relay.nostr.wirednet.jp', latitude: 34.706, longitude: 135.493, region: 'asia' },
  { url: 'wss://noxir.kpherox.dev', latitude: 34.8587, longitude: 135.509, region: 'asia' },
  { url: 'wss://nostr.camalolo.com', latitude: 24.1469, longitude: 120.684, region: 'asia' },
  { url: 'wss://shu02.shugur.net', latitude: 21.4902, longitude: 39.2246, region: 'asia' },
  { url: 'wss://relay.siamdev.cc', latitude: 13.9178, longitude: 100.424, region: 'asia' },
  { url: 'wss://fenrir-s.notoshi.win', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.hekster.org', latitude: 37.3986, longitude: -121.964, region: 'na' },
  { url: 'wss://relay.wolfcoil.com', latitude: 35.6092, longitude: 139.73, region: 'asia' },
  { url: 'wss://shu01.shugur.net', latitude: 21.4902, longitude: 39.2246, region: 'asia' },
  { url: 'wss://nostr.middling.mydns.jp', latitude: 35.8099, longitude: 140.12, region: 'asia' },
  { url: 'wss://shu04.shugur.net', latitude: 25.2604, longitude: 55.2989, region: 'asia' },
  { url: 'wss://yabu.me', latitude: 35.6092, longitude: 139.73, region: 'asia' },
  { url: 'wss://relay.lifpay.me', latitude: 1.35208, longitude: 103.82, region: 'asia' },
  { url: 'wss://nostr-03.dorafactory.org', latitude: 1.35208, longitude: 103.82, region: 'asia' },
  { url: 'wss://relay.islandbitcoin.com', latitude: 12.8498, longitude: 77.6545, region: 'asia' },
  { url: 'wss://nostr.now', latitude: 36.55, longitude: 139.733, region: 'asia' },
  { url: 'wss://relay.wavlake.com', latitude: 41.2619, longitude: -95.8608, region: 'na' },

  // Africa
  { url: 'wss://ribo.af.nostria.app', latitude: -26.2041, longitude: 28.0473, region: 'africa' },

  // South America
  { url: 'wss://relay.nostr.info', latitude: 40.7357, longitude: -74.1724, region: 'na' },

  // Additional relays from Android app
  { url: 'wss://relay.smies.me', latitude: 33.7501, longitude: -84.3885, region: 'na' },
  { url: 'wss://nostr.bond', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://wot.yesnostr.net', latitude: 50.9871, longitude: 2.12554, region: 'eu' },
  { url: 'wss://chat-relay.zap-work.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://bucket.coracle.social', latitude: 37.7775, longitude: -122.397, region: 'na' },
  { url: 'wss://notemine.io', latitude: 52.2026, longitude: 20.9397, region: 'eu' },
  { url: 'wss://relay.minibolt.info', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.robosats.org', latitude: 64.1476, longitude: -21.9392, region: 'eu' },
  { url: 'wss://nostr.lkjsxc.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://vault.iris.to', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostrcity-club.fly.dev', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://nostr.dler.com', latitude: 25.0367, longitude: 121.524, region: 'asia' },
  { url: 'wss://nostr.ps1829.com', latitude: 33.8851, longitude: 130.883, region: 'asia' },
  { url: 'wss://nostr.na.social', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.comcomponent.com', latitude: 34.7062, longitude: 135.493, region: 'asia' },
  { url: 'wss://nostr.bitcoiner.social', latitude: 39.1585, longitude: -94.5728, region: 'na' },
  { url: 'wss://czas.xyz', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://relaynostr.breadslice.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.openhoofd.nl', latitude: 51.9229, longitude: 4.40833, region: 'eu' },
  { url: 'wss://relay.nostrcheck.me', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr-relay.xbytez.io', latitude: 50.6924, longitude: 3.20113, region: 'eu' },
  { url: 'wss://r.bitcoinhold.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://wons.calva.dev', latitude: 37.3986, longitude: -121.964, region: 'na' },
  { url: 'wss://v-relay.d02.vrtmrz.net', latitude: 34.6937, longitude: 135.502, region: 'asia' },
  { url: 'wss://relay-freeharmonypeople.space', latitude: 38.7223, longitude: -9.13934, region: 'eu' },
  { url: 'wss://nostr.bgbitcoin.club', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nostr-relay.corb.net', latitude: 38.8353, longitude: -104.822, region: 'na' },
  { url: 'wss://relayone.geektank.ai', latitude: 18.2148, longitude: -63.0574, region: 'na' },
  { url: 'wss://discovery.eu.nostria.app', latitude: 52.3676, longitude: 4.90414, region: 'eu' },
  { url: 'wss://relay.btcforplebs.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.noones.com', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.ru.ac.th', latitude: 13.7607, longitude: 100.627, region: 'asia' },
  { url: 'wss://relay.vantis.ninja', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://schnorr.me', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.calitabby.net', latitude: 39.9268, longitude: -75.0246, region: 'na' },
  { url: 'wss://relay.routstr.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://strfry.felixzieger.de', latitude: 50.1013, longitude: 8.62643, region: 'eu' },
  { url: 'wss://ephemeral.snowflare.cc', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://bcast.girino.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.openfarmtools.org', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://rele.speyhard.vip', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.nuts.cash', latitude: 34.0362, longitude: -118.443, region: 'na' },
  { url: 'wss://nostr.zoracle.org', latitude: 45.6018, longitude: -121.185, region: 'na' },
  { url: 'wss://relay.nsnip.io', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://wot.geektank.ai', latitude: 18.2148, longitude: -63.0574, region: 'na' },
  { url: 'wss://relay.upleb.uk', latitude: 52.2297, longitude: 21.0122, region: 'eu' },
  { url: 'wss://relay-fra.zombi.cloudrodion.com', latitude: 48.8566, longitude: 2.35222, region: 'eu' },
  { url: 'wss://relay.westernbtc.com', latitude: 44.5401, longitude: -123.368, region: 'na' },
  { url: 'wss://relay.nostar.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://strfry.ymir.cloud', latitude: 34.0965, longitude: -117.585, region: 'na' },
  { url: 'wss://relay.wavefunc.live', latitude: 34.0362, longitude: -118.443, region: 'na' },
  { url: 'wss://relay.bnos.space', latitude: 1.35208, longitude: 103.82, region: 'asia' },
  { url: 'wss://relay.nostrverse.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.threenine.services', latitude: 51.5524, longitude: -0.29686, region: 'eu' },
  { url: 'wss://nostr.quali.chat', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://kitchen.zap.cooking', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://bcast.seutoba.com.br', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr.n7ekb.net', latitude: 47.4941, longitude: -122.294, region: 'na' },
  { url: 'wss://nostr-relay.gateway.in.th', latitude: 15.2634, longitude: 100.344, region: 'asia' },
  { url: 'wss://nostr.superfriends.online', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.unitypay.cash', latitude: 41.4513, longitude: -81.7021, region: 'na' },
  { url: 'wss://relay.divine.video', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://freeben666.fr', latitude: 43.7221, longitude: 7.15296, region: 'eu' },
  { url: 'wss://nostr.bitczat.pl', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://wot.shaving.kiwi', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://okn.czas.top', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.mitchelltribe.com', latitude: 39.0438, longitude: -77.4874, region: 'na' },
  { url: 'wss://0m0sef4nb45q6.cloreai.ru', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.layer.systems', latitude: 49.0291, longitude: 8.35695, region: 'eu' },
  { url: 'wss://freelay.sovbit.host', latitude: 64.1476, longitude: -21.9392, region: 'eu' },
  { url: 'wss://nostr.czas.top', latitude: 50.1109, longitude: 8.68213, region: 'eu' },
  { url: 'wss://relay.satmaxt.xyz', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relay.malxte.de', latitude: 52.52, longitude: 13.405, region: 'eu' },
  { url: 'wss://kotukonostr.onrender.com', latitude: 37.7775, longitude: -122.397, region: 'na' },
  { url: 'wss://nostrcheck.me', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://orly.ft.hn', latitude: 50.4754, longitude: 12.3683, region: 'eu' },
  { url: 'wss://nos4smartnkind.tech', latitude: 40.1872, longitude: 44.5152, region: 'asia' },
  { url: 'wss://relay.cyphernomad.com', latitude: 60.1699, longitude: 24.9384, region: 'eu' },
  { url: 'wss://bitcoiner.social', latitude: 39.1585, longitude: -94.5728, region: 'na' },
  { url: 'wss://relay.thebluepulse.com', latitude: 49.4521, longitude: 11.0767, region: 'eu' },
  { url: 'wss://relay.contextvm.org', latitude: 53.3498, longitude: -6.26031, region: 'eu' },
  { url: 'wss://nostr-relayrs.gateway.in.th', latitude: 15.2634, longitude: 100.344, region: 'asia' },
  { url: 'wss://bitsat.molonlabe.holdings', latitude: 51.4012, longitude: -1.3147, region: 'eu' },
  { url: 'wss://nostr-02.yakihonne.com', latitude: 1.32123, longitude: 103.695, region: 'asia' },
  { url: 'wss://relay.nostrzh.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostrja-kari.heguro.com', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://pyramid.aaro.cc', latitude: 32.7767, longitude: -96.797, region: 'na' },
  { url: 'wss://espelho.girino.org', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relayb.uid.ovh', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr-01.uid.ovh', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://nostr-02.uid.ovh', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://mhp258zrpiiwn.clorecloud.net', latitude: 43.6532, longitude: -79.3832, region: 'na' },
  { url: 'wss://relayrs.notoshi.win', latitude: 43.6532, longitude: -79.3832, region: 'na' },
] as const;

/**
 * Extract just URLs for backward compatibility
 */
export const DEFAULT_RELAY_URLS: readonly string[] = ALL_RELAYS.map(r => r.url);

/**
 * Primary relay URLs only
 */
export const PRIMARY_RELAY_URLS: readonly string[] = PRIMARY_RELAYS.map(r => r.url);

/**
 * Get relays by region
 */
export function getRelaysByRegion(region: string): RelayInfo[] {
  return ALL_RELAYS.filter(r => r.region === region);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get relays sorted by proximity to a location
 * @param latitude User's latitude
 * @param longitude User's longitude
 * @param maxDistance Optional maximum distance in km (default: unlimited)
 * @returns Relays sorted by distance, closest first
 */
export function getRelaysByProximity(
  latitude: number,
  longitude: number,
  maxDistance?: number
): Array<RelayInfo & { distance: number }> {
  const relaysWithDistance = ALL_RELAYS.map(relay => ({
    ...relay,
    distance: calculateDistance(latitude, longitude, relay.latitude, relay.longitude),
  }));

  const filtered = maxDistance
    ? relaysWithDistance.filter(r => r.distance <= maxDistance)
    : relaysWithDistance;

  return filtered.sort((a, b) => a.distance - b.distance);
}

/**
 * Get a balanced selection of relays from different regions
 * @param count Total number of relays to return
 * @param userLatitude Optional user latitude for proximity bias
 * @param userLongitude Optional user longitude for proximity bias
 */
export function getBalancedRelaySelection(
  count: number,
  userLatitude?: number,
  userLongitude?: number
): RelayInfo[] {
  // Always include primary relays
  const selected: RelayInfo[] = [...PRIMARY_RELAYS];

  if (selected.length >= count) {
    return selected.slice(0, count);
  }

  const remaining = count - selected.length;
  const selectedUrls = new Set(selected.map(r => r.url));

  // Get remaining relays, optionally sorted by proximity
  let candidates = ALL_RELAYS.filter(r => !selectedUrls.has(r.url));

  if (userLatitude !== undefined && userLongitude !== undefined) {
    // Sort by proximity to user
    candidates = [...candidates].sort((a, b) => {
      const distA = calculateDistance(userLatitude, userLongitude, a.latitude, a.longitude);
      const distB = calculateDistance(userLatitude, userLongitude, b.latitude, b.longitude);
      return distA - distB;
    });
  }

  // Add remaining relays
  for (let i = 0; i < remaining && i < candidates.length; i++) {
    const candidate = candidates[i];
    if (candidate) {
      selected.push(candidate);
    }
  }

  return selected;
}

/**
 * Relay regions
 */
export type RelayRegion = 'na' | 'eu' | 'asia' | 'oceania' | 'africa' | 'sa';

/**
 * Get region name from code
 */
export function getRegionName(region: RelayRegion): string {
  const names: Record<RelayRegion, string> = {
    na: 'North America',
    eu: 'Europe',
    asia: 'Asia-Pacific',
    oceania: 'Oceania',
    africa: 'Africa',
    sa: 'South America',
  };
  return names[region] || region;
}
