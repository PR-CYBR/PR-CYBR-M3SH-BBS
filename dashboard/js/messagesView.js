/**
 * Messages View Module
 * Provides a chat/BBS-style layout for browsing and composing messages
 * 
 * @module messagesView
 */

/**
 * @typedef {Object} BulletinMessage
 * @property {string} id - Message ID
 * @property {string} category - Message category
 * @property {string} title - Message title
 * @property {string} body - Message body
 * @property {string} valid_from - Start timestamp
 * @property {string} valid_until - End timestamp
 * @property {string} priority - Priority level (high, normal, low)
 * @property {string[]} [tags] - Optional tags
 */

/**
 * @typedef {Object} ChannelData
 * @property {string} channel - Channel name
 * @property {number} channelNum - Channel number
 * @property {BulletinMessage[]} items - Channel messages
 */

// State
let allMessages = [];
let currentChannel = 'all';
let currentFilter = {
  priority: 'all',
  category: 'all',
  search: ''
};
let drafts = {};

// Channel definitions
const CHANNELS = {
  'public': { num: 0, name: 'Public BBS', icon: '📢', color: '#00d4aa' },
  'ops-sitrep': { num: 1, name: 'OPS-SITREP', icon: '📊', color: '#2196f3' },
  's2-intel': { num: 2, name: 'S2-INTEL', icon: '🔍', color: '#ff5722' },
  's3-plans': { num: 3, name: 'S3-PLANS', icon: '📋', color: '#9c27b0' },
  'm3sh-ops': { num: 4, name: 'M3SH-OPS', icon: '📡', color: '#00bcd4' },
  'log-res': { num: 5, name: 'LOG-RES', icon: '📦', color: '#4caf50' },
  'mailbox': { num: 6, name: 'MAILB0X', icon: '📬', color: '#ffc107' }
};

/**
 * Load drafts from localStorage
 */
