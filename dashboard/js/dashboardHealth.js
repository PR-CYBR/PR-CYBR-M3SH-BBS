/**
 * Dashboard Health Module
 * Provides data freshness indicators and system health monitoring
 * 
 * @module dashboardHealth
 */

/**
 * @typedef {Object} DashboardState
 * @property {string} generated_at - State generation timestamp
 * @property {Object} mesh_public - Public BBS state
 * @property {Object} cybr_private - Private channels state
 * @property {string} [lastTelemetryUpdate] - Last telemetry update
 * @property {string} [lastBulletinsUpdate] - Last bulletins update
 * @property {string} [lastQrUpdate] - Last QR code update
 */

/**
 * @typedef {Object} HealthStatus
 * @property {string} status - Overall status (healthy, warning, critical, unknown)
 * @property {Object[]} items - Individual health items
 */

// Freshness thresholds (in hours)
const THRESHOLDS = {
  telemetry: { fresh: 24, stale: 168 }, // 24h fresh, 7 days stale
  bulletins: { fresh: 24, stale: 168 },
  qrCodes: { fresh: 720, stale: 2160 }, // 30 days fresh, 90 days stale
  nodes: { fresh: 24, stale: 168 }
};

/**
 * Calculate age in hours from ISO timestamp
 * @param {string} isoString - ISO timestamp
 * @returns {number} - Age in hours
 */
function getAgeHours(isoString) {
  if (!isoString) return Infinity;
  try {
    const date = new Date(isoString);
    const now = new Date();
    return (now - date) / (1000 * 60 * 60);
  } catch {
    return Infinity;
  }
}

/**
 * Format age for display
 * @param {number} hours - Age in hours
 * @returns {string}
 */
function formatAge(hours) {
  if (hours === Infinity) return 'Never';
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
  if (hours < 720) return `${Math.floor(hours / 168)}w ago`;
  return `${Math.floor(hours / 720)}mo ago`;
}

/**
 * Get freshness class based on age
 * @param {number} hours - Age in hours
 * @param {Object} thresholds - Threshold values
 * @returns {string} - CSS class
 */
function getFreshnessClass(hours, thresholds) {
  if (hours === Infinity) return 'unknown';
  if (hours <= thresholds.fresh) return 'fresh';
  if (hours <= thresholds.stale) return 'stale';
  return 'offline';
}

/**
 * Get freshness label
 * @param {string} freshnessClass - Freshness class
 * @returns {string}
 */
function getFreshnessLabel(freshnessClass) {
  const labels = {
    fresh: 'Fresh',
    stale: 'Stale',
    offline: 'Offline',
    unknown: 'Unknown'
  };
  return labels[freshnessClass] || 'Unknown';
}

/**
 * Analyze node freshness from nodes data
 * @param {Object} nodesData - Nodes JSON data
 * @returns {Object}
 */
export function analyzeNodesFreshness(nodesData) {
  if (!nodesData?.nodes || !Array.isArray(nodesData.nodes)) {
    return {
      total: 0,
      fresh: 0,
      stale: 0,
      offline: 0,
      oldestUpdate: null,
      newestUpdate: null
    };
  }
  
  let fresh = 0, stale = 0, offline = 0;
  let oldestUpdate = null, newestUpdate = null;
  
  nodesData.nodes.forEach(node => {
    const ageHours = getAgeHours(node.last_seen);
    const freshness = getFreshnessClass(ageHours, THRESHOLDS.nodes);
    
    if (freshness === 'fresh') fresh++;
    else if (freshness === 'stale') stale++;
    else offline++;
    
    if (node.last_seen) {
      if (!oldestUpdate || node.last_seen < oldestUpdate) {
        oldestUpdate = node.last_seen;
      }
      if (!newestUpdate || node.last_seen > newestUpdate) {
        newestUpdate = node.last_seen;
      }
    }
  });
  
  return {
    total: nodesData.nodes.length,
    fresh,
    stale,
    offline,
    oldestUpdate,
    newestUpdate
  };
}

/**
 * Build system health status from dashboard state
 * @param {DashboardState} state - Dashboard state data
 * @param {Object} nodesData - Nodes data
 * @returns {HealthStatus}
 */
