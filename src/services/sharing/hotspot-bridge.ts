/**
 * Hotspot Bridge Service - P2P App Sharing
 *
 * Manages the bridge between devices for P2P app sharing via WiFi hotspot.
 * Provides detection, guidance, and connection management for hotspot-based
 * app distribution.
 *
 * Features:
 * - Hotspot activation detection (limited by browser APIs)
 * - Platform-specific setup instructions
 * - Connection state management
 * - Network change detection
 *
 * @module services/sharing/hotspot-bridge
 */

// ============================================================================
// Types
// ============================================================================

export type DevicePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';

export type HotspotState =
  | 'unknown'      // Cannot determine hotspot state
  | 'inactive'     // Hotspot is not active
  | 'activating'   // User is in process of activating
  | 'active'       // Hotspot is active (detected or assumed)
  | 'connected';   // Other devices have connected

export type ConnectionRole = 'host' | 'client' | 'none';

export interface HotspotConfig {
  /** Suggested network name for the hotspot */
  suggestedNetworkName?: string;
  /** Whether to monitor network changes */
  monitorNetwork?: boolean;
  /** Callback for state changes */
  onStateChange?: (state: HotspotState) => void;
  /** Verbose logging */
  verbose?: boolean;
}

export interface HotspotStatus {
  /** Current hotspot state */
  state: HotspotState;
  /** Detected platform */
  platform: DevicePlatform;
  /** Whether device is likely hosting a hotspot */
  isHost: boolean;
  /** Whether device is connected to a hotspot (as client) */
  isClient: boolean;
  /** Detected network name (if available) */
  networkName: string | null;
  /** Estimated number of connected clients */
  clientCount: number;
  /** Last state update timestamp */
  lastUpdate: number;
  /** Any error message */
  error: string | null;
}

export interface HotspotInstructions {
  /** The target platform */
  platform: DevicePlatform;
  /** Human-readable platform name */
  platformName: string;
  /** Step-by-step instructions */
  steps: HotspotStep[];
  /** Additional tips */
  tips: string[];
  /** Expected hotspot IP range */
  expectedIpRange: string;
  /** Estimated time to complete setup */
  estimatedTime: string;
}

export interface HotspotStep {
  /** Step number (1-indexed) */
  number: number;
  /** Brief instruction */
  title: string;
  /** Detailed description */
  description: string;
  /** Optional: Settings path to navigate to */
  settingsPath?: string;
  /** Optional: Icon hint for UI */
  icon?: string;
}

export interface ConnectionInfo {
  /** Role of this device */
  role: ConnectionRole;
  /** Local IP address */
  localIp: string | null;
  /** Gateway IP (host's IP if client) */
  gatewayIp: string | null;
  /** Connected at timestamp */
  connectedAt: number | null;
  /** Connection quality indicator */
  quality: 'unknown' | 'good' | 'fair' | 'poor';
}

// ============================================================================
// Constants
// ============================================================================

/** Platform-specific hotspot IP ranges */
const HOTSPOT_IP_RANGES: Record<DevicePlatform, string[]> = {
  ios: ['172.20.10.'],
  android: ['192.168.43.', '192.168.49.'],
  macos: ['192.168.2.'],
  windows: ['192.168.137.'],
  linux: ['10.42.0.'],
  unknown: ['192.168.'],
};