function loadDrafts() {
  try {
    const saved = localStorage.getItem('pr-cybr-bbs-drafts');
    if (saved) {
      drafts = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load drafts:', e);
  }
}

/**
 * Save drafts to localStorage
 */
function saveDrafts() {
  try {
    localStorage.setItem('pr-cybr-bbs-drafts', JSON.stringify(drafts));
  } catch (e) {
    console.warn('Failed to save drafts:', e);
  }
}

/**
 * Generate a unique draft ID
 * @returns {string}
 */
function generateDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Format relative time
 * @param {string} isoString - ISO timestamp
 * @returns {string}
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
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

/**
 * Format full timestamp
 * @param {string} isoString - ISO timestamp
 * @returns {string}
 */
function formatTimestamp(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Check if message is stale (older than threshold)
 * @param {string} timestamp - ISO timestamp
 * @param {number} thresholdDays - Days threshold
 * @returns {boolean}
 */
function isStale(timestamp, thresholdDays = 30) {
  if (!timestamp) return true;
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
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
 * Set messages data
 * @param {Object} data - Object with 'public' and channel data
 */
export function setMessagesData(data) {
  allMessages = [];
  
  // Add public bulletins
  if (data.public?.bulletins) {
    data.public.bulletins.forEach(msg => {
      allMessages.push({
        ...msg,
        channel: 'public',
        channelNum: 0
      });
    });
  }
  
  // Add private channel messages
  Object.keys(CHANNELS).forEach(key => {
    if (key === 'public') return;
    const channel = CHANNELS[key];
    const channelData = data[`channel-${channel.num}`];
    
    if (channelData?.items) {
      channelData.items.forEach(msg => {
        allMessages.push({
          ...msg,
          channel: key,
          channelNum: channel.num
        });
      });
    }
  });
  
  // Sort by timestamp (newest first)
  allMessages.sort((a, b) => {
    const dateA = new Date(a.valid_from || 0);
    const dateB = new Date(b.valid_from || 0);
    return dateB - dateA;
  });
}

/**
 * Get filtered messages
 * @returns {BulletinMessage[]}
 */
function getFilteredMessages() {
  return allMessages.filter(msg => {
    // Channel filter
    if (currentChannel !== 'all' && msg.channel !== currentChannel) {
      return false;
    }
    
    // Priority filter
    if (currentFilter.priority !== 'all' && msg.priority !== currentFilter.priority) {
      return false;
    }
    
    // Category filter
    if (currentFilter.category !== 'all' && msg.category !== currentFilter.category) {
      return false;
    }
    
    // Search filter
    if (currentFilter.search) {
      const searchLower = currentFilter.search.toLowerCase();
      const titleMatch = msg.title?.toLowerCase().includes(searchLower);
      const bodyMatch = msg.body?.toLowerCase().includes(searchLower);
      const categoryMatch = msg.category?.toLowerCase().includes(searchLower);
      if (!titleMatch && !bodyMatch && !categoryMatch) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get unique categories from all messages
 * @returns {string[]}
 */
function getCategories() {
  const categories = new Set();
  allMessages.forEach(msg => {
    if (msg.category) {
      categories.add(msg.category);
    }
  });
  return Array.from(categories).sort();
}

/**
 * Render the channel sidebar
 * @returns {string} - HTML string
 */
function renderChannelSidebar() {
  let html = `
    <div class="messages-sidebar">
      <div class="sidebar-header">
        <h3>Channels</h3>
      </div>
      <ul class="channel-list">
        <li class="channel-list-item ${currentChannel === 'all' ? 'active' : ''}" 
            data-channel="all">
          <span class="channel-icon">📻</span>
          <span class="channel-name">All Channels</span>
          <span class="channel-count">${allMessages.length}</span>
        </li>
  `;
  
  Object.entries(CHANNELS).forEach(([key, channel]) => {
    const count = allMessages.filter(m => m.channel === key).length;
    html += `
      <li class="channel-list-item ${currentChannel === key ? 'active' : ''}" 
          data-channel="${escapeHtml(key)}">
        <span class="channel-icon">${channel.icon}</span>
        <span class="channel-name">${escapeHtml(channel.name)}</span>
        <span class="channel-count">${count}</span>
      </li>
    `;
  });
  
  html += `
      </ul>
    </div>
  `;
  
  return html;
}

/**
 * Render filter bar
 * @returns {string} - HTML string
 */
function renderFilterBar() {
  const categories = getCategories();
  
  return `
    <div class="messages-filters">
      <div class="filter-group">
        <input type="text" 
               id="messages-search" 
               class="filter-input" 
               placeholder="🔍 Search messages..." 
               value="${escapeHtml(currentFilter.search)}">
      </div>
      <div class="filter-group">
        <label for="filter-priority">Priority:</label>
        <select id="filter-priority" class="filter-select">
          <option value="all" ${currentFilter.priority === 'all' ? 'selected' : ''}>All</option>
          <option value="high" ${currentFilter.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="normal" ${currentFilter.priority === 'normal' ? 'selected' : ''}>Normal</option>
          <option value="low" ${currentFilter.priority === 'low' ? 'selected' : ''}>Low</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-category">Category:</label>
        <select id="filter-category" class="filter-select">
          <option value="all" ${currentFilter.category === 'all' ? 'selected' : ''}>All</option>
          ${categories.map(cat => `
            <option value="${escapeHtml(cat)}" ${currentFilter.category === cat ? 'selected' : ''}>
              ${escapeHtml(cat)}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

/**
 * Render message list
 * @returns {string} - HTML string
 */
function renderMessageList() {
  const messages = getFilteredMessages();
  
  if (messages.length === 0) {
    return `
      <div class="messages-empty">
        <div class="empty-state-icon">📭</div>
        <p>No messages found</p>
        <p class="text-secondary">Try adjusting your filters</p>
      </div>
    `;
  }
  
  // Group messages by day
  const groupedByDay = {};
  messages.forEach(msg => {
    const date = msg.valid_from 
      ? new Date(msg.valid_from).toLocaleDateString() 
      : 'Unknown Date';
    if (!groupedByDay[date]) {
      groupedByDay[date] = [];
    }
    groupedByDay[date].push(msg);
  });
  
  let html = '<div class="messages-list">';
  
  Object.entries(groupedByDay).forEach(([date, msgs]) => {
    html += `<div class="messages-day-group">`;
    html += `<div class="messages-day-header">${escapeHtml(date)}</div>`;
    
    msgs.forEach(msg => {
      const channel = CHANNELS[msg.channel] || { name: 'Unknown', icon: '❓', color: '#6b7280' };
      const priorityClass = msg.priority || 'normal';
      const stale = isStale(msg.valid_from);
      
      html += `
        <div class="message-card ${stale ? 'message-stale' : ''}" data-message-id="${escapeHtml(msg.id)}">
          <div class="message-header">
            <span class="message-channel" style="background: ${channel.color}20; color: ${channel.color}">
              ${channel.icon} ${escapeHtml(channel.name)}
            </span>
            <span class="priority-badge priority-badge--${priorityClass}">${priorityClass}</span>
            ${stale ? '<span class="stale-badge" title="Content may be outdated">⚠️</span>' : ''}
          </div>
          <div class="message-title">${escapeHtml(msg.title)}</div>
          <div class="message-body">${escapeHtml(msg.body?.substring(0, 200))}${msg.body?.length > 200 ? '...' : ''}</div>
          <div class="message-meta">
            <span class="message-category">${escapeHtml(msg.category)}</span>
            <span class="message-time" title="${formatTimestamp(msg.valid_from)}">
              ${formatRelativeTime(msg.valid_from)}
            </span>
            ${msg.tags?.length ? `
              <div class="message-tags">
                ${msg.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  return html;
}

/**
 * Render the compose panel
 * @returns {string} - HTML string
 */
function renderComposePanel() {
  const draftCount = Object.keys(drafts).length;
  
  return `
    <div class="compose-panel">
      <div class="compose-header">
        <h3>📝 Compose Message</h3>
        ${draftCount > 0 ? `<span class="draft-count">${draftCount} draft(s)</span>` : ''}
      </div>
      <div class="compose-form">
        <div class="form-group">
          <label for="compose-channel">Channel:</label>
          <select id="compose-channel" class="form-select">
            ${Object.entries(CHANNELS).map(([key, ch]) => `
              <option value="${escapeHtml(key)}">${ch.icon} ${escapeHtml(ch.name)}</option>
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
          <label for="compose-category">Category:</label>
          <input type="text" id="compose-category" class="form-input" placeholder="INFO">
        </div>
        <div class="form-group">
          <label for="compose-title">Title:</label>
          <input type="text" id="compose-title" class="form-input" placeholder="Message title">
        </div>
        <div class="form-group">
          <label for="compose-body">Body:</label>
          <textarea id="compose-body" class="form-textarea" rows="5" placeholder="Message content..."></textarea>
        </div>
        <div class="compose-actions">
          <button id="save-draft-btn" class="btn btn--secondary">💾 Save Draft</button>
          <button id="copy-json-btn" class="btn btn--primary">📋 Copy as JSON</button>
        </div>
      </div>
      ${draftCount > 0 ? `
        <div class="drafts-section">
          <h4>Saved Drafts</h4>
          <ul class="drafts-list">
            ${Object.entries(drafts).map(([id, draft]) => `
              <li class="draft-item" data-draft-id="${escapeHtml(id)}">
                <span class="draft-title">${escapeHtml(draft.title || 'Untitled')}</span>
                <span class="draft-time">${formatRelativeTime(draft.savedAt)}</span>
                <button class="btn btn--small load-draft" data-draft-id="${escapeHtml(id)}">Load</button>
                <button class="btn btn--small btn--danger delete-draft" data-draft-id="${escapeHtml(id)}">×</button>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="compose-note">
        <p>📌 Messages are saved locally and can be exported as JSON for gateway transmission.</p>
      </div>
    </div>
  `;
}

/**
 * Render the full messages view
 * @param {HTMLElement} container - Container element
 */
export function renderMessagesView(container) {
  if (!container) return;
  
  loadDrafts();
  
  container.innerHTML = `
    <div class="messages-view">
      ${renderChannelSidebar()}
      <div class="messages-main">
        ${renderFilterBar()}
        ${renderMessageList()}
      </div>
      ${renderComposePanel()}
    </div>
  `;
  
  // Attach event listeners
  attachEventListeners(container);
}

/**
 * Attach event listeners to messages view
 * @param {HTMLElement} container - Container element
 */
function attachEventListeners(container) {
  // Channel selection
  container.querySelectorAll('.channel-list-item').forEach(item => {
    item.addEventListener('click', function() {
      currentChannel = this.dataset.channel;
      renderMessagesView(container);
    });
  });
  
  // Search input
  const searchInput = container.querySelector('#messages-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilter.search = this.value;
        const listContainer = container.querySelector('.messages-main');
        if (listContainer) {
          listContainer.innerHTML = renderFilterBar() + renderMessageList();
          attachEventListeners(container);
        }
      }, 300);
    });
  }
  
  // Priority filter
  const prioritySelect = container.querySelector('#filter-priority');
  if (prioritySelect) {
    prioritySelect.addEventListener('change', function() {
      currentFilter.priority = this.value;
      const listContainer = container.querySelector('.messages-main');
      if (listContainer) {
        listContainer.innerHTML = renderFilterBar() + renderMessageList();
        attachEventListeners(container);
      }
    });
  }
  
  // Category filter
  const categorySelect = container.querySelector('#filter-category');
  if (categorySelect) {
    categorySelect.addEventListener('change', function() {
      currentFilter.category = this.value;
      const listContainer = container.querySelector('.messages-main');
      if (listContainer) {
        listContainer.innerHTML = renderFilterBar() + renderMessageList();
        attachEventListeners(container);
      }
    });
  }
  
  // Save draft button
  const saveDraftBtn = container.querySelector('#save-draft-btn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', function() {
      const draft = {
        id: generateDraftId(),
        channel: container.querySelector('#compose-channel')?.value || 'public',
        priority: container.querySelector('#compose-priority')?.value || 'normal',
        category: container.querySelector('#compose-category')?.value || 'INFO',
        title: container.querySelector('#compose-title')?.value || '',
        body: container.querySelector('#compose-body')?.value || '',
        savedAt: new Date().toISOString()
      };
      
      if (!draft.title && !draft.body) {
        alert('Please enter a title or body before saving.');
        return;
      }
      
      drafts[draft.id] = draft;
      saveDrafts();
      renderMessagesView(container);
      showToast('Draft saved!');
    });
  }
  
  // Copy as JSON button
  const copyJsonBtn = container.querySelector('#copy-json-btn');
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener('click', function() {
      const message = {
        id: `msg-${Date.now()}`,
        channel: container.querySelector('#compose-channel')?.value || 'public',
        priority: container.querySelector('#compose-priority')?.value || 'normal',
        category: container.querySelector('#compose-category')?.value || 'INFO',
        title: container.querySelector('#compose-title')?.value || '',
        body: container.querySelector('#compose-body')?.value || '',
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      const json = JSON.stringify(message, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        showToast('JSON copied to clipboard!');
      }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = json;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('JSON copied to clipboard!');
      });
    });
  }
  
  // Load draft buttons
  container.querySelectorAll('.load-draft').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const draftId = this.dataset.draftId;
      const draft = drafts[draftId];
      if (draft) {
        const channelSelect = container.querySelector('#compose-channel');
        const prioritySelect = container.querySelector('#compose-priority');
        const categoryInput = container.querySelector('#compose-category');
        const titleInput = container.querySelector('#compose-title');
        const bodyInput = container.querySelector('#compose-body');
        
        if (channelSelect) channelSelect.value = draft.channel;
        if (prioritySelect) prioritySelect.value = draft.priority;
        if (categoryInput) categoryInput.value = draft.category;
        if (titleInput) titleInput.value = draft.title;
        if (bodyInput) bodyInput.value = draft.body;
        
        showToast('Draft loaded!');
      }
    });
  });
  
  // Delete draft buttons
  container.querySelectorAll('.delete-draft').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const draftId = this.dataset.draftId;
      delete drafts[draftId];
      saveDrafts();
      renderMessagesView(container);
      showToast('Draft deleted');
    });
  });
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

/**
 * Set current channel
 * @param {string} channel - Channel key
 */
export function setChannel(channel) {
  currentChannel = channel;
}

/**
 * Reset filters
 */
export function resetFilters() {
  currentFilter = {
    priority: 'all',
    category: 'all',
    search: ''
  };
}

// Export module API
export default {
  setMessagesData,
  renderMessagesView,
  setChannel,
  resetFilters
};
