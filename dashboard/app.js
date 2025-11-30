/**
 * PR-CYBR Meshtastic BBS Dashboard Application
 * Main JavaScript logic for the dashboard
 * 
 * Multi-view dashboard with:
 * - Dashboard (overview, workflows, bulletins, node status)
 * - Messages & BBS (chat-style message browser)
 * - Devices & Channels (device connection, channel import/export)
 * - Device Settings (configuration UI)
 * - Map (Leaflet-based node visualization)
 */

// Debug log store
const debugLogs = [];
let lastRefreshTime = null;
let autoRefreshTimer = null;

// View state
let currentView = 'dashboard';
let mapInitialized = false;
let leafletMap = null;
let markersLayer = null;

// Data cache
let cachedNodesData = null;
let cachedDashboardState = null;
let cachedMessagesData = {};

// Device connection state
let deviceConnected = false;
let deviceName = null;

/**
 * Get the base path for the application
 * Handles both local development and GitHub Pages deployment
 */
function getBasePath() {
  const path = window.location.pathname;
  // If we're on GitHub Pages, the path includes the repo name
  if (path.includes('/PR-CYBR-M3SH-BBS/')) {
    return path.substring(0, path.indexOf('/PR-CYBR-M3SH-BBS/') + '/PR-CYBR-M3SH-BBS/'.length);
  }
  // For local development or root deployment
  return '/';
}

/**
 * Log a debug message
 */
function debugLog(level, message) {
  const timestamp = new Date().toISOString();
  debugLogs.push({ timestamp, level, message });
  // Keep only last 100 entries
  if (debugLogs.length > 100) {
    debugLogs.shift();
  }
  renderDebugPanel();
  console.log(`[${level.toUpperCase()}] ${message}`);
}

/**
 * Fetch JSON from a relative path with error handling
 * @param {string} relativePath - Path relative to the repository root
 * @returns {Promise<Object|null>} - Parsed JSON or null on error
 */
