/**
 * PR-CYBR Meshtastic BBS Dashboard Application
 * Main JavaScript logic for the dashboard
 */

// Debug log store
const debugLogs = [];
let lastRefreshTime = null;
let autoRefreshTimer = null;

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
      <div class="workflow-card">
        <div class="workflow-card-header">
          <span class="workflow-name">${workflow.name}</span>
          <span class="workflow-status workflow-status--${statusClass}">${statusText}</span>
        </div>
        <p class="workflow-description">${workflow.description}</p>
        <p class="workflow-timestamp">Last run: ${formatRelativeTime(status.updated_at)}</p>
        <div class="workflow-actions">
          <a href="${workflowUrl}" target="_blank" rel="noopener" class="btn btn--primary">
            View in GitHub Actions
          </a>
          <button class="btn btn--secondary" onclick="copyToClipboard('${ghCommand}')">
            Copy gh command
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
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
    const imagePath = `${basePath}${CONFIG.qrAssets.basePath}/${qrConfig.file}`;
    
    html += `
      <div class="qr-card">
        <div class="qr-image" id="qr-image-${num}">
          <img src="${imagePath}" alt="QR Code for ${qrConfig.name}" 
               onerror="this.parentElement.innerHTML='<span class=\\'qr-image-placeholder\\'>QR not available</span>'" />
        </div>
        <div class="qr-channel-name">Channel ${num}: ${qrConfig.name}</div>
        <p class="qr-description">Scan to join ${channel.description}</p>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

/**
 * Render node status section
 */
async function renderNodeStatus() {
  const container = document.getElementById('nodes-grid');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
  
  const data = await fetchJson(CONFIG.jsonSources.nodeStatus);
  
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
    
    html += `
      <div class="node-card">
        <div class="node-header">
          <div>
            <div class="node-name">${escapeHtml(node.name)}</div>
            <div class="node-id">${escapeHtml(node.node_id)}</div>
          </div>
          <span class="workflow-status workflow-status--success">Online</span>
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
  
  if (data) {
    debugLog('info', `Dashboard state generated: ${data.generated_at}`);
  }
  
  // The state data can be used to enhance other sections if needed
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

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
