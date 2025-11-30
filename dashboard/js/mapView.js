/**
 * Map View Module
 * Provides Leaflet-based map visualization for Meshtastic nodes over Puerto Rico
 * 
 * @module mapView
 */

/**
 * @typedef {Object} NodeLocation
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {number} [alt] - Altitude in meters
 */

/**
 * @typedef {Object} MeshNode
 * @property {string} node_id - Unique node identifier
 * @property {string} name - Node display name
 * @property {string} last_seen - ISO timestamp of last contact
 * @property {number} battery - Battery level (0-1)
 * @property {number} [rssi] - Signal strength
 * @property {number} [snr] - Signal-to-noise ratio
 * @property {NodeLocation} [location] - Node location
 * @property {string[]} [tags] - Node tags/roles
 */

// Puerto Rico default center coordinates
const PR_CENTER = { lat: 18.2208, lon: -66.5901 };
const PR_ZOOM = 9;

// Map state
let map = null;
let markersLayer = null;
let currentFilters = {
  gateway: true,
  relay: true,
  sensor: true,
  other: true
};

// Node role icons/colors
const ROLE_COLORS = {
  gateway: '#00d4aa',  // Primary teal
  relay: '#2196f3',    // Blue
  sensor: '#ffc107',   // Yellow
  mobile: '#9c27b0',   // Purple
  other: '#6b7280'     // Gray
};

/**
 * Determine node role from tags
 * @param {string[]} tags - Node tags array
 * @returns {string} - Primary role
 */
function getNodeRole(tags) {
  if (!tags || !Array.isArray(tags)) return 'other';
  
  if (tags.includes('gateway')) return 'gateway';
  if (tags.includes('relay')) return 'relay';
  if (tags.includes('sensor')) return 'sensor';
  if (tags.includes('mobile')) return 'mobile';
  return 'other';
}

/**
 * Calculate node freshness status
 * @param {string} lastSeen - ISO timestamp
 * @returns {{status: string, class: string, age: string}}
 */
function getNodeFreshness(lastSeen) {
  if (!lastSeen) {
    return { status: 'unknown', class: 'unknown', age: 'Never' };
  }
  
  const now = new Date();
  const seen = new Date(lastSeen);
  const diffMs = now - seen;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;
  
  let age;
  if (diffHours < 1) {
    age = `${Math.floor(diffMs / 60000)}m ago`;
  } else if (diffHours < 24) {
    age = `${Math.floor(diffHours)}h ago`;
  } else {
    age = `${Math.floor(diffDays)}d ago`;
  }
  
  if (diffHours < 24) {
    return { status: 'Fresh', class: 'fresh', age };
  } else if (diffDays < 7) {
    return { status: 'Stale', class: 'stale', age };
  }
  return { status: 'Offline', class: 'offline', age };
}

/**
 * Create a custom divIcon for a node marker
 * @param {string} role - Node role
 * @param {string} freshness - Freshness class
 * @returns {L.DivIcon}
 */
function createNodeIcon(role, freshness) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.other;
  
  // Create SVG marker
  const svg = `
    <svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="${color}" opacity="${freshness === 'offline' ? '0.4' : '1'}"/>
      <circle cx="12" cy="10" r="5" fill="white"/>
    </svg>
  `;
  
  return L.divIcon({
    html: svg,
    className: `node-marker node-marker--${freshness}`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32]
  });
}

/**
 * Create popup content for a node
 * @param {MeshNode} node - Node data
 * @returns {string} - HTML content
 */
function createNodePopup(node) {
  const role = getNodeRole(node.tags);
  const freshness = getNodeFreshness(node.last_seen);
  const battery = node.battery ? Math.round(node.battery * 100) : 0;
  const location = node.location 
    ? `${node.location.lat?.toFixed(4)}, ${node.location.lon?.toFixed(4)}` 
    : 'Unknown';
  
  return `
    <div class="map-popup">
      <div class="map-popup-header">
        <strong>${escapeHtml(node.name)}</strong>
        <span class="freshness-badge freshness-badge--${freshness.class}">${freshness.status}</span>
      </div>
      <table class="map-popup-table">
        <tr><td>Node ID:</td><td><code>${escapeHtml(node.node_id)}</code></td></tr>
        <tr><td>Role:</td><td>${escapeHtml(role)}</td></tr>
        <tr><td>Last Seen:</td><td>${freshness.age}</td></tr>
        <tr><td>Battery:</td><td>${battery}%</td></tr>
        <tr><td>RSSI/SNR:</td><td>${node.rssi || '–'} / ${node.snr || '–'}</td></tr>
        <tr><td>Location:</td><td>${location}</td></tr>
      </table>
      <div class="map-popup-actions">
        <button class="btn btn--small btn--secondary copy-node-id" data-node-id="${escapeHtml(node.node_id)}">
          📋 Copy ID
        </button>
        <button class="btn btn--small btn--secondary scroll-to-dashboard" data-node-id="${escapeHtml(node.node_id)}">
          📍 View on Dashboard
        </button>
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe string
 * @returns {string} - Escaped string
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
 * Initialize the Leaflet map
 * @param {string} containerId - DOM element ID for map container
 * @returns {Object} - Leaflet map instance
 */
export function initMap(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Map container #${containerId} not found`);
    return null;
  }
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    container.innerHTML = `
      <div class="map-error">
        <p>⚠️ Map library unavailable</p>
        <p>The map requires the Leaflet library which could not be loaded.</p>
      </div>
    `;
    return null;
  }
  
  // Initialize map centered on Puerto Rico
  map = L.map(containerId, {
    center: [PR_CENTER.lat, PR_CENTER.lon],
    zoom: PR_ZOOM,
    zoomControl: true
  });
  
  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);
  
  // Create markers layer group
  markersLayer = L.layerGroup().addTo(map);
  
  // Add legend
  addLegend();
  
  return map;
}

