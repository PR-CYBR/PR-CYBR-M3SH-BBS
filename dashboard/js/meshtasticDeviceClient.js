/**
 * Meshtastic Device Client Module
 * Provides high-level async functions for connecting to Meshtastic devices
 * via Web Serial and Web Bluetooth APIs.
 * 
 * @module meshtasticDeviceClient
 */

// Feature flag for testing on GitHub Pages (static hosting)
// Set to false when deploying with real Meshtastic device support
// Can be overridden by setting window.USE_MESHTASTIC_MOCKS = false before loading
const USE_MESHTASTIC_MOCKS = window.USE_MESHTASTIC_MOCKS !== undefined 
  ? window.USE_MESHTASTIC_MOCKS 
  : true;

/**
 * @typedef {Object} ChannelConfig
 * @property {number} index - Channel index (0-7)
 * @property {string} name - Channel name
 * @property {string} role - Channel role (primary, secondary, disabled)
 * @property {string|null} psk - Pre-shared key (base64 encoded)
 * @property {string} modemPreset - Modem preset (ShortFast, MediumSlow, etc.)
 */

/**
 * @typedef {Object} DeviceSettings
 * @property {string} name - Device name
 * @property {string} description - Device description
 * @property {string} role - Device role (gateway, relay, sensor, mobile)
 * @property {Object} radio - Radio settings
 * @property {Object} power - Power settings
 */

/**
 * @typedef {Object} ConnectionState
 * @property {boolean} connected - Whether device is connected
 * @property {string} type - Connection type (serial, bluetooth, network, mock)
 * @property {string|null} deviceName - Connected device name
 * @property {Object|null} port - Serial port or Bluetooth device reference
 */

/** @type {ConnectionState} */
const connectionState = {
  connected: false,
  type: null,
  deviceName: null,
  port: null,
  reader: null,
  writer: null
};

/**
 * Check if Web Serial API is supported
 * @returns {boolean}
 */
export function isSerialSupported() {
  return 'serial' in navigator;
}

/**
 * Check if Web Bluetooth API is supported
 * @returns {boolean}
 */
export function isBluetoothSupported() {
  return 'bluetooth' in navigator;
}

/**
 * Get current connection state
 * @returns {ConnectionState}
 */
export function getConnectionState() {
  return { ...connectionState };
}

/**
 * Connect to Meshtastic device via Web Serial API
 * @returns {Promise<{success: boolean, message: string, deviceName?: string}>}
 */
export async function connectSerial() {
  if (!isSerialSupported()) {
    return {
      success: false,
      message: 'Web Serial API is not supported in this browser. Use Chrome, Edge, or Opera on desktop.'
    };
  }

  if (USE_MESHTASTIC_MOCKS) {
    // Mock connection for testing
    await new Promise(resolve => setTimeout(resolve, 500));
    connectionState.connected = true;
    connectionState.type = 'mock-serial';
    connectionState.deviceName = 'Mock Meshtastic Device (Serial)';
    return {
      success: true,
      message: 'Connected to mock Meshtastic device via Serial',
      deviceName: connectionState.deviceName
    };
  }

  try {
    // Request port from user
    const port = await navigator.serial.requestPort({
      filters: [
        // Meshtastic devices typically use these USB vendor IDs
        { usbVendorId: 0x1A86 }, // CH340
        { usbVendorId: 0x10C4 }, // CP2102
        { usbVendorId: 0x303A }, // ESP32-S3 native USB
        { usbVendorId: 0x239A }  // Adafruit
      ]
    });

    // Open connection at 115200 baud (Meshtastic default)
    await port.open({ baudRate: 115200 });

    connectionState.port = port;
    connectionState.connected = true;
    connectionState.type = 'serial';
    connectionState.deviceName = 'Meshtastic Device (Serial)';

    // Set up reader/writer for future communication
    // NOTE: Full Meshtastic protocol implementation would go here
    // For now, we just establish the connection

    return {
      success: true,
      message: 'Connected to Meshtastic device via Serial',
      deviceName: connectionState.deviceName
    };
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return {
        success: false,
        message: 'No device selected. Please select a Meshtastic device.'
      };
    }
    return {
      success: false,
      message: `Serial connection failed: ${error.message}`
    };
  }
}

/**
 * Connect to Meshtastic device via Web Bluetooth API
 * @returns {Promise<{success: boolean, message: string, deviceName?: string}>}
 */