/** Platform-specific hotspot instructions */
const PLATFORM_INSTRUCTIONS: Record<DevicePlatform, Omit<HotspotInstructions, 'platform'>> = {
  ios: {
    platformName: 'iPhone/iPad',
    steps: [
      {
        number: 1,
        title: 'Open Settings',
        description: 'Tap the Settings app on your home screen',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Go to Personal Hotspot',
        description: 'Scroll down and tap "Personal Hotspot"',
        settingsPath: 'Settings > Personal Hotspot',
        icon: 'wifi',
      },
      {
        number: 3,
        title: 'Enable Hotspot',
        description: 'Toggle "Allow Others to Join" to ON',
        icon: 'toggle',
      },
      {
        number: 4,
        title: 'Note Password',
        description: 'Remember or note the Wi-Fi password shown',
        icon: 'key',
      },
      {
        number: 5,
        title: 'Share with Friend',
        description: 'Tell your friend the password so they can connect',
        icon: 'share',
      },
    ],
    tips: [
      'Keep the Settings app open to maintain the hotspot',
      'Your hotspot name is usually your device name',
      'Maximum of 5 devices can connect',
    ],
    expectedIpRange: '172.20.10.x',
    estimatedTime: '1-2 minutes',
  },
  android: {
    platformName: 'Android',
    steps: [
      {
        number: 1,
        title: 'Open Settings',
        description: 'Open the Settings app from your app drawer or quick settings',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Find Hotspot Settings',
        description: 'Tap "Network & internet" or "Connections", then "Hotspot & tethering"',
        settingsPath: 'Settings > Network > Hotspot',
        icon: 'network',
      },
      {
        number: 3,
        title: 'Configure Hotspot',
        description: 'Tap "Wi-Fi hotspot" to configure name and password',
        icon: 'wifi',
      },
      {
        number: 4,
        title: 'Enable Hotspot',
        description: 'Toggle the Wi-Fi hotspot switch to ON',
        icon: 'toggle',
      },
      {
        number: 5,
        title: 'Share Credentials',
        description: 'Share the network name and password with your friend',
        icon: 'share',
      },
    ],
    tips: [
      'Some Android phones have hotspot in quick settings',
      'Location services may need to be enabled',
      'Check your carrier plan for hotspot limits',
    ],
    expectedIpRange: '192.168.43.x or 192.168.49.x',
    estimatedTime: '1-2 minutes',
  },
  macos: {
    platformName: 'Mac',
    steps: [
      {
        number: 1,
        title: 'Open System Settings',
        description: 'Click the Apple menu and select "System Settings"',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Go to Sharing',
        description: 'Click "General" then "Sharing"',
        settingsPath: 'System Settings > General > Sharing',
        icon: 'share',
      },
      {
        number: 3,
        title: 'Enable Internet Sharing',
        description: 'Turn on "Internet Sharing" and select Wi-Fi as the share method',
        icon: 'wifi',
      },
      {
        number: 4,
        title: 'Configure Wi-Fi',
        description: 'Click "Wi-Fi Options" to set network name and password',
        icon: 'key',
      },
      {
        number: 5,
        title: 'Start Sharing',
        description: 'Confirm to start the hotspot',
        icon: 'check',
      },
    ],
    tips: [
      'Internet Sharing requires an internet connection (Ethernet or another source)',
      'The Mac must stay awake for sharing to work',
    ],
    expectedIpRange: '192.168.2.x',
    estimatedTime: '2-3 minutes',
  },
  windows: {
    platformName: 'Windows',
    steps: [
      {
        number: 1,
        title: 'Open Settings',
        description: 'Press Win+I or click Start and select Settings',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Go to Mobile Hotspot',
        description: 'Click "Network & Internet" then "Mobile hotspot"',
        settingsPath: 'Settings > Network > Mobile hotspot',
        icon: 'wifi',
      },
      {
        number: 3,
        title: 'Configure Settings',
        description: 'Click "Edit" to change the network name and password',
        icon: 'edit',
      },
      {
        number: 4,
        title: 'Enable Hotspot',
        description: 'Toggle "Mobile hotspot" to On',
        icon: 'toggle',
      },
      {
        number: 5,
        title: 'Share Credentials',
        description: 'Share the network name and password with your friend',
        icon: 'share',
      },
    ],
    tips: [
      'Your PC needs a Wi-Fi adapter',
      'Some corporate laptops may have hotspot disabled',
    ],
    expectedIpRange: '192.168.137.x',
    estimatedTime: '2-3 minutes',
  },
  linux: {
    platformName: 'Linux',
    steps: [
      {
        number: 1,
        title: 'Open Network Settings',
        description: 'Open your system settings or NetworkManager applet',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Create Hotspot',
        description: 'Look for "Create Wi-Fi Hotspot" or use nm-connection-editor',
        icon: 'add',
      },
      {
        number: 3,
        title: 'Configure Network',
        description: 'Set a network name (SSID) and password',
        icon: 'wifi',
      },
      {
        number: 4,
        title: 'Start Hotspot',
        description: 'Activate the hotspot connection',
        icon: 'play',
      },
      {
        number: 5,
        title: 'Share Details',
        description: 'Share the network name and password with your friend',
        icon: 'share',
      },
    ],
    tips: [
      'You may need to use the terminal: nmcli device wifi hotspot',
      'Ensure your Wi-Fi adapter supports AP mode',
    ],
    expectedIpRange: '10.42.0.x',
    estimatedTime: '3-5 minutes',
  },
  unknown: {
    platformName: 'Your Device',
    steps: [
      {
        number: 1,
        title: 'Open Settings',
        description: 'Open your device settings',
        icon: 'settings',
      },
      {
        number: 2,
        title: 'Find Hotspot',
        description: 'Look for "Hotspot", "Tethering", or "Internet Sharing"',
        icon: 'search',
      },
      {
        number: 3,
        title: 'Configure',
        description: 'Set up a network name and password',
        icon: 'edit',
      },
      {
        number: 4,
        title: 'Enable',
        description: 'Turn on the hotspot feature',
        icon: 'toggle',
      },
      {
        number: 5,
        title: 'Connect',
        description: 'Share credentials with your friend',
        icon: 'share',
      },
    ],
    tips: [
      'Most smartphones have hotspot in network settings',
      'Some carriers may charge extra for hotspot usage',
    ],
    expectedIpRange: '192.168.x.x',
    estimatedTime: '2-3 minutes',
  },
};