export function buildHealthStatus(state, nodesData) {
  const items = [];
  let overallStatus = 'healthy';
  
  // Telemetry freshness
  const nodesFreshness = analyzeNodesFreshness(nodesData);
  const telemetryAge = getAgeHours(nodesFreshness.newestUpdate);
  const telemetryClass = getFreshnessClass(telemetryAge, THRESHOLDS.telemetry);
  
  items.push({
    name: 'Node Telemetry',
    status: telemetryClass,
    label: getFreshnessLabel(telemetryClass),
    age: formatAge(telemetryAge),
    detail: `${nodesFreshness.fresh}/${nodesFreshness.total} nodes online`
  });
  
  if (telemetryClass === 'stale') overallStatus = 'warning';
  if (telemetryClass === 'offline') overallStatus = 'critical';
  
  // Bulletins freshness
  const bulletinsTimestamp = state?.mesh_public?.generated_at || state?.mesh_public?.last_run;
  const bulletinsAge = getAgeHours(bulletinsTimestamp);
  const bulletinsClass = getFreshnessClass(bulletinsAge, THRESHOLDS.bulletins);
  
  items.push({
    name: 'Public Bulletins',
    status: bulletinsClass,
    label: getFreshnessLabel(bulletinsClass),
    age: formatAge(bulletinsAge),
    detail: `${state?.mesh_public?.bulletin_count || 0} bulletins`
  });
  
  if (bulletinsClass === 'stale' && overallStatus === 'healthy') overallStatus = 'warning';
  if (bulletinsClass === 'offline') overallStatus = 'critical';
  
  // Private channels freshness
  const privateTimestamp = state?.cybr_private?.last_run;
  const privateAge = getAgeHours(privateTimestamp);
  const privateClass = getFreshnessClass(privateAge, THRESHOLDS.bulletins);
  
  const channelCounts = state?.cybr_private?.channel_counts || {};
  const totalItems = Object.values(channelCounts).reduce((sum, count) => sum + count, 0);
  
  items.push({
    name: 'Private Channels',
    status: privateClass,
    label: getFreshnessLabel(privateClass),
    age: formatAge(privateAge),
    detail: `${totalItems} items across 6 channels`
  });
  
  // QR Codes (check if manifest exists)
  // For now, assume QR codes are up to date if dashboard state exists
  const qrAge = getAgeHours(state?.generated_at);
  const qrClass = getFreshnessClass(qrAge, THRESHOLDS.qrCodes);
  
  items.push({
    name: 'QR Codes',
    status: qrClass,
    label: getFreshnessLabel(qrClass),
    age: formatAge(qrAge),
    detail: '6 channel QR codes'
  });
  
  // State file status
  if (!state || !state.generated_at) {
    items.push({
      name: 'State File',
      status: 'unknown',
      label: 'Missing',
      age: 'N/A',
      detail: 'Run workflows to generate'
    });
    overallStatus = 'warning';
  }
  
  return {
    status: overallStatus,
    items
  };
}

/**
 * Render the System Health card
 * @param {HealthStatus} health - Health status object
 * @returns {string} - HTML string
 */
export function renderHealthCard(health) {
  if (!health) {
    return `
      <div class="health-card health-card--unknown">
        <div class="health-card-header">
          <h3>📊 System Health</h3>
          <span class="health-badge health-badge--unknown">Loading...</span>
        </div>
        <div class="health-card-content">
          <div class="loading"><div class="loading-spinner"></div></div>
        </div>
      </div>
    `;
  }
  
  const statusEmoji = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🔴',
    unknown: '❓'
  };
  
  return `
    <div class="health-card health-card--${health.status}">
      <div class="health-card-header">
        <h3>📊 System Health</h3>
        <span class="health-badge health-badge--${health.status}">
          ${statusEmoji[health.status]} ${health.status.charAt(0).toUpperCase() + health.status.slice(1)}
        </span>
      </div>
      <div class="health-card-content">
        <ul class="health-items">
          ${health.items.map(item => `
            <li class="health-item">
              <div class="health-item-header">
                <span class="health-item-name">${escapeHtml(item.name)}</span>
                <span class="freshness-badge freshness-badge--${item.status}">
                  ${item.label}
                </span>
              </div>
              <div class="health-item-detail">
                <span class="health-item-age">${escapeHtml(item.age)}</span>
                <span class="health-item-info">${escapeHtml(item.detail)}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

/**
 * Get node freshness badge HTML
 * @param {string} lastSeen - ISO timestamp
 * @returns {string} - HTML string
 */
export function getNodeFreshnessBadge(lastSeen) {
  const ageHours = getAgeHours(lastSeen);
  const freshnessClass = getFreshnessClass(ageHours, THRESHOLDS.nodes);
  const label = getFreshnessLabel(freshnessClass);
  
  return `<span class="freshness-badge freshness-badge--${freshnessClass}">${label}</span>`;
}

/**
 * Get content age warning if stale
 * @param {string} timestamp - ISO timestamp
 * @param {number} thresholdDays - Days threshold for warning
 * @returns {string} - HTML string (empty if not stale)
 */
export function getStaleWarning(timestamp, thresholdDays = 30) {
  const ageHours = getAgeHours(timestamp);
  const ageDays = ageHours / 24;
  
  if (ageDays > thresholdDays) {
    return `<span class="stale-warning" title="Content is ${Math.floor(ageDays)} days old">⚠️</span>`;
  }
  return '';
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

// Export module API
export default {
  analyzeNodesFreshness,
  buildHealthStatus,
  renderHealthCard,
  getNodeFreshnessBadge,
  getStaleWarning
};
