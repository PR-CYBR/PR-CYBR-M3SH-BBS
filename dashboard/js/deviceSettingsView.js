/**
 * Device Settings View Module
 * Provides UI for configuring Meshtastic device settings
 * 
 * @module deviceSettingsView
 */

/**
 * @typedef {Object} DeviceProfile
 * @property {string} id - Profile ID
 * @property {string} name - Device/profile name
 * @property {string} description - Device description
 * @property {string} role - Device role (gateway, relay, sensor, mobile)
 * @property {Object} radio - Radio settings
 * @property {Object} bbs - BBS settings
 * @property {Object} power - Power settings
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

// Default profile template
const DEFAULT_PROFILE = {
  id: 'local-default',
  name: 'Local Node',
  description: 'Default PR-CYBR Mesh Node',
  role: 'relay',
  radio: {
    region: 'US',
    modemPreset: 'LongFast',
    txPower: 30,
    hopLimit: 3,
    frequencySlot: 0
  },
  bbs: {
    defaultChannel: 0,
    messageRetention: 100,
    priorityDefault: 'normal'
  },
  power: {
    isRouter: false,
    sleepEnabled: true,
    sleepInterval: 3600,
    gpsEnabled: true,
    positionInterval: 900,
    telemetryInterval: 1800
  }
};

// Current profile state
let currentProfile = null;
let savedProfiles = {};

// Region presets
const REGIONS = [
  { value: 'US', label: 'United States (902-928 MHz)' },
  { value: 'EU_868', label: 'Europe (868 MHz)' },
  { value: 'CN', label: 'China (470-510 MHz)' },
  { value: 'JP', label: 'Japan (920-925 MHz)' },
  { value: 'ANZ', label: 'Australia/NZ (915-928 MHz)' },
  { value: 'KR', label: 'Korea (920-923 MHz)' },
  { value: 'TW', label: 'Taiwan (920-925 MHz)' },
  { value: 'RU', label: 'Russia (868.7-869.2 MHz)' },
  { value: 'IN', label: 'India (865-867 MHz)' },
  { value: 'NZ_865', label: 'New Zealand (865 MHz)' },
  { value: 'TH', label: 'Thailand (920-925 MHz)' },
  { value: 'UA_868', label: 'Ukraine (868 MHz)' },
  { value: 'UA_433', label: 'Ukraine (433 MHz)' }
];

// Modem presets
const MODEM_PRESETS = [
  { value: 'LongFast', label: 'Long Fast (250kbps, default)' },
  { value: 'LongSlow', label: 'Long Slow (31.25kbps, max range)' },
  { value: 'LongModerate', label: 'Long Moderate (62.5kbps)' },
  { value: 'MediumFast', label: 'Medium Fast (125kbps)' },
  { value: 'MediumSlow', label: 'Medium Slow (31.25kbps)' },
  { value: 'ShortFast', label: 'Short Fast (250kbps, local)' },
  { value: 'ShortSlow', label: 'Short Slow (31.25kbps)' }
];

// Device roles
const DEVICE_ROLES = [
  { value: 'client', label: 'Client (Mobile/Handheld)' },
  { value: 'router', label: 'Router (Always-on relay)' },
  { value: 'gateway', label: 'Gateway (Internet connected)' },
  { value: 'sensor', label: 'Sensor (Low power, telemetry)' },
  { value: 'tracker', label: 'Tracker (GPS focused)' }
];

/**
 * Load profiles from localStorage
 */
function loadProfiles() {
  try {
    const saved = localStorage.getItem('pr-cybr-device-profiles');
    if (saved) {
      savedProfiles = JSON.parse(saved);
    }
    
    // Load current profile
    const current = localStorage.getItem('pr-cybr-current-profile');
    if (current) {
      currentProfile = JSON.parse(current);
    } else {
      currentProfile = { ...DEFAULT_PROFILE };
    }
  } catch (e) {
    console.warn('Failed to load device profiles:', e);
    currentProfile = { ...DEFAULT_PROFILE };
  }
}

/**
 * Save profiles to localStorage
 */