export async function connectBluetooth() {
  if (!isBluetoothSupported()) {
    return {
      success: false,
      message: 'Web Bluetooth API is not supported in this browser. Use Chrome, Edge, or Opera on desktop.'
    };
  }

  if (USE_MESHTASTIC_MOCKS) {
    // Mock connection for testing
    await new Promise(resolve => setTimeout(resolve, 500));
    connectionState.connected = true;
    connectionState.type = 'mock-bluetooth';
    connectionState.deviceName = 'Mock Meshtastic Device (BLE)';
    return {
      success: true,
      message: 'Connected to mock Meshtastic device via Bluetooth',
      deviceName: connectionState.deviceName
    };
  }

  try {
    // Meshtastic BLE Service UUID
    // NOTE: Real implementation would use official Meshtastic UUIDs:
    // Service: 6ba1b218-15a8-461f-9fa8-5dcae273eafd
    // TX Characteristic: f75c76d2-129e-4dad-a1dd-7866124401e7
    // RX Characteristic: ed9da18c-a800-4f66-a670-aa7547e34453
    
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'Meshtastic' },
        { namePrefix: 'T-Beam' },
        { namePrefix: 'T-Echo' },
        { namePrefix: 'LILYGO' },
        { namePrefix: 'RAK' }
      ],
      optionalServices: [
        '6ba1b218-15a8-461f-9fa8-5dcae273eafd' // Meshtastic service UUID
      ]
    });

    // Connect to GATT server
    const server = await device.gatt.connect();

    connectionState.port = { device, server };
    connectionState.connected = true;
    connectionState.type = 'bluetooth';
    connectionState.deviceName = device.name || 'Meshtastic Device (BLE)';

    return {
      success: true,
      message: 'Connected to Meshtastic device via Bluetooth',
      deviceName: connectionState.deviceName
    };
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return {
        success: false,
        message: 'No device selected. Please select a Meshtastic device.'
      };
    }
    return {
      success: false,
      message: `Bluetooth connection failed: ${error.message}`
    };
  }
}

/**
 * Disconnect from current device
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function disconnect() {
  if (!connectionState.connected) {
    return {
      success: true,
      message: 'No device connected'
    };
  }

  try {
    if (connectionState.type === 'serial' && connectionState.port) {
      await connectionState.port.close();
    } else if (connectionState.type === 'bluetooth' && connectionState.port?.server) {
      connectionState.port.server.disconnect();
    }
  } catch (error) {
    console.warn('Error during disconnect:', error);
  }

  // Reset state
  connectionState.connected = false;
  connectionState.type = null;
  connectionState.deviceName = null;
  connectionState.port = null;

  return {
    success: true,
    message: 'Disconnected from device'
  };
}

/**
 * Get channel configuration from connected device
 * @returns {Promise<{success: boolean, message: string, channels?: ChannelConfig[]}>}
 */
export async function getChannels() {
  if (!connectionState.connected) {
    return {
      success: false,
      message: 'No device connected'
    };
  }

  if (USE_MESHTASTIC_MOCKS || connectionState.type.startsWith('mock')) {
    // Return mock channel data
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: true,
      message: 'Retrieved channel configuration',
      channels: [
        { index: 0, name: 'LongFast', role: 'primary', psk: null, modemPreset: 'LongFast' },
        { index: 1, name: 'OPS-SITREP', role: 'secondary', psk: 'mock-psk-1', modemPreset: 'ShortFast' },
        { index: 2, name: 'S2-INTEL', role: 'secondary', psk: 'mock-psk-2', modemPreset: 'ShortFast' },
        { index: 3, name: 'S3-PLANS', role: 'secondary', psk: 'mock-psk-3', modemPreset: 'MediumSlow' },
        { index: 4, name: 'M3SH-OPS', role: 'secondary', psk: 'mock-psk-4', modemPreset: 'ShortFast' },
        { index: 5, name: 'LOG-RES', role: 'secondary', psk: 'mock-psk-5', modemPreset: 'MediumSlow' },
        { index: 6, name: 'MAILB0X', role: 'secondary', psk: 'mock-psk-6', modemPreset: 'ShortFast' },
        { index: 7, name: '', role: 'disabled', psk: null, modemPreset: 'ShortFast' }
      ]
    };
  }

  // TODO: Implement actual Meshtastic protocol communication
  // This would involve:
  // 1. Sending a ADMIN_GET_CHANNEL_REQUEST for each channel index
  // 2. Parsing the protobuf response
  // 3. Building the channel array
  
  return {
    success: false,
    message: 'Real device communication not yet implemented'
  };
}