/**
 * Add legend control to map
 */
function addLegend() {
  if (!map) return;
  
  const legend = L.control({ position: 'bottomright' });
  
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <h4>Node Types</h4>
      <div class="legend-item">
        <span class="legend-color" style="background: ${ROLE_COLORS.gateway}"></span>
        Gateway
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: ${ROLE_COLORS.relay}"></span>
        Relay
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: ${ROLE_COLORS.sensor}"></span>
        Sensor
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: ${ROLE_COLORS.mobile}"></span>
        Mobile
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: ${ROLE_COLORS.other}"></span>
        Other
      </div>
    `;
    return div;
  };
  
  legend.addTo(map);
}

/**
 * Update map with node data
 * @param {MeshNode[]} nodes - Array of node data
 */
export function updateNodes(nodes) {
  if (!map || !markersLayer) {
    console.warn('Map not initialized');
    return;
  }
  
  // Clear existing markers
  markersLayer.clearLayers();
  
  if (!nodes || !Array.isArray(nodes)) {
    return;
  }
  
  nodes.forEach(node => {
    // Skip nodes without location
    if (!node.location || !node.location.lat || !node.location.lon) {
      return;
    }
    
    const role = getNodeRole(node.tags);
    
    // Apply filters
    if (!currentFilters[role] && !currentFilters.other) {
      return;
    }
    if (role === 'other' && !currentFilters.other) {
      return;
    }
    if (role !== 'other' && !currentFilters[role]) {
      return;
    }
    
    const freshness = getNodeFreshness(node.last_seen);
    const icon = createNodeIcon(role, freshness.class);
    
    const marker = L.marker([node.location.lat, node.location.lon], { icon })
      .bindPopup(createNodePopup(node));
    
    // Add click handlers after popup opens
    marker.on('popupopen', function() {
      // Copy node ID button
      const copyBtn = document.querySelector('.copy-node-id');
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          const nodeId = this.dataset.nodeId;
          navigator.clipboard.writeText(nodeId).then(() => {
            this.textContent = '✓ Copied!';
            setTimeout(() => { this.textContent = '📋 Copy ID'; }, 1500);
          });
        });
      }
      
      // Scroll to dashboard button
      const scrollBtn = document.querySelector('.scroll-to-dashboard');
      if (scrollBtn) {
        scrollBtn.addEventListener('click', function() {
          // Switch to dashboard view and scroll to nodes section
          if (typeof window.switchView === 'function') {
            window.switchView('dashboard');
          }
          const nodesSection = document.getElementById('nodes-grid');
          if (nodesSection) {
            nodesSection.scrollIntoView({ behavior: 'smooth' });
          }
          map.closePopup();
        });
      }
    });
    
    markersLayer.addLayer(marker);
  });
}

/**
 * Set filter state and refresh display
 * @param {Object} filters - Filter object with role keys and boolean values
 */
export function setFilters(filters) {
  currentFilters = { ...currentFilters, ...filters };
}

/**
 * Get current filter state
 * @returns {Object} - Current filters
 */
export function getFilters() {
  return { ...currentFilters };
}

/**
 * Center map on Puerto Rico
 */
export function resetView() {
  if (map) {
    map.setView([PR_CENTER.lat, PR_CENTER.lon], PR_ZOOM);
  }
}

/**
 * Fit map bounds to show all nodes
 * @param {MeshNode[]} nodes - Array of node data
 */
export function fitToNodes(nodes) {
  if (!map || !nodes || nodes.length === 0) return;
  
  const validNodes = nodes.filter(n => n.location?.lat && n.location?.lon);
  if (validNodes.length === 0) return;
  
  const bounds = L.latLngBounds(
    validNodes.map(n => [n.location.lat, n.location.lon])
  );
  
  map.fitBounds(bounds, { padding: [20, 20] });
}

/**
 * Invalidate map size (call after container resize)
 */
export function invalidateSize() {
  if (map) {
    map.invalidateSize();
  }
}

// Export module API
export default {
  initMap,
  updateNodes,
  setFilters,
  getFilters,
  resetView,
  fitToNodes,
  invalidateSize
};