// ============================================================================
// Hotspot Bridge Service
// ============================================================================

/**
 * HotspotBridgeService manages WiFi hotspot setup and connection
 * for P2P app sharing.
 *
 * Since browsers have limited access to network configuration,
 * this service focuses on:
 * - Detecting the current platform
 * - Providing platform-specific instructions
 * - Monitoring network changes
 * - Inferring hotspot state from network info
 */
export class HotspotBridgeService {
  private static instance: HotspotBridgeService | null = null;

  private config: HotspotConfig;
  private status: HotspotStatus;
  private connectionInfo: ConnectionInfo;
  private networkChangeHandler: (() => void) | null = null;
  private stateChangeCallbacks: Set<(state: HotspotState) => void> = new Set();

  private constructor() {
    this.config = {
      monitorNetwork: true,
      verbose: false,
    };

    this.status = {
      state: 'unknown',
      platform: this.detectPlatform(),
      isHost: false,
      isClient: false,
      networkName: null,
      clientCount: 0,
      lastUpdate: Date.now(),
      error: null,
    };

    this.connectionInfo = {
      role: 'none',
      localIp: null,
      gatewayIp: null,
      connectedAt: null,
      quality: 'unknown',
    };
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): HotspotBridgeService {
    if (!HotspotBridgeService.instance) {
      HotspotBridgeService.instance = new HotspotBridgeService();
    }
    return HotspotBridgeService.instance;
  }

  /**
   * Initialize the service with optional configuration
   */
  public async initialize(config?: HotspotConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };

      if (config.onStateChange) {
        this.stateChangeCallbacks.add(config.onStateChange);
      }
    }

    // Start network monitoring if enabled
    if (this.config.monitorNetwork) {
      this.startNetworkMonitoring();
    }

    // Initial state detection
    await this.detectState();

    this.log('HotspotBridgeService initialized');
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopNetworkMonitoring();
    this.stateChangeCallbacks.clear();
  }

  // ==========================================================================
  // Platform Detection
  // ==========================================================================

  /**
   * Detect the current device platform
   */
  public detectPlatform(): DevicePlatform {
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() ?? '';

    // iOS detection
    if (
      /iphone|ipad|ipod/.test(ua) ||
      (platform === 'macintel' && navigator.maxTouchPoints > 1)
    ) {
      return 'ios';
    }

    // Android detection
    if (/android/.test(ua)) {
      return 'android';
    }

    // macOS detection
    if (/mac/.test(platform) && !(/iphone|ipad/.test(ua))) {
      return 'macos';
    }

    // Windows detection
    if (/win/.test(platform)) {
      return 'windows';
    }

    // Linux detection
    if (/linux/.test(platform)) {
      return 'linux';
    }

    return 'unknown';
  }

  /**
   * Get the current platform
   */
  public getPlatform(): DevicePlatform {
    return this.status.platform;
  }

  /**
   * Check if the current platform supports hotspot
   */
  public supportsHotspot(): boolean {
    // All major platforms support hotspot in some form
    return true;
  }

  // ==========================================================================
  // State Detection
  // ==========================================================================

  /**
   * Detect current hotspot state.
   *
   * Browser APIs don't provide direct hotspot information,
   * so we infer state from:
   * - Network connection type
   * - IP address ranges
   * - Network change events
   */
  public async detectState(): Promise<HotspotState> {
    try {
      // Try to get IP address
      const ip = await this.detectIpAddress();

      if (ip) {
        this.connectionInfo.localIp = ip;

        // Check if IP is in a known hotspot range
        const hotspotInfo = this.analyzeIpForHotspot(ip);

        if (hotspotInfo.isHotspotNetwork) {
          if (hotspotInfo.isHost) {
            this.status.state = 'active';
            this.status.isHost = true;
            this.status.isClient = false;
            this.connectionInfo.role = 'host';
          } else {
            this.status.state = 'connected';
            this.status.isHost = false;
            this.status.isClient = true;
            this.connectionInfo.role = 'client';
            this.connectionInfo.gatewayIp = hotspotInfo.gatewayIp;
            this.connectionInfo.connectedAt = Date.now();
          }
        } else {
          this.status.state = 'inactive';
          this.status.isHost = false;
          this.status.isClient = false;
          this.connectionInfo.role = 'none';
        }
      } else {
        this.status.state = 'unknown';
      }

      this.status.lastUpdate = Date.now();
      this.notifyStateChange();

      return this.status.state;
    } catch (error) {
      this.log('State detection error:', error);
      this.status.state = 'unknown';
      this.status.error = error instanceof Error ? error.message : String(error);
      return 'unknown';
    }
  }

  /**
   * Detect IP address using WebRTC
   */
  private async detectIpAddress(): Promise<string | null> {
    return new Promise((resolve) => {
      if (typeof RTCPeerConnection === 'undefined') {
        resolve(null);
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: [] });
      let resolved = false;

      pc.onicecandidate = (event) => {
        if (resolved) return;

        if (event.candidate) {
          const match = event.candidate.candidate.match(
            /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
          );
          if (match) {
            const ip = match[1];
            if (ip && !ip.startsWith('127.') && !ip.startsWith('0.')) {
              resolved = true;
              pc.close();
              resolve(ip);
            }
          }
        }

        if (event.candidate === null && !resolved) {
          resolved = true;
          pc.close();
          resolve(null);
        }
      };

      pc.createDataChannel('');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          resolved = true;
          pc.close();
          resolve(null);
        });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve(null);
        }
      }, 3000);
    });
  }

  /**
   * Analyze IP address to determine if it's on a hotspot network
   */
  private analyzeIpForHotspot(ip: string): {
    isHotspotNetwork: boolean;
    isHost: boolean;
    platform: DevicePlatform | null;
    gatewayIp: string | null;
  } {
    // Check against known hotspot ranges
    for (const [platform, ranges] of Object.entries(HOTSPOT_IP_RANGES)) {
      for (const range of ranges) {
        if (ip.startsWith(range)) {
          // Determine if host (usually .1) or client
          const lastOctet = parseInt(ip.split('.').pop() ?? '0', 10);
          const isHost = lastOctet === 1;

          // Calculate gateway IP
          const parts = ip.split('.');
          parts[3] = '1';
          const gatewayIp = parts.join('.');

          return {
            isHotspotNetwork: true,
            isHost,
            platform: platform as DevicePlatform,
            gatewayIp: isHost ? null : gatewayIp,
          };
        }
      }
    }

    return {
      isHotspotNetwork: false,
      isHost: false,
      platform: null,
      gatewayIp: null,
    };
  }

  // ==========================================================================
  // Network Monitoring
  // ==========================================================================

  /**
   * Start monitoring network changes
   */
  private startNetworkMonitoring(): void {
    if (this.networkChangeHandler) return;

    this.networkChangeHandler = () => {
      this.log('Network change detected');
      this.detectState();
    };

    // Listen for online/offline events
    window.addEventListener('online', this.networkChangeHandler);
    window.addEventListener('offline', this.networkChangeHandler);

    // Listen for network information changes if available
    if ('connection' in navigator) {
      const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
      if (connection) {
        connection.addEventListener('change', this.networkChangeHandler);
      }
    }
  }

  /**
   * Stop monitoring network changes
   */
  private stopNetworkMonitoring(): void {
    if (!this.networkChangeHandler) return;

    window.removeEventListener('online', this.networkChangeHandler);
    window.removeEventListener('offline', this.networkChangeHandler);

    if ('connection' in navigator) {
      const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
      if (connection) {
        connection.removeEventListener('change', this.networkChangeHandler);
      }
    }

    this.networkChangeHandler = null;
  }

  // ==========================================================================
  // Instructions
  // ==========================================================================

  /**
   * Get hotspot setup instructions for the current platform
   */
  public getInstructions(): HotspotInstructions {
    const platform = this.status.platform;
    const instructions = PLATFORM_INSTRUCTIONS[platform];

    return {
      platform,
      ...instructions,
    };
  }

  /**
   * Get instructions for a specific platform
   */
  public getInstructionsForPlatform(platform: DevicePlatform): HotspotInstructions {
    const instructions = PLATFORM_INSTRUCTIONS[platform];
    return {
      platform,
      ...instructions,
    };
  }

  /**
   * Get connection instructions for the receiving device
   */
  public getReceiverInstructions(): {
    steps: string[];
    tips: string[];
  } {
    const platform = this.status.platform;

    return {
      steps: [
        'Open your Wi-Fi settings',
        `Look for the hotspot network (usually the ${PLATFORM_INSTRUCTIONS[platform].platformName}'s name)`,
        'Enter the password shared by your friend',
        'Wait for connection confirmation',
        'Open the URL shared with you in your browser',
        'Follow prompts to install BitChat as an app',
      ],
      tips: [
        'Stay close to the host device for best signal',
        'Make sure Wi-Fi is enabled on your device',
        'If you can\'t see the network, ask the host to check their hotspot',
        'The app will work offline after first install',
      ],
    };
  }

  // ==========================================================================
  // User Guidance
  // ==========================================================================

  /**
   * Mark that user is activating hotspot
   * (For UI feedback purposes)
   */
  public markActivating(): void {
    this.status.state = 'activating';
    this.status.lastUpdate = Date.now();
    this.notifyStateChange();
  }

  /**
   * Mark that hotspot is assumed active
   * (When we can't detect automatically)
   */
  public markActive(): void {
    this.status.state = 'active';
    this.status.isHost = true;
    this.status.lastUpdate = Date.now();
    this.connectionInfo.role = 'host';
    this.notifyStateChange();
  }

  /**
   * Mark that another device has connected
   */
  public markClientConnected(): void {
    this.status.state = 'connected';
    this.status.clientCount++;
    this.status.lastUpdate = Date.now();
    this.notifyStateChange();
  }

  /**
   * Reset state to inactive
   */
  public reset(): void {
    this.status.state = 'inactive';
    this.status.isHost = false;
    this.status.isClient = false;
    this.status.clientCount = 0;
    this.status.lastUpdate = Date.now();
    this.connectionInfo.role = 'none';
    this.connectionInfo.connectedAt = null;
    this.notifyStateChange();
  }

  // ==========================================================================
  // Status & Events
  // ==========================================================================

  /**
   * Get current hotspot status
   */
  public getStatus(): HotspotStatus {
    return { ...this.status };
  }

  /**
   * Get connection information
   */
  public getConnectionInfo(): ConnectionInfo {
    return { ...this.connectionInfo };
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(callback: (state: HotspotState) => void): () => void {
    this.stateChangeCallbacks.add(callback);

    // Immediately notify with current state
    callback(this.status.state);

    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((callback) => {
      try {
        callback(this.status.state);
      } catch (error) {
        this.log('State change callback error:', error);
      }
    });
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Check if currently on a mobile device
   */
  public isMobile(): boolean {
    return this.status.platform === 'ios' || this.status.platform === 'android';
  }

  /**
   * Check if the device is online
   */
  public isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Get the suggested network name for hotspot
   */
  public getSuggestedNetworkName(): string {
    if (this.config.suggestedNetworkName) {
      return this.config.suggestedNetworkName;
    }

    return 'BitChat-Share';
  }

  /**
   * Generate a random hotspot password suggestion
   */
  public generatePasswordSuggestion(): string {
    // Generate a simple, speakable password
    const words = ['chat', 'mesh', 'link', 'sync', 'peer', 'node', 'wave', 'beam'];
    const numbers = Math.floor(Math.random() * 900 + 100);
    const word = words[Math.floor(Math.random() * words.length)];

    return `${word}${numbers}`;
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.verbose) {
      console.log(`[HotspotBridge] ${message}`, ...args);
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export const hotspotBridge = HotspotBridgeService.getInstance();
export default hotspotBridge;