/**
 * Set channel configuration on connected device
 * @param {ChannelConfig[]} channels - Array of channel configurations
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function setChannels(channels) {
  if (!connectionState.connected) {
    return {
      success: false,
      message: 'No device connected'
    };
  }

  if (!Array.isArray(channels) || channels.length === 0) {
    return {
      success: false,
      message: 'Invalid channel configuration'
    };
  }

  if (USE_MESHTASTIC_MOCKS || connectionState.type.startsWith('mock')) {
    // Simulate setting channels
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      message: `Updated ${channels.length} channel(s) on device`
    };
  }

  // TODO: Implement actual Meshtastic protocol communication
  // This would involve:
  // 1. For each channel, send ADMIN_SET_CHANNEL with the channel config
  // 2. Wait for acknowledgment
  // 3. Optionally reboot device to apply changes
  
  return {
    success: false,
    message: 'Real device communication not yet implemented'
  };
}

/**
 * Get device settings from connected device
 * @returns {Promise<{success: boolean, message: string, settings?: DeviceSettings}>}
 */
export async function getSettings() {
  if (!connectionState.connected) {
    return {
      success: false,
      message: 'No device connected'
    };
  }

  if (USE_MESHTASTIC_MOCKS || connectionState.type.startsWith('mock')) {
    // Return mock settings
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: true,
      message: 'Retrieved device settings',
      settings: {
        name: 'PR-CYBR-Node-001',
        description: 'Puerto Rico CYBR Mesh Gateway',
        role: 'gateway',
        radio: {
          region: 'US',
          modemPreset: 'LongFast',
          txPower: 30,
          hopLimit: 3
        },
        power: {
          isRouter: true,
          sleepEnabled: false,
          gpsEnabled: true,
          positionInterval: 900
        },
        bbs: {
          defaultChannel: 0,
          messageRetention: 100
        }
      }
    };
  }

  // TODO: Implement actual Meshtastic protocol communication
  return {
    success: false,
    message: 'Real device communication not yet implemented'
  };
}

/**
 * Set device settings on connected device
 * @param {DeviceSettings} settings - Device settings object
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function setSettings(settings) {
  if (!connectionState.connected) {
    return {
      success: false,
      message: 'No device connected'
    };
  }

  if (!settings || typeof settings !== 'object') {
    return {
      success: false,
      message: 'Invalid settings object'
    };
  }

  if (USE_MESHTASTIC_MOCKS || connectionState.type.startsWith('mock')) {
    // Simulate applying settings
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      success: true,
      message: 'Device settings applied successfully'
    };
  }

  // TODO: Implement actual Meshtastic protocol communication
  return {
    success: false,
    message: 'Real device communication not yet implemented'
  };
}

/**
 * Read data from serial port (helper for future protocol implementation)
 * @param {number} timeout - Read timeout in milliseconds
 * @returns {Promise<Uint8Array|null>}
 */
async function readSerial(timeout = 5000) {
  if (!connectionState.port || connectionState.type !== 'serial') {
    return null;
  }

  try {
    const reader = connectionState.port.readable.getReader();
    const timer = setTimeout(() => reader.cancel(), timeout);
    
    const { value, done } = await reader.read();
    clearTimeout(timer);
    reader.releaseLock();
    
    return done ? null : value;
  } catch (error) {
    console.error('Serial read error:', error);
    return null;
  }
}

/**
 * Write data to serial port (helper for future protocol implementation)
 * @param {Uint8Array} data - Data to write
 * @returns {Promise<boolean>}
 */
async function writeSerial(data) {
  if (!connectionState.port || connectionState.type !== 'serial') {
    return false;
  }

  try {
    const writer = connectionState.port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    return true;
  } catch (error) {
    console.error('Serial write error:', error);
    return false;
  }
}

// Export module API
export default {
  isSerialSupported,
  isBluetoothSupported,
  getConnectionState,
  connectSerial,
  connectBluetooth,
  disconnect,
  getChannels,
  setChannels,
  getSettings,
  setSettings
};