function saveProfiles() {
  try {
    localStorage.setItem('pr-cybr-device-profiles', JSON.stringify(savedProfiles));
    localStorage.setItem('pr-cybr-current-profile', JSON.stringify(currentProfile));
  } catch (e) {
    console.warn('Failed to save device profiles:', e);
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe string
 * @returns {string}
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate select options HTML
 * @param {Array} options - Array of {value, label} objects
 * @param {string} selected - Currently selected value
 * @returns {string}
 */
function generateOptions(options, selected) {
  return options.map(opt => 
    `<option value="${escapeHtml(opt.value)}" ${opt.value === selected ? 'selected' : ''}>
      ${escapeHtml(opt.label)}
    </option>`
  ).join('');
}

/**
 * Render device identity section
 * @returns {string}
 */
function renderIdentitySection() {
  return `
    <div class="settings-section">
      <div class="settings-section-header">
        <h3>📛 Device Identity</h3>
      </div>
      <div class="settings-section-content">
        <div class="settings-grid">
          <div class="form-group">
            <label for="device-name">Device Name</label>
            <input type="text" id="device-name" class="form-input" 
                   value="${escapeHtml(currentProfile.name)}" 
                   placeholder="My Meshtastic Node"
                   maxlength="32">
            <span class="form-hint">Max 32 characters, shown on mesh</span>
          </div>
          <div class="form-group">
            <label for="device-description">Description</label>
            <input type="text" id="device-description" class="form-input" 
                   value="${escapeHtml(currentProfile.description)}" 
                   placeholder="Node description">
          </div>
          <div class="form-group">
            <label for="device-role">Device Role</label>
            <select id="device-role" class="form-select">
              ${generateOptions(DEVICE_ROLES, currentProfile.role)}
            </select>
            <span class="form-hint">Affects power usage and routing behavior</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render radio settings section
 * @returns {string}
 */
function renderRadioSection() {
  return `
    <div class="settings-section">
      <div class="settings-section-header">
        <h3>📻 Radio / Network Settings</h3>
      </div>
      <div class="settings-section-content">
        <div class="settings-grid">
          <div class="form-group">
            <label for="radio-region">Region Preset</label>
            <select id="radio-region" class="form-select">
              ${generateOptions(REGIONS, currentProfile.radio.region)}
            </select>
            <span class="form-hint">Must match local regulations</span>
          </div>
          <div class="form-group">
            <label for="radio-modem">Modem Preset</label>
            <select id="radio-modem" class="form-select">
              ${generateOptions(MODEM_PRESETS, currentProfile.radio.modemPreset)}
            </select>
            <span class="form-hint">Affects range vs speed tradeoff</span>
          </div>
          <div class="form-group">
            <label for="radio-txpower">TX Power (dBm)</label>
            <input type="range" id="radio-txpower" class="form-range" 
                   min="1" max="30" 
                   value="${currentProfile.radio.txPower}">
            <div class="range-display">
              <span>1</span>
              <span id="txpower-value">${currentProfile.radio.txPower} dBm</span>
              <span>30</span>
            </div>
          </div>
          <div class="form-group">
            <label for="radio-hoplimit">Hop Limit</label>
            <input type="number" id="radio-hoplimit" class="form-input" 
                   min="1" max="7" 
                   value="${currentProfile.radio.hopLimit}">
            <span class="form-hint">Maximum hops for message relay (1-7)</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render BBS settings section
 * @returns {string}
 */
function renderBbsSection() {
  return `
    <div class="settings-section">
      <div class="settings-section-header">
        <h3>📢 BBS Settings</h3>
      </div>
      <div class="settings-section-content">
        <div class="settings-grid">
          <div class="form-group">
            <label for="bbs-channel">Default BBS Channel</label>
            <select id="bbs-channel" class="form-select">
              <option value="0" ${currentProfile.bbs.defaultChannel === 0 ? 'selected' : ''}>
                Channel 0 - Public (PR-MESH-BBS)
              </option>
              <option value="1" ${currentProfile.bbs.defaultChannel === 1 ? 'selected' : ''}>
                Channel 1 - OPS-SITREP
              </option>
              <option value="2" ${currentProfile.bbs.defaultChannel === 2 ? 'selected' : ''}>
                Channel 2 - S2-INTEL
              </option>
              <option value="3" ${currentProfile.bbs.defaultChannel === 3 ? 'selected' : ''}>
                Channel 3 - S3-PLANS
              </option>
              <option value="4" ${currentProfile.bbs.defaultChannel === 4 ? 'selected' : ''}>
                Channel 4 - M3SH-OPS
              </option>
              <option value="5" ${currentProfile.bbs.defaultChannel === 5 ? 'selected' : ''}>
                Channel 5 - LOG-RES
              </option>
              <option value="6" ${currentProfile.bbs.defaultChannel === 6 ? 'selected' : ''}>
                Channel 6 - MAILB0X
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="bbs-retention">Message Retention Limit</label>
            <input type="number" id="bbs-retention" class="form-input" 
                   min="10" max="1000" 
                   value="${currentProfile.bbs.messageRetention}">
            <span class="form-hint">Maximum messages to store locally</span>
          </div>
          <div class="form-group">
            <label for="bbs-priority">Default Priority</label>
            <select id="bbs-priority" class="form-select">
              <option value="low" ${currentProfile.bbs.priorityDefault === 'low' ? 'selected' : ''}>
                Low
              </option>
              <option value="normal" ${currentProfile.bbs.priorityDefault === 'normal' ? 'selected' : ''}>
                Normal
              </option>
              <option value="high" ${currentProfile.bbs.priorityDefault === 'high' ? 'selected' : ''}>
                High
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render power and telemetry section
 * @returns {string}
 */
function renderPowerSection() {
  return `
    <div class="settings-section">
      <div class="settings-section-header">
        <h3>⚡ Power & Telemetry</h3>
      </div>
      <div class="settings-section-content">
        <div class="settings-grid">
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="power-router" 
                     ${currentProfile.power.isRouter ? 'checked' : ''}>
              <span>Router Mode</span>
            </label>
            <span class="form-hint">Always-on, relays all messages</span>
          </div>
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="power-sleep" 
                     ${currentProfile.power.sleepEnabled ? 'checked' : ''}>
              <span>Sleep Enabled</span>
            </label>
            <span class="form-hint">Enable power saving sleep mode</span>
          </div>
          <div class="form-group">
            <label for="power-sleepinterval">Sleep Interval (seconds)</label>
            <input type="number" id="power-sleepinterval" class="form-input" 
                   min="60" max="86400" 
                   value="${currentProfile.power.sleepInterval}">
          </div>
          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="power-gps" 
                     ${currentProfile.power.gpsEnabled ? 'checked' : ''}>
              <span>GPS Enabled</span>
            </label>
            <span class="form-hint">Enable GPS for position reporting</span>
          </div>
          <div class="form-group">
            <label for="power-posinterval">Position Interval (seconds)</label>
            <input type="number" id="power-posinterval" class="form-input" 
                   min="60" max="86400" 
                   value="${currentProfile.power.positionInterval}">
          </div>
          <div class="form-group">
            <label for="power-telemetry">Telemetry Interval (seconds)</label>
            <input type="number" id="power-telemetry" class="form-input" 
                   min="60" max="86400" 
                   value="${currentProfile.power.telemetryInterval}">
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render profile management section
 * @returns {string}
 */
function renderProfileSection() {
  const profileCount = Object.keys(savedProfiles).length;
  
  return `
    <div class="settings-section settings-section--profiles">
      <div class="settings-section-header">
        <h3>💾 Profile Management</h3>
      </div>
      <div class="settings-section-content">
        <div class="profile-actions">
          <button id="save-profile-btn" class="btn btn--primary">
            💾 Save Current Profile
          </button>
          <button id="export-profile-btn" class="btn btn--secondary">
            📤 Export as JSON
          </button>
          <label class="btn btn--secondary">
            📥 Import JSON
            <input type="file" id="import-profile-input" accept=".json" hidden>
          </label>
          <button id="reset-profile-btn" class="btn btn--secondary">
            🔄 Reset to Defaults
          </button>
        </div>
        
        ${profileCount > 0 ? `
          <div class="saved-profiles">
            <h4>Saved Profiles (${profileCount})</h4>
            <ul class="profiles-list">
              ${Object.entries(savedProfiles).map(([id, profile]) => `
                <li class="profile-item" data-profile-id="${escapeHtml(id)}">
                  <div class="profile-info">
                    <span class="profile-name">${escapeHtml(profile.name)}</span>
                    <span class="profile-role">${escapeHtml(profile.role)}</span>
                  </div>
                  <div class="profile-item-actions">
                    <button class="btn btn--small load-profile" data-profile-id="${escapeHtml(id)}">
                      Load
                    </button>
                    <button class="btn btn--small btn--danger delete-profile" data-profile-id="${escapeHtml(id)}">
                      ×
                    </button>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="device-sync">
          <h4>Device Sync</h4>
          <p class="sync-status" id="device-sync-status">
            ⚠️ No device connected
          </p>
          <div class="sync-actions">
            <button id="load-from-device-btn" class="btn btn--secondary" disabled>
              📥 Load from Device
            </button>
            <button id="apply-to-device-btn" class="btn btn--primary" disabled>
              📤 Apply to Device
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Collect current form values into profile object
 * @returns {DeviceProfile}
 */
function collectFormValues() {
  return {
    id: currentProfile.id || `profile-${Date.now()}`,
    name: document.getElementById('device-name')?.value || 'Unnamed',
    description: document.getElementById('device-description')?.value || '',
    role: document.getElementById('device-role')?.value || 'relay',
    radio: {
      region: document.getElementById('radio-region')?.value || 'US',
      modemPreset: document.getElementById('radio-modem')?.value || 'LongFast',
      txPower: parseInt(document.getElementById('radio-txpower')?.value) || 30,
      hopLimit: parseInt(document.getElementById('radio-hoplimit')?.value) || 3,
      frequencySlot: 0
    },
    bbs: {
      defaultChannel: parseInt(document.getElementById('bbs-channel')?.value) || 0,
      messageRetention: parseInt(document.getElementById('bbs-retention')?.value) || 100,
      priorityDefault: document.getElementById('bbs-priority')?.value || 'normal'
    },
    power: {
      isRouter: document.getElementById('power-router')?.checked || false,
      sleepEnabled: document.getElementById('power-sleep')?.checked || true,
      sleepInterval: parseInt(document.getElementById('power-sleepinterval')?.value) || 3600,
      gpsEnabled: document.getElementById('power-gps')?.checked || true,
      positionInterval: parseInt(document.getElementById('power-posinterval')?.value) || 900,
      telemetryInterval: parseInt(document.getElementById('power-telemetry')?.value) || 1800
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Render the device settings view
 * @param {HTMLElement} container - Container element
 */
export function renderDeviceSettingsView(container) {
  if (!container) return;
  
  loadProfiles();
  
  container.innerHTML = `
    <div class="device-settings-view">
      <div class="settings-header">
        <h2>⚙️ Device Settings</h2>
        <p>Configure your Meshtastic device settings. Changes are saved locally and can be synced to a connected device.</p>
      </div>
      ${renderIdentitySection()}
      ${renderRadioSection()}
      ${renderBbsSection()}
      ${renderPowerSection()}
      ${renderProfileSection()}
    </div>
  `;
  
  attachEventListeners(container);
}

/**
 * Attach event listeners
 * @param {HTMLElement} container - Container element
 */
function attachEventListeners(container) {
  // TX Power slider
  const txPowerSlider = container.querySelector('#radio-txpower');
  const txPowerValue = container.querySelector('#txpower-value');
  if (txPowerSlider && txPowerValue) {
    txPowerSlider.addEventListener('input', function() {
      txPowerValue.textContent = `${this.value} dBm`;
    });
  }
  
  // Auto-save on change
  container.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('change', function() {
      currentProfile = collectFormValues();
      saveProfiles();
    });
  });
  
  // Save profile button
  const saveBtn = container.querySelector('#save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      currentProfile = collectFormValues();
      const profileId = `profile-${Date.now()}`;
      currentProfile.id = profileId;
      currentProfile.createdAt = new Date().toISOString();
      savedProfiles[profileId] = { ...currentProfile };
      saveProfiles();
      renderDeviceSettingsView(container);
      showToast('Profile saved!');
    });
  }
  
  // Export profile button
  const exportBtn = container.querySelector('#export-profile-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      currentProfile = collectFormValues();
      const json = JSON.stringify(currentProfile, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meshtastic-profile-${currentProfile.name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Profile exported!');
    });
  }
  
  // Import profile input
  const importInput = container.querySelector('#import-profile-input');
  if (importInput) {
    importInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          // Validate and sanitize imported profile to prevent prototype pollution
          if (imported && typeof imported === 'object' && imported.name && imported.radio) {
            // Create a clean profile object with only expected properties
            const sanitizedProfile = {
              id: typeof imported.id === 'string' ? imported.id : `imported-${Date.now()}`,
              name: String(imported.name || ''),
              description: String(imported.description || ''),
              role: String(imported.role || 'relay'),
              radio: {
                region: String(imported.radio?.region || 'US'),
                modemPreset: String(imported.radio?.modemPreset || 'LongFast'),
                txPower: Number(imported.radio?.txPower) || 30,
                hopLimit: Number(imported.radio?.hopLimit) || 3,
                frequencySlot: Number(imported.radio?.frequencySlot) || 0
              },
              bbs: {
                defaultChannel: Number(imported.bbs?.defaultChannel) || 0,
                messageRetention: Number(imported.bbs?.messageRetention) || 100,
                priorityDefault: String(imported.bbs?.priorityDefault || 'normal')
              },
              power: {
                isRouter: Boolean(imported.power?.isRouter),
                sleepEnabled: imported.power?.sleepEnabled !== false,
                sleepInterval: Number(imported.power?.sleepInterval) || 3600,
                gpsEnabled: imported.power?.gpsEnabled !== false,
                positionInterval: Number(imported.power?.positionInterval) || 900,
                telemetryInterval: Number(imported.power?.telemetryInterval) || 1800
              },
              createdAt: String(imported.createdAt || new Date().toISOString()),
              updatedAt: new Date().toISOString()
            };
            currentProfile = sanitizedProfile;
            saveProfiles();
            renderDeviceSettingsView(container);
            showToast('Profile imported!');
          } else {
            alert('Invalid profile format');
          }
        } catch (err) {
          alert('Failed to parse profile: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }
  
  // Reset profile button
  const resetBtn = container.querySelector('#reset-profile-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (confirm('Reset all settings to defaults?')) {
        currentProfile = { ...DEFAULT_PROFILE };
        saveProfiles();
        renderDeviceSettingsView(container);
        showToast('Settings reset to defaults');
      }
    });
  }
  
  // Load saved profile buttons
  container.querySelectorAll('.load-profile').forEach(btn => {
    btn.addEventListener('click', function() {
      const profileId = this.dataset.profileId;
      const profile = savedProfiles[profileId];
      if (profile) {
        currentProfile = { ...profile };
        saveProfiles();
        renderDeviceSettingsView(container);
        showToast('Profile loaded!');
      }
    });
  });
  
  // Delete saved profile buttons
  container.querySelectorAll('.delete-profile').forEach(btn => {
    btn.addEventListener('click', function() {
      const profileId = this.dataset.profileId;
      if (confirm('Delete this profile?')) {
        delete savedProfiles[profileId];
        saveProfiles();
        renderDeviceSettingsView(container);
        showToast('Profile deleted');
      }
    });
  });
}

/**
 * Update device sync status
 * @param {boolean} connected - Whether device is connected
 * @param {string} deviceName - Connected device name
 */
export function updateDeviceSyncStatus(connected, deviceName) {
  const statusEl = document.getElementById('device-sync-status');
  const loadBtn = document.getElementById('load-from-device-btn');
  const applyBtn = document.getElementById('apply-to-device-btn');
  
  if (statusEl) {
    if (connected) {
      statusEl.innerHTML = `✅ Connected to: <strong>${escapeHtml(deviceName)}</strong>`;
    } else {
      statusEl.innerHTML = '⚠️ No device connected';
    }
  }
  
  if (loadBtn) loadBtn.disabled = !connected;
  if (applyBtn) applyBtn.disabled = !connected;
}

/**
 * Get current profile
 * @returns {DeviceProfile}
 */
export function getCurrentProfile() {
  loadProfiles();
  return { ...currentProfile };
}

/**
 * Set current profile
 * @param {DeviceProfile} profile - Profile to set
 */
export function setCurrentProfile(profile) {
  currentProfile = { ...profile };
  saveProfiles();
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

// Export module API
export default {
  renderDeviceSettingsView,
  updateDeviceSyncStatus,
  getCurrentProfile,
  setCurrentProfile
};