async function fetchJson(relativePath) {
  try {
    const basePath = getBasePath();
    // Remove leading slash from relativePath if present
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const url = `${basePath}${cleanPath}`;
    
    debugLog('info', `Fetching: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        debugLog('warn', `File not found: ${relativePath}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog('info', `Successfully loaded: ${relativePath}`);
    return data;
  } catch (error) {
    debugLog('error', `Failed to fetch ${relativePath}: ${error.message}`);
    return null;
  }
}

/**
 * Fetch workflow status from GitHub Actions API
 * @param {string} workflowFile - Workflow filename (e.g., 'ci.yml')
 * @returns {Promise<Object|null>} - Workflow status object
 */
async function fetchWorkflowStatus(workflowFile) {
  try {
    const url = `${CONFIG.githubApiBase}/repos/${CONFIG.owner}/${CONFIG.repo}/actions/workflows/${workflowFile}/runs?per_page=1`;
    
    debugLog('info', `Fetching workflow status: ${workflowFile}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        debugLog('warn', `Workflow not found: ${workflowFile}`);
        return { status: 'unknown', conclusion: null, updated_at: null };
      }
      if (response.status === 403) {
        debugLog('warn', `Rate limited or forbidden: ${workflowFile}`);
        return { status: 'unknown', conclusion: null, updated_at: null, error: 'rate_limited' };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      debugLog('info', `No runs found for: ${workflowFile}`);
      return { status: 'no_runs', conclusion: null, updated_at: null };
    }
    
    const latestRun = data.workflow_runs[0];
    return {
      status: latestRun.status,
      conclusion: latestRun.conclusion,
      updated_at: latestRun.updated_at,
      run_id: latestRun.id,
      html_url: latestRun.html_url
    };
  } catch (error) {
    debugLog('error', `Failed to fetch workflow ${workflowFile}: ${error.message}`);
    return { status: 'unknown', conclusion: null, updated_at: null, error: error.message };
  }
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(isoString) {
  if (!isoString) return 'Never';
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Get status display class
 */
function getStatusClass(status, conclusion) {
  if (status === 'completed') {
    return conclusion === 'success' ? 'success' : 
           conclusion === 'failure' ? 'failure' : 
           conclusion === 'cancelled' ? 'pending' : 'unknown';
  }
  if (status === 'in_progress' || status === 'queued') {
    return 'in_progress';
  }
  return 'unknown';
}

/**
 * Get status display text
 */
function getStatusText(status, conclusion) {
  if (status === 'completed') {
    return conclusion || 'completed';
  }
  if (status === 'no_runs') {
    return 'No runs';
  }
  return status || 'Unknown';
}

/**
 * Copy text to clipboard and show toast
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  } catch (error) {
    debugLog('error', `Copy failed: ${error.message}`);
    showToast('Failed to copy');
  }
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

/**
 * Render workflow status cards
 */
async function renderWorkflowCards() {
  const container = document.getElementById('workflow-grid');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
  
  const workflowKeys = Object.keys(CONFIG.workflows);
  const statusPromises = workflowKeys.map(key => 
    fetchWorkflowStatus(CONFIG.workflows[key].file)
  );
  
  const statuses = await Promise.all(statusPromises);
  
  let html = '';
  let overallStatus = 'ok';
  
  workflowKeys.forEach((key, index) => {
    const workflow = CONFIG.workflows[key];
    const status = statuses[index];
    const statusClass = getStatusClass(status.status, status.conclusion);
    const statusText = getStatusText(status.status, status.conclusion);
    
    if (statusClass === 'failure') overallStatus = 'error';
    else if (statusClass === 'in_progress' && overallStatus !== 'error') overallStatus = 'degraded';
    
    const ghCommand = `gh workflow run ${workflow.file}`;
    const workflowUrl = `https://github.com/${CONFIG.owner}/${CONFIG.repo}/actions/workflows/${workflow.file}`;
    
    html += `
      <div class="workflow-card" data-workflow-key="${escapeHtml(key)}">
        <div class="workflow-card-header">
          <span class="workflow-name">${escapeHtml(workflow.name)}</span>
          <span class="workflow-status workflow-status--${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        <p class="workflow-description">${escapeHtml(workflow.description)}</p>
        <p class="workflow-timestamp">Last run: ${formatRelativeTime(status.updated_at)}</p>
        <div class="workflow-actions">
          <a href="${escapeHtml(workflowUrl)}" target="_blank" rel="noopener" class="btn btn--primary">
            View in GitHub Actions
          </a>
          <button class="btn btn--secondary copy-gh-cmd" data-command="${escapeHtml(ghCommand)}">
            Copy gh command
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Attach event listeners for copy buttons
  container.querySelectorAll('.copy-gh-cmd').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.command;
      copyToClipboard(command);
    });
  });
  
  // Update overall status pill
  updateOverallStatus(overallStatus);
}

/**
 * Update the overall status pill in the header
 */
function updateOverallStatus(status) {
  const pill = document.getElementById('overall-status');
  if (!pill) return;
  
  pill.className = `status-pill status-pill--${status}`;
  const texts = {
    ok: 'OK',
    degraded: 'In Progress',
    error: 'Issues Detected',
    unknown: 'Unknown'
  };
  pill.innerHTML = `<span class="status-dot"></span>${texts[status] || 'Unknown'}`;
}

/**
 * Render public bulletins section
 */
async function renderPublicBulletins() {
  const container = document.getElementById('bulletins-container');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
  
  const data = await fetchJson(CONFIG.jsonSources.publicBulletins);
  
  if (!data || !data.bulletins || data.bulletins.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p class="empty-state-text">No bulletins available yet</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table class="bulletins-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Category</th>
          <th>Priority</th>
          <th>Valid Until</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  data.bulletins.forEach(bulletin => {
    const priorityClass = bulletin.priority || 'normal';
    html += `
      <tr>
        <td>${escapeHtml(bulletin.title)}</td>
        <td>${escapeHtml(bulletin.category)}</td>
        <td><span class="priority-badge priority-badge--${priorityClass}">${priorityClass}</span></td>
        <td>${formatTimestamp(bulletin.valid_until)}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

/**
 * Render private channels section with tabs
 */
async function renderPrivateChannels() {
  const tabsContainer = document.getElementById('channel-tabs');
  const contentsContainer = document.getElementById('channel-contents');
  if (!tabsContainer || !contentsContainer) return;
  
  // Create tabs
  let tabsHtml = '';
  Object.keys(CONFIG.channels).forEach((num, index) => {
    const channel = CONFIG.channels[num];
    const activeClass = index === 0 ? 'active' : '';
    tabsHtml += `
      <button class="channel-tab ${activeClass}" data-channel="${num}">
        Ch${num}: ${channel.name}
      </button>
    `;
  });
  tabsContainer.innerHTML = tabsHtml;
  
  // Add tab click handlers
  tabsContainer.querySelectorAll('.channel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.channel-tab').forEach(t => t.classList.remove('active'));
      contentsContainer.querySelectorAll('.channel-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const channelNum = tab.dataset.channel;
      document.getElementById(`channel-${channelNum}-content`)?.classList.add('active');
    });
  });
  
  // Create content containers and load data
  let contentsHtml = '';
  Object.keys(CONFIG.channels).forEach((num, index) => {
    const activeClass = index === 0 ? 'active' : '';
    contentsHtml += `
      <div id="channel-${num}-content" class="channel-content ${activeClass}">
        <div class="loading"><div class="loading-spinner"></div></div>
      </div>
    `;
  });
  contentsContainer.innerHTML = contentsHtml;
  
  // Load channel data in parallel
  const loadPromises = Object.keys(CONFIG.channels).map(async num => {
    const container = document.getElementById(`channel-${num}-content`);
    const data = await fetchJson(CONFIG.jsonSources.privateChannel(num));
    
    if (!data || !data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p class="empty-state-text">No data available for ${CONFIG.channels[num].name}</p>
        </div>
      `;
      return;
    }
    
    let html = '<ul class="channel-items">';
    data.items.forEach(item => {
      const tagsHtml = (item.tags || []).map(tag => 
        `<span class="tag">${escapeHtml(tag)}</span>`
      ).join('');
      
      // Truncate body to 200 chars
      const bodySnippet = (item.body || '').substring(0, 200) + ((item.body || '').length > 200 ? '...' : '');
      
      html += `
        <li class="channel-item">
          <div class="channel-item-header">
            <span class="channel-item-title">${escapeHtml(item.title)}</span>
            <span class="channel-item-category">${escapeHtml(item.category)}</span>
          </div>
          <p class="channel-item-body">${escapeHtml(bodySnippet)}</p>
          <div class="channel-item-meta">
            <span>Updated: ${formatRelativeTime(item.valid_from)}</span>
            ${tagsHtml ? `<div class="channel-item-tags">${tagsHtml}</div>` : ''}
          </div>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
  });
  
  await Promise.all(loadPromises);
}

/**
 * Render QR codes section
 */
async function renderQrCodes() {
  const container = document.getElementById('qr-grid');
  if (!container) return;
  
  const basePath = getBasePath();
  let html = '';
  
  Object.keys(CONFIG.qrAssets.channels).forEach(num => {
    const qrConfig = CONFIG.qrAssets.channels[num];
    const channel = CONFIG.channels[num];
    const imagePath = `${basePath}${CONFIG.qrAssets.basePath}/${escapeHtml(qrConfig.file)}`;
    
    html += `
      <div class="qr-card">
        <div class="qr-image" id="qr-image-${escapeHtml(num)}">
          <img src="${imagePath}" alt="QR Code for ${escapeHtml(qrConfig.name)}" data-channel="${escapeHtml(num)}" />
        </div>
        <div class="qr-channel-name">Channel ${escapeHtml(num)}: ${escapeHtml(qrConfig.name)}</div>
        <p class="qr-description">Scan to join ${escapeHtml(channel.description)}</p>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Attach error handlers for QR images using event delegation
  container.querySelectorAll('.qr-image img').forEach(img => {
    img.addEventListener('error', function() {
      const placeholder = document.createElement('span');
      placeholder.className = 'qr-image-placeholder';
      placeholder.textContent = 'QR not available';
      this.parentElement.replaceChild(placeholder, this);
    });
  });
}

/**
 * Render node status section
 */
async function renderNodeStatus() {
  const container = document.getElementById('nodes-grid');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
  
  const data = await fetchJson(CONFIG.jsonSources.nodeStatus);
  cachedNodesData = data;
  
  if (!data || !data.nodes || data.nodes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <p class="empty-state-text">No node status data available</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  data.nodes.forEach(node => {
    const battery = node.battery || 0;
    const batteryPct = Math.round(battery * 100);
    const batteryClass = batteryPct > 60 ? 'good' : batteryPct > 30 ? 'warning' : 'low';
    
    const tagsHtml = (node.tags || []).map(tag => 
      `<span class="tag">${escapeHtml(tag)}</span>`
    ).join('');
    
    const locationStr = node.location 
      ? `${node.location.lat?.toFixed(4)}, ${node.location.lon?.toFixed(4)}` 
      : 'Unknown';
    
    // Calculate freshness status
    const ageHours = getAgeHours(node.last_seen);
    const freshnessClass = getFreshnessClassFromHours(ageHours, 24, 168);
    const freshnessLabel = getFreshnessLabel(freshnessClass);
    
    html += `
      <div class="node-card" data-node-id="${escapeHtml(node.node_id)}">
        <div class="node-header">
          <div>
            <div class="node-name">${escapeHtml(node.name)}</div>
            <div class="node-id">${escapeHtml(node.node_id)}</div>
          </div>
          <span class="freshness-badge freshness-badge--${freshnessClass}">${freshnessLabel}</span>
        </div>
        <div class="node-stats">
          <div class="node-stat">
            <span class="node-stat-label">Battery</span>
            <div class="battery-indicator">
              <div class="battery-bar">
                <div class="battery-fill battery-fill--${batteryClass}" style="width: ${batteryPct}%"></div>
              </div>
              <span class="node-stat-value">${batteryPct}%</span>
            </div>
          </div>
          <div class="node-stat">
            <span class="node-stat-label">Last Seen</span>
            <span class="node-stat-value">${formatRelativeTime(node.last_seen)}</span>
          </div>
          <div class="node-stat">
            <span class="node-stat-label">RSSI / SNR</span>
            <span class="node-stat-value">${node.rssi || '–'} / ${node.snr || '–'}</span>
          </div>
          <div class="node-stat">
            <span class="node-stat-label">Location</span>
            <span class="node-stat-value">${locationStr}</span>
          </div>
        </div>
        ${tagsHtml ? `<div class="node-tags">${tagsHtml}</div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

/**
 * Render dashboard state summary (if available)
 */
async function renderDashboardState() {
  const data = await fetchJson(CONFIG.jsonSources.dashboardState);
  cachedDashboardState = data;
  
  if (data) {
    debugLog('info', `Dashboard state generated: ${data.generated_at}`);
  }
  
  // Render System Health card
  renderHealthCard();
}

/**
 * Render System Health card
 */
function renderHealthCard() {
  const container = document.getElementById('health-card-container');
  if (!container) return;
  
  const healthStatus = buildHealthStatus(cachedDashboardState, cachedNodesData);
  
  container.innerHTML = renderHealthCardHtml(healthStatus);
}

/**
 * Build health status from cached data
 */
function buildHealthStatus(state, nodesData) {
  const items = [];
  let overallStatus = 'healthy';
  
  // Analyze nodes freshness
  const nodesFreshness = analyzeNodesFreshness(nodesData);
  const telemetryClass = nodesFreshness.newestUpdate 
    ? getFreshnessClassFromHours(getAgeHours(nodesFreshness.newestUpdate), 24, 168)
    : 'unknown';
  
  items.push({
    name: 'Node Telemetry',
    status: telemetryClass,
    label: getFreshnessLabel(telemetryClass),
    age: formatAge(getAgeHours(nodesFreshness.newestUpdate)),
    detail: `${nodesFreshness.fresh}/${nodesFreshness.total} nodes online`
  });
  
  if (telemetryClass === 'stale') overallStatus = 'warning';
  if (telemetryClass === 'offline') overallStatus = 'critical';
  
  // Bulletins freshness
  const bulletinsTimestamp = state?.mesh_public?.generated_at || state?.mesh_public?.last_run;
  const bulletinsClass = getFreshnessClassFromHours(getAgeHours(bulletinsTimestamp), 24, 168);
  
  items.push({
    name: 'Public Bulletins',
    status: bulletinsClass,
    label: getFreshnessLabel(bulletinsClass),
    age: formatAge(getAgeHours(bulletinsTimestamp)),
    detail: `${state?.mesh_public?.bulletin_count || 0} bulletins`
  });
  
  if (bulletinsClass === 'stale' && overallStatus === 'healthy') overallStatus = 'warning';
  if (bulletinsClass === 'offline') overallStatus = 'critical';
  
  // Private channels
  const privateTimestamp = state?.cybr_private?.last_run;
  const privateClass = getFreshnessClassFromHours(getAgeHours(privateTimestamp), 24, 168);
  const channelCounts = state?.cybr_private?.channel_counts || {};
  const totalItems = Object.values(channelCounts).reduce((sum, count) => sum + count, 0);
  
  items.push({
    name: 'Private Channels',
    status: privateClass,
    label: getFreshnessLabel(privateClass),
    age: formatAge(getAgeHours(privateTimestamp)),
    detail: `${totalItems} items across 6 channels`
  });
  
  // QR Codes
  const qrClass = getFreshnessClassFromHours(getAgeHours(state?.generated_at), 720, 2160);
  items.push({
    name: 'QR Codes',
    status: qrClass,
    label: getFreshnessLabel(qrClass),
    age: formatAge(getAgeHours(state?.generated_at)),
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
  
  return { status: overallStatus, items };
}

/**
 * Analyze node freshness
 */
function analyzeNodesFreshness(nodesData) {
  if (!nodesData?.nodes || !Array.isArray(nodesData.nodes)) {
    return { total: 0, fresh: 0, stale: 0, offline: 0, newestUpdate: null };
  }
  
  let fresh = 0, stale = 0, offline = 0;
  let newestUpdate = null;
  
  nodesData.nodes.forEach(node => {
    const ageHours = getAgeHours(node.last_seen);
    if (ageHours < 24) fresh++;
    else if (ageHours < 168) stale++;
    else offline++;
    
    if (node.last_seen && (!newestUpdate || node.last_seen > newestUpdate)) {
      newestUpdate = node.last_seen;
    }
  });
  
  return { total: nodesData.nodes.length, fresh, stale, offline, newestUpdate };
}

/**
 * Get age in hours from ISO timestamp
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
 */
function formatAge(hours) {
  if (hours === Infinity) return 'Never';
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 168) return `${Math.floor(hours / 24)}d ago`;
  return `${Math.floor(hours / 168)}w ago`;
}

/**
 * Get freshness class based on age
 */
function getFreshnessClassFromHours(hours, freshThreshold, staleThreshold) {
  if (hours === Infinity) return 'unknown';
  if (hours <= freshThreshold) return 'fresh';
  if (hours <= staleThreshold) return 'stale';
  return 'offline';
}

/**
 * Get freshness label
 */
function getFreshnessLabel(freshnessClass) {
  const labels = { fresh: 'Fresh', stale: 'Stale', offline: 'Offline', unknown: 'Unknown' };
  return labels[freshnessClass] || 'Unknown';
}

/**
 * Render health card HTML
 */
function renderHealthCardHtml(health) {
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
  
  const statusEmoji = { healthy: '✅', warning: '⚠️', critical: '🔴', unknown: '❓' };
  
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
                <span class="freshness-badge freshness-badge--${item.status}">${item.label}</span>
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
 * Render the debug panel
 */
function renderDebugPanel() {
  const logContainer = document.getElementById('debug-log');
  if (!logContainer) return;
  
  const html = debugLogs.map(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    return `
      <li class="debug-log-entry debug-level--${entry.level}">
        <span class="debug-timestamp">${time}</span>
        ${escapeHtml(entry.message)}
      </li>
    `;
  }).reverse().join('');
  
  logContainer.innerHTML = html;
}

/**
 * Initialize the debug panel toggle
 */
function initDebugPanel() {
  const panel = document.getElementById('debug-panel');
  const header = panel?.querySelector('.debug-header');
  
  if (header) {
    header.addEventListener('click', () => {
      panel.classList.toggle('expanded');
    });
  }
}

/**
 * Update the last refresh timestamp
 */
function updateLastRefresh() {
  lastRefreshTime = new Date();
  const element = document.getElementById('last-update');
  if (element) {
    element.textContent = `Last updated: ${lastRefreshTime.toLocaleTimeString()}`;
  }
}

/**
 * Escape HTML to prevent XSS
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
 * Main refresh function - loads all data
 */
async function refreshDashboard() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.classList.add('loading');
  }
  
  debugLog('info', 'Starting dashboard refresh...');
  
  try {
    // Run all render functions in parallel
    await Promise.all([
      renderWorkflowCards(),
      renderPublicBulletins(),
      renderPrivateChannels(),
      renderQrCodes(),
      renderNodeStatus(),
      renderDashboardState()
    ]);
    
    updateLastRefresh();
    debugLog('info', 'Dashboard refresh complete');
  } catch (error) {
    debugLog('error', `Dashboard refresh failed: ${error.message}`);
  } finally {
    if (refreshBtn) {
      refreshBtn.classList.remove('loading');
    }
  }
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  autoRefreshTimer = setInterval(refreshDashboard, CONFIG.autoRefreshInterval);
  debugLog('info', `Auto-refresh enabled: every ${CONFIG.autoRefreshInterval / 60000} minutes`);
}

/**
 * Initialize the dashboard
 */
async function init() {
  debugLog('info', 'Initializing PR-CYBR BBS Dashboard...');
  
  // Initialize debug panel toggle
  initDebugPanel();
  
  // Initialize navigation
  initNavigation();
  
  // Initialize devices view
  initDevicesView();
  
  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshDashboard);
  }
  
  // Initial data load
  await refreshDashboard();
  
  // Start auto-refresh
  startAutoRefresh();
  
  debugLog('info', 'Dashboard initialization complete');
}

/**
 * Initialize navigation tabs
 */
function initNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewName = tab.dataset.view;
      switchView(viewName);
    });
  });
  
  // Expose switchView globally for map popup actions
  window.switchView = switchView;
}

/**
 * Switch to a different view
 * @param {string} viewName - Name of view to switch to
 */
function switchView(viewName) {
  currentView = viewName;
  
  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isActive = tab.dataset.view === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  
  // Update views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.toggle('active', view.dataset.view === viewName);
  });
  
  debugLog('info', `Switched to view: ${viewName}`);
  
  // View-specific initialization
  switch (viewName) {
    case 'map':
      initMapView();
      break;
    case 'messages':
      initMessagesView();
      break;
    case 'settings':
      initSettingsView();
      break;
    case 'devices':
      initDevicesView();
      break;
  }
}

/**
 * Initialize Map View
 */
function initMapView() {
  if (mapInitialized) {
    // Just refresh markers
    if (cachedNodesData) {
      updateMapNodes(cachedNodesData.nodes || []);
    }
    return;
  }
  
  const container = document.getElementById('map-container');
  if (!container || typeof L === 'undefined') {
    debugLog('error', 'Leaflet not available or map container missing');
    if (container) {
      container.innerHTML = `
        <div class="map-error">
          <p>⚠️ Map library not loaded</p>
          <p>Please check your internet connection.</p>
        </div>
      `;
    }
    return;
  }
  
  // Initialize Leaflet map centered on Puerto Rico
  leafletMap = L.map('map-container', {
    center: [18.2208, -66.5901],
    zoom: 9,
    zoomControl: true
  });
  
  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(leafletMap);
  
  // Create markers layer
  markersLayer = L.layerGroup().addTo(leafletMap);
  
  // Add legend
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <h4>Node Types</h4>
      <div class="legend-item"><span class="legend-color" style="background: #00d4aa"></span> Gateway</div>
      <div class="legend-item"><span class="legend-color" style="background: #2196f3"></span> Relay</div>
      <div class="legend-item"><span class="legend-color" style="background: #ffc107"></span> Sensor</div>
      <div class="legend-item"><span class="legend-color" style="background: #6b7280"></span> Other</div>
    `;
    return div;
  };
  legend.addTo(leafletMap);
  
  mapInitialized = true;
  
  // Load nodes
  if (cachedNodesData) {
    updateMapNodes(cachedNodesData.nodes || []);
  }
  
  // Set up map controls
  document.getElementById('map-reset-btn')?.addEventListener('click', () => {
    leafletMap.setView([18.2208, -66.5901], 9);
  });
  
  document.getElementById('map-fit-btn')?.addEventListener('click', () => {
    if (cachedNodesData?.nodes) {
      fitMapToNodes(cachedNodesData.nodes);
    }
  });
  
  // Set up filters
  ['gateway', 'relay', 'sensor', 'other'].forEach(role => {
    const checkbox = document.getElementById(`filter-${role}`);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        if (cachedNodesData) {
          updateMapNodes(cachedNodesData.nodes || []);
        }
      });
    }
  });
  
  debugLog('info', 'Map view initialized');
}

/**
 * Update map markers with node data
 */
function updateMapNodes(nodes) {
  if (!markersLayer) return;
  
  markersLayer.clearLayers();
  
  const roleColors = {
    gateway: '#00d4aa',
    relay: '#2196f3',
    sensor: '#ffc107',
    mobile: '#9c27b0',
    other: '#6b7280'
  };
  
  nodes.forEach(node => {
    if (!node.location?.lat || !node.location?.lon) return;
    
    // Get node role
    const tags = node.tags || [];
    let role = 'other';
    if (tags.includes('gateway')) role = 'gateway';
    else if (tags.includes('relay')) role = 'relay';
    else if (tags.includes('sensor')) role = 'sensor';
    else if (tags.includes('mobile')) role = 'mobile';
    
    // Check filter
    const checkbox = document.getElementById(`filter-${role === 'mobile' ? 'other' : role}`);
    if (checkbox && !checkbox.checked) return;
    
    const color = roleColors[role] || roleColors.other;
    const ageHours = getAgeHours(node.last_seen);
    const freshnessClass = getFreshnessClassFromHours(ageHours, 24, 168);
    const opacity = freshnessClass === 'offline' ? 0.4 : 1;
    
    // Create custom icon
    const svgIcon = L.divIcon({
      html: `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="${color}" opacity="${opacity}"/>
        <circle cx="12" cy="10" r="5" fill="white"/>
      </svg>`,
      className: 'node-marker',
      iconSize: [24, 32],
      iconAnchor: [12, 32],
      popupAnchor: [0, -32]
    });
    
    const battery = node.battery ? Math.round(node.battery * 100) : 0;
    const location = `${node.location.lat.toFixed(4)}, ${node.location.lon.toFixed(4)}`;
    
    const popupContent = `
      <div class="map-popup">
        <div class="map-popup-header">
          <strong>${escapeHtml(node.name)}</strong>
          <span class="freshness-badge freshness-badge--${freshnessClass}">${getFreshnessLabel(freshnessClass)}</span>
        </div>
        <table class="map-popup-table">
          <tr><td>Node ID:</td><td><code>${escapeHtml(node.node_id)}</code></td></tr>
          <tr><td>Role:</td><td>${escapeHtml(role)}</td></tr>
          <tr><td>Last Seen:</td><td>${formatRelativeTime(node.last_seen)}</td></tr>
          <tr><td>Battery:</td><td>${battery}%</td></tr>
          <tr><td>RSSI/SNR:</td><td>${node.rssi || '–'} / ${node.snr || '–'}</td></tr>
          <tr><td>Location:</td><td>${location}</td></tr>
        </table>
        <div class="map-popup-actions">
          <button class="btn btn--small btn--secondary map-copy-id" data-node-id="${escapeHtml(node.node_id)}">📋 Copy ID</button>
          <button class="btn btn--small btn--secondary map-goto-dashboard">📍 Dashboard</button>
        </div>
      </div>
    `;
    
    const marker = L.marker([node.location.lat, node.location.lon], { icon: svgIcon })
      .bindPopup(popupContent);
    
    // Attach event listeners after popup opens (event delegation pattern)
    marker.on('popupopen', function() {
      const popup = marker.getPopup().getElement();
      if (popup) {
        const copyBtn = popup.querySelector('.map-copy-id');
        if (copyBtn) {
          copyBtn.addEventListener('click', function() {
            copyToClipboard(this.dataset.nodeId);
          });
        }
        const dashboardBtn = popup.querySelector('.map-goto-dashboard');
        if (dashboardBtn) {
          dashboardBtn.addEventListener('click', function() {
            switchView('dashboard');
            const section = document.getElementById('node-status-section');
            if (section) {
              section.scrollIntoView({ behavior: 'smooth' });
            }
          });
        }
      }
    });
    
    markersLayer.addLayer(marker);
  });
}

/**
 * Fit map bounds to show all nodes
 */
function fitMapToNodes(nodes) {
  if (!leafletMap) return;
  
  const validNodes = nodes.filter(n => n.location?.lat && n.location?.lon);
  if (validNodes.length === 0) return;
  
  const bounds = L.latLngBounds(
    validNodes.map(n => [n.location.lat, n.location.lon])
  );
  
  leafletMap.fitBounds(bounds, { padding: [20, 20] });
}

/**
 * Initialize Messages View
 */
async function initMessagesView() {
  const container = document.getElementById('messages-view-container');
  if (!container) return;
  
  // Load all channel data
  await loadMessagesData();
  
  renderMessagesView(container);
}

/**
 * Load messages data from all channels
 */
async function loadMessagesData() {
  // Load public bulletins
  const publicData = await fetchJson(CONFIG.jsonSources.publicBulletins);
  cachedMessagesData.public = publicData;
  
  // Load private channels
  for (let i = 1; i <= 6; i++) {
    const channelData = await fetchJson(CONFIG.jsonSources.privateChannel(i));
    cachedMessagesData[`channel-${i}`] = channelData;
  }
}

/**
 * Render messages view
 */
function renderMessagesView(container) {
  // Build combined messages list
  const allMessages = [];
  
  // Add public bulletins
  if (cachedMessagesData.public?.bulletins) {
    cachedMessagesData.public.bulletins.forEach(msg => {
      allMessages.push({ ...msg, channel: 'public', channelNum: 0 });
    });
  }
  
  // Add private channel messages
  for (let i = 1; i <= 6; i++) {
    const channelData = cachedMessagesData[`channel-${i}`];
    if (channelData?.items) {
      channelData.items.forEach(msg => {
        allMessages.push({ ...msg, channel: CONFIG.channels[i]?.name.toLowerCase().replace(/\s+/g, '-') || `channel-${i}`, channelNum: i });
      });
    }
  }
  
  // Sort by timestamp
  allMessages.sort((a, b) => {
    const dateA = new Date(a.valid_from || 0);
    const dateB = new Date(b.valid_from || 0);
    return dateB - dateA;
  });
  
  // Render sidebar
  const channels = [
    { key: 'all', name: 'All Channels', icon: '📻', count: allMessages.length },
    { key: 'public', name: 'Public BBS', icon: '📢', count: cachedMessagesData.public?.bulletins?.length || 0 },
    ...Object.entries(CONFIG.channels).map(([num, ch]) => ({
      key: `channel-${num}`,
      name: ch.name,
      icon: '📋',
      count: cachedMessagesData[`channel-${num}`]?.items?.length || 0
    }))
  ];
  
  container.innerHTML = `
    <div class="messages-view">
      <div class="messages-sidebar">
        <div class="sidebar-header"><h3>Channels</h3></div>
        <ul class="channel-list">
          ${channels.map(ch => `
            <li class="channel-list-item ${ch.key === 'all' ? 'active' : ''}" data-channel="${escapeHtml(ch.key)}">
              <span class="channel-icon">${ch.icon}</span>
              <span class="channel-name">${escapeHtml(ch.name)}</span>
              <span class="channel-count">${ch.count}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="messages-main">
        <div class="messages-filters">
          <div class="filter-group">
            <input type="text" id="messages-search" class="filter-input" placeholder="🔍 Search messages...">
          </div>
          <div class="filter-group">
            <label for="filter-priority">Priority:</label>
            <select id="filter-priority" class="filter-select">
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div class="messages-list" id="messages-list">
          ${renderMessagesList(allMessages)}
        </div>
      </div>
      <div class="compose-panel">
        <div class="compose-header"><h3>📝 Compose Message</h3></div>
        <div class="compose-form">
          <div class="form-group">
            <label for="compose-channel">Channel:</label>
            <select id="compose-channel" class="form-select">
              ${Object.entries(CONFIG.channels).map(([num, ch]) => `
                <option value="${num}">${escapeHtml(ch.name)}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="compose-priority">Priority:</label>
            <select id="compose-priority" class="form-select">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div class="form-group">
            <label for="compose-title">Title:</label>
            <input type="text" id="compose-title" class="form-input" placeholder="Message title">
          </div>
          <div class="form-group">
            <label for="compose-body">Body:</label>
            <textarea id="compose-body" class="form-textarea" rows="4" placeholder="Message content..."></textarea>
          </div>
          <div class="compose-actions">
            <button id="copy-json-btn" class="btn btn--primary">📋 Copy as JSON</button>
          </div>
        </div>
        <div class="compose-note">
          <p>📌 Messages are exported as JSON for gateway transmission.</p>
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  attachMessagesEventListeners(container, allMessages);
}

/**
 * Render messages list HTML
 */
function renderMessagesList(messages, filter = {}) {
  let filtered = messages;
  
  if (filter.channel && filter.channel !== 'all') {
    if (filter.channel === 'public') {
      filtered = filtered.filter(m => m.channelNum === 0);
    } else if (filter.channel.startsWith('channel-')) {
      const num = parseInt(filter.channel.replace('channel-', ''));
      filtered = filtered.filter(m => m.channelNum === num);
    }
  }
  
  if (filter.priority && filter.priority !== 'all') {
    filtered = filtered.filter(m => m.priority === filter.priority);
  }
  
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    filtered = filtered.filter(m => 
      m.title?.toLowerCase().includes(searchLower) ||
      m.body?.toLowerCase().includes(searchLower)
    );
  }
  
  if (filtered.length === 0) {
    return `
      <div class="messages-empty">
        <div class="empty-state-icon">📭</div>
        <p>No messages found</p>
      </div>
    `;
  }
  
  return filtered.map(msg => {
    const priorityClass = msg.priority || 'normal';
    const ageHours = getAgeHours(msg.valid_from);
    const isStale = ageHours > 720; // 30 days
    
    return `
      <div class="message-card ${isStale ? 'message-stale' : ''}" data-message-id="${escapeHtml(msg.id)}">
        <div class="message-header">
          <span class="message-channel">Ch${msg.channelNum}</span>
          <span class="priority-badge priority-badge--${priorityClass}">${priorityClass}</span>
          ${isStale ? '<span class="stale-badge" title="Content may be outdated">⚠️</span>' : ''}
        </div>
        <div class="message-title">${escapeHtml(msg.title)}</div>
        <div class="message-body">${escapeHtml(msg.body?.substring(0, 200))}${msg.body?.length > 200 ? '...' : ''}</div>
        <div class="message-meta">
          <span class="message-category">${escapeHtml(msg.category)}</span>
          <span class="message-time">${formatRelativeTime(msg.valid_from)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Attach messages view event listeners
 */
function attachMessagesEventListeners(container, allMessages) {
  let currentFilter = { channel: 'all', priority: 'all', search: '' };
  
  // Channel selection
  container.querySelectorAll('.channel-list-item').forEach(item => {
    item.addEventListener('click', function() {
      container.querySelectorAll('.channel-list-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      currentFilter.channel = this.dataset.channel;
      document.getElementById('messages-list').innerHTML = renderMessagesList(allMessages, currentFilter);
    });
  });
  
  // Search
  const searchInput = container.querySelector('#messages-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilter.search = this.value;
        document.getElementById('messages-list').innerHTML = renderMessagesList(allMessages, currentFilter);
      }, 300);
    });
  }
  
  // Priority filter
  const prioritySelect = container.querySelector('#filter-priority');
  if (prioritySelect) {
    prioritySelect.addEventListener('change', function() {
      currentFilter.priority = this.value;
      document.getElementById('messages-list').innerHTML = renderMessagesList(allMessages, currentFilter);
    });
  }
  
  // Copy as JSON
  const copyJsonBtn = container.querySelector('#copy-json-btn');
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', function() {
      const message = {
        id: `msg-${Date.now()}`,
        channel: container.querySelector('#compose-channel')?.value || '1',
        priority: container.querySelector('#compose-priority')?.value || 'normal',
        category: 'USER',
        title: container.querySelector('#compose-title')?.value || '',
        body: container.querySelector('#compose-body')?.value || '',
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      copyToClipboard(JSON.stringify(message, null, 2));
    });
  }
}

/**
 * Initialize Settings View
 */
function initSettingsView() {
  const container = document.getElementById('device-settings-container');
  if (!container) return;
  
  // Load saved profile from localStorage
  let currentProfile = loadProfileFromStorage() || getDefaultProfile();
  
  container.innerHTML = renderSettingsView(currentProfile);
  attachSettingsEventListeners(container, currentProfile);
}

/**
 * Get default device profile
 */
function getDefaultProfile() {
  return {
    id: 'local-default',
    name: 'Local Node',
    description: 'PR-CYBR Mesh Node',
    role: 'relay',
    radio: { region: 'US', modemPreset: 'LongFast', txPower: 30, hopLimit: 3 },
    bbs: { defaultChannel: 0, messageRetention: 100, priorityDefault: 'normal' },
    power: { isRouter: false, sleepEnabled: true, sleepInterval: 3600, gpsEnabled: true, positionInterval: 900, telemetryInterval: 1800 }
  };
}

/**
 * Load profile from localStorage
 */
function loadProfileFromStorage() {
  try {
    const saved = localStorage.getItem('pr-cybr-current-profile');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

/**
 * Save profile to localStorage
 */
function saveProfileToStorage(profile) {
  try {
    localStorage.setItem('pr-cybr-current-profile', JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save profile:', e);
  }
}

/**
 * Render settings view
 */
function renderSettingsView(profile) {
  const regions = [
    { value: 'US', label: 'United States (902-928 MHz)' },
    { value: 'EU_868', label: 'Europe (868 MHz)' },
    { value: 'ANZ', label: 'Australia/NZ (915-928 MHz)' }
  ];
  
  const modemPresets = [
    { value: 'LongFast', label: 'Long Fast (250kbps)' },
    { value: 'LongSlow', label: 'Long Slow (max range)' },
    { value: 'ShortFast', label: 'Short Fast (local)' },
    { value: 'MediumSlow', label: 'Medium Slow' }
  ];
  
  const roles = [
    { value: 'client', label: 'Client' },
    { value: 'router', label: 'Router' },
    { value: 'gateway', label: 'Gateway' },
    { value: 'sensor', label: 'Sensor' }
  ];
  
  return `
    <div class="device-settings-view">
      <div class="settings-header">
        <h2>⚙️ Device Settings</h2>
        <p>Configure your Meshtastic device settings. Changes are saved locally.</p>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-header"><h3>📛 Device Identity</h3></div>
        <div class="settings-section-content">
          <div class="settings-grid">
            <div class="form-group">
              <label for="device-name">Device Name</label>
              <input type="text" id="device-name" class="form-input" value="${escapeHtml(profile.name)}" maxlength="32">
            </div>
            <div class="form-group">
              <label for="device-description">Description</label>
              <input type="text" id="device-description" class="form-input" value="${escapeHtml(profile.description)}">
            </div>
            <div class="form-group">
              <label for="device-role">Device Role</label>
              <select id="device-role" class="form-select">
                ${roles.map(r => `<option value="${r.value}" ${profile.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-header"><h3>📻 Radio Settings</h3></div>
        <div class="settings-section-content">
          <div class="settings-grid">
            <div class="form-group">
              <label for="radio-region">Region</label>
              <select id="radio-region" class="form-select">
                ${regions.map(r => `<option value="${r.value}" ${profile.radio.region === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="radio-modem">Modem Preset</label>
              <select id="radio-modem" class="form-select">
                ${modemPresets.map(m => `<option value="${m.value}" ${profile.radio.modemPreset === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="radio-txpower">TX Power: <span id="txpower-value">${profile.radio.txPower}</span> dBm</label>
              <input type="range" id="radio-txpower" class="form-range" min="1" max="30" value="${profile.radio.txPower}">
            </div>
            <div class="form-group">
              <label for="radio-hoplimit">Hop Limit</label>
              <input type="number" id="radio-hoplimit" class="form-input" min="1" max="7" value="${profile.radio.hopLimit}">
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-header"><h3>⚡ Power Settings</h3></div>
        <div class="settings-section-content">
          <div class="settings-grid">
            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" id="power-router" ${profile.power.isRouter ? 'checked' : ''}>
                <span>Router Mode</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" id="power-gps" ${profile.power.gpsEnabled ? 'checked' : ''}>
                <span>GPS Enabled</span>
              </label>
            </div>
            <div class="form-group">
              <label for="power-posinterval">Position Interval (s)</label>
              <input type="number" id="power-posinterval" class="form-input" min="60" max="86400" value="${profile.power.positionInterval}">
            </div>
          </div>
        </div>
      </div>
      
      <div class="settings-section">
        <div class="settings-section-header"><h3>💾 Profile Management</h3></div>
        <div class="settings-section-content">
          <div class="profile-actions">
            <button id="save-profile-btn" class="btn btn--primary">💾 Save Settings</button>
            <button id="export-profile-btn" class="btn btn--secondary">📤 Export as JSON</button>
            <label class="btn btn--secondary">
              📥 Import JSON
              <input type="file" id="import-profile-input" accept=".json" hidden>
            </label>
            <button id="reset-profile-btn" class="btn btn--secondary">🔄 Reset to Defaults</button>
          </div>
          <div class="device-sync">
            <h4>Device Sync</h4>
            <p class="sync-status">⚠️ No device connected</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach settings event listeners
 */
function attachSettingsEventListeners(container, profile) {
  // TX Power slider
  const txPowerSlider = container.querySelector('#radio-txpower');
  const txPowerValue = container.querySelector('#txpower-value');
  if (txPowerSlider && txPowerValue) {
    txPowerSlider.addEventListener('input', function() {
      txPowerValue.textContent = this.value;
    });
  }
  
  // Save button
  const saveBtn = container.querySelector('#save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const newProfile = collectSettingsValues(container, profile);
      saveProfileToStorage(newProfile);
      showToast('Settings saved!');
    });
  }
  
  // Export button
  const exportBtn = container.querySelector('#export-profile-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      const newProfile = collectSettingsValues(container, profile);
      const json = JSON.stringify(newProfile, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meshtastic-profile-${newProfile.name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Profile exported!');
    });
  }
  
  // Import input
  const importInput = container.querySelector('#import-profile-input');
  if (importInput) {
    importInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.name && imported.radio) {
            saveProfileToStorage(imported);
            initSettingsView();
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
  
  // Reset button
  const resetBtn = container.querySelector('#reset-profile-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function() {
      if (confirm('Reset all settings to defaults?')) {
        saveProfileToStorage(getDefaultProfile());
        initSettingsView();
        showToast('Settings reset to defaults');
      }
    });
  }
}

/**
 * Collect settings values from form
 */
function collectSettingsValues(container, baseProfile) {
  return {
    ...baseProfile,
    name: container.querySelector('#device-name')?.value || baseProfile.name,
    description: container.querySelector('#device-description')?.value || '',
    role: container.querySelector('#device-role')?.value || 'relay',
    radio: {
      region: container.querySelector('#radio-region')?.value || 'US',
      modemPreset: container.querySelector('#radio-modem')?.value || 'LongFast',
      txPower: parseInt(container.querySelector('#radio-txpower')?.value) || 30,
      hopLimit: parseInt(container.querySelector('#radio-hoplimit')?.value) || 3
    },
    power: {
      isRouter: container.querySelector('#power-router')?.checked || false,
      gpsEnabled: container.querySelector('#power-gps')?.checked || true,
      positionInterval: parseInt(container.querySelector('#power-posinterval')?.value) || 900,
      sleepEnabled: baseProfile.power.sleepEnabled,
      sleepInterval: baseProfile.power.sleepInterval,
      telemetryInterval: baseProfile.power.telemetryInterval
    },
    bbs: baseProfile.bbs,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Initialize Devices View
 */
function initDevicesView() {
  // Check API support
  const serialSupported = 'serial' in navigator;
  const bluetoothSupported = 'bluetooth' in navigator;
  
  const warning = document.getElementById('connection-support-warning');
  if (warning && !serialSupported && !bluetoothSupported) {
    warning.style.display = 'block';
  }
  
  // Render channels table
  renderChannelsTable();
  
  // Set up connection buttons
  const serialBtn = document.getElementById('connect-serial-btn');
  if (serialBtn) {
    serialBtn.disabled = !serialSupported;
    serialBtn.addEventListener('click', connectSerialDevice);
  }
  
  const bluetoothBtn = document.getElementById('connect-bluetooth-btn');
  if (bluetoothBtn) {
    bluetoothBtn.disabled = !bluetoothSupported;
    bluetoothBtn.addEventListener('click', connectBluetoothDevice);
  }
  
  const disconnectBtn = document.getElementById('disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectDevice);
  }
  
  // Set up offline actions
  const downloadBtn = document.getElementById('download-channels-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadChannelsJson);
  }
  
  const uploadInput = document.getElementById('upload-channels-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', uploadChannelsJson);
  }
}

/**
 * Render channels table
 */
function renderChannelsTable() {
  const tbody = document.getElementById('channels-table-body');
  if (!tbody) return;
  
  let html = '';
  Object.entries(CONFIG.channels).forEach(([num, channel]) => {
    html += `
      <tr>
        <td>${num}</td>
        <td><strong>${escapeHtml(channel.name)}</strong></td>
        <td>${escapeHtml(channel.description)}</td>
        <td>ShortFast</td>
        <td><span class="freshness-badge freshness-badge--fresh">Available</span></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

/**
 * Connect via Serial (mock for now)
 */
async function connectSerialDevice() {
  showToast('Connecting via Serial...');
  
  // Mock connection
  await new Promise(resolve => setTimeout(resolve, 500));
  
  deviceConnected = true;
  deviceName = 'Mock Meshtastic Device (Serial)';
  
  updateConnectionUI();
  showToast('Connected to ' + deviceName);
  
  // Enable device buttons
  document.getElementById('import-from-device-btn').disabled = false;
  document.getElementById('export-to-device-btn').disabled = false;
}

/**
 * Connect via Bluetooth (mock for now)
 */
async function connectBluetoothDevice() {
  showToast('Connecting via Bluetooth...');
  
  // Mock connection
  await new Promise(resolve => setTimeout(resolve, 500));
  
  deviceConnected = true;
  deviceName = 'Mock Meshtastic Device (BLE)';
  
  updateConnectionUI();
  showToast('Connected to ' + deviceName);
  
  // Enable device buttons
  document.getElementById('import-from-device-btn').disabled = false;
  document.getElementById('export-to-device-btn').disabled = false;
}

/**
 * Disconnect device
 */
function disconnectDevice() {
  deviceConnected = false;
  deviceName = null;
  
  updateConnectionUI();
  showToast('Disconnected');
  
  // Disable device buttons
  document.getElementById('import-from-device-btn').disabled = true;
  document.getElementById('export-to-device-btn').disabled = true;
}

/**
 * Update connection UI
 */
function updateConnectionUI() {
  const statusDot = document.querySelector('#device-connection-status .status-dot');
  const statusText = document.getElementById('connection-text');
  const connectBtns = document.querySelectorAll('#connect-serial-btn, #connect-bluetooth-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  
  if (deviceConnected) {
    if (statusDot) {
      statusDot.classList.remove('status-dot--disconnected');
      statusDot.classList.add('status-dot--connected');
    }
    if (statusText) statusText.textContent = deviceName;
    connectBtns.forEach(btn => btn.style.display = 'none');
    if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
  } else {
    if (statusDot) {
      statusDot.classList.remove('status-dot--connected');
      statusDot.classList.add('status-dot--disconnected');
    }
    if (statusText) statusText.textContent = 'Not Connected';
    connectBtns.forEach(btn => btn.style.display = 'inline-flex');
    if (disconnectBtn) disconnectBtn.style.display = 'none';
  }
}

/**
 * Download channels as JSON
 */
function downloadChannelsJson() {
  const channels = Object.entries(CONFIG.channels).map(([num, ch]) => ({
    index: parseInt(num),
    name: ch.name,
    description: ch.description,
    role: 'secondary',
    psk: null,
    modemPreset: 'ShortFast'
  }));
  
  const json = JSON.stringify({ channels, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pr-cybr-bbs-channels.json';
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Channels downloaded!');
}

/**
 * Upload channels from JSON
 */
function uploadChannelsJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.channels && Array.isArray(data.channels)) {
        showToast(`Loaded ${data.channels.length} channels from file`);
        // In a real implementation, we would update the in-memory channel config
      } else {
        alert('Invalid channels file format');
      }
    } catch (err) {
      alert('Failed to parse channels file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
