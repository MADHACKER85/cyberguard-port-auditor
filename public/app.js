// State Management
let connectionData = [];
let baselineData = [];
let activeTab = 'all'; // 'all', 'anomalies', 'baseline'
let selectedProcessToKill = null;

// DOM Elements
const btnScan = document.getElementById('btn-scan');
const btnRefreshBaseline = document.getElementById('btn-refresh-baseline');
const searchInput = document.getElementById('search-input');
const severityFilter = document.getElementById('severity-filter');
const portsTable = document.getElementById('ports-table');
const portsTbody = document.getElementById('ports-tbody');
const baselineTable = document.getElementById('baseline-table');
const baselineTbody = document.getElementById('baseline-tbody');
const progressContainer = document.getElementById('scan-progress-container');
const progressBar = document.getElementById('scan-progress-bar');
const progressPercentage = document.getElementById('scan-progress-percentage');
const lastUpdatedText = document.getElementById('last-updated-text');
const apiStatusText = document.getElementById('api-status');

// Counter Stats Elements
const statTotalPorts = document.getElementById('stat-total-ports');
const statAnomalies = document.getElementById('stat-anomalies');
const statExternalBinds = document.getElementById('stat-external-binds');
const statBaselineRatio = document.getElementById('stat-baseline-ratio');
const anomalyBadge = document.getElementById('anomaly-badge');
const panelCountBadge = document.getElementById('panel-count-badge');
const panelTitle = document.getElementById('panel-title');

// Modal Elements
const killModal = document.getElementById('kill-modal');
const killProcName = document.getElementById('kill-process-name');
const killProcPid = document.getElementById('kill-process-pid');
const killProcPort = document.getElementById('kill-process-port');
const btnConfirmKill = document.getElementById('kill-modal-confirm');
const btnCancelKill = document.getElementById('kill-modal-cancel');
const btnCloseModal = document.getElementById('modal-cancel-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  checkApiStatus();
  fetchBaseline();
});

// Navigation Setup
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      renderDashboard();
    });
  });
}

// Event Listeners Setup
function setupEventListeners() {
  btnScan.addEventListener('click', triggerScan);
  btnRefreshBaseline.addEventListener('click', fetchBaseline);
  
  // Search & Filter change
  searchInput.addEventListener('input', renderDashboard);
  severityFilter.addEventListener('change', renderDashboard);

  // Modal actions
  btnCancelKill.addEventListener('click', closeModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnConfirmKill.addEventListener('click', executeKillProcess);
}

// Check Backend connectivity
async function checkApiStatus() {
  try {
    const res = await fetch('/api/baseline');
    if (res.ok) {
      apiStatusText.innerText = 'Connected';
      apiStatusText.className = 'status-val text-green';
    } else {
      throw new Error();
    }
  } catch (err) {
    apiStatusText.innerText = 'Offline';
    apiStatusText.className = 'status-val text-danger';
    showToast('Connection Refused', 'Cannot communicate with backend API server.', 'danger');
  }
}

// Fetch Trusted Baseline
async function fetchBaseline() {
  try {
    const res = await fetch('/api/baseline');
    const data = await res.json();
    if (data.success) {
      baselineData = data.baseline;
      updateStats();
      if (activeTab === 'baseline') {
        renderDashboard();
      }
      showToast('Baseline Loaded', `Loaded ${baselineData.length} trusted profiles.`, 'success');
    }
  } catch (err) {
    console.error('Error fetching baseline:', err);
    showToast('Baseline Error', 'Could not fetch baseline configurations.', 'danger');
  }
}

// Perform active scan
async function triggerScan() {
  btnScan.disabled = true;
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressPercentage.innerText = '0%';

  // Smooth loading animation simulation
  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress > 90) progress = 90;
      progressBar.style.width = `${progress}%`;
      progressPercentage.innerText = `${progress}%`;
    }
  }, 100);

  try {
    const res = await fetch('/api/scan');
    const result = await res.json();
    
    clearInterval(interval);
    progressBar.style.width = '100%';
    progressPercentage.innerText = '100%';

    if (result.success) {
      connectionData = result.data;
      
      // Update scan time label
      const scanDate = new Date();
      lastUpdatedText.innerText = `Last Scan: ${scanDate.toLocaleTimeString()}`;
      
      updateStats();
      renderDashboard();
      showToast('Audit Completed', `Discovered ${connectionData.length} active listeners.`, 'success');
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    clearInterval(interval);
    showToast('Scan Failed', err.message || 'An error occurred during scanning.', 'danger');
  } finally {
    setTimeout(() => {
      progressContainer.style.display = 'none';
      btnScan.disabled = false;
    }, 800);
  }
}

// Update Stats counters on Dashboard top grid
function updateStats() {
  // Total listener connections
  statTotalPorts.innerText = connectionData.length || '--';

  // Total Anomalies
  const anomalyCount = connectionData.reduce((acc, curr) => acc + curr.anomalies.length, 0);
  statAnomalies.innerText = anomalyCount || (connectionData.length ? '0' : '--');
  anomalyBadge.innerText = anomalyCount;
  if (anomalyCount > 0) {
    anomalyBadge.style.display = 'inline-block';
  } else {
    anomalyBadge.style.display = 'none';
  }

  // External (exposed) bindings
  const externalCount = connectionData.filter(item => !item.isLocalOnly).length;
  statExternalBinds.innerText = externalCount || (connectionData.length ? '0' : '--');

  // Baseline Trusted ratio
  if (connectionData.length > 0) {
    const baselinedCount = connectionData.filter(item => item.baselined).length;
    const ratio = Math.round((baselinedCount / connectionData.length) * 100);
    statBaselineRatio.innerText = `${ratio}%`;
  } else {
    statBaselineRatio.innerText = '--';
  }
}

// Filter and search connections data
function getFilteredConnections() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const severityVal = severityFilter.value;

  return connectionData.filter(item => {
    // 1. Filter by search query
    const matchesSearch = 
      item.port.toString().includes(searchTerm) ||
      item.protocol.toLowerCase().includes(searchTerm) ||
      item.processName.toLowerCase().includes(searchTerm) ||
      item.pid.toString().includes(searchTerm) ||
      item.localIp.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    // 2. Filter by severity
    if (severityVal === 'all') return true;
    if (severityVal === 'high') return item.severity === 'high';
    if (severityVal === 'medium') return item.severity === 'high' || item.severity === 'medium';
    if (severityVal === 'low') return item.severity !== 'info'; // low, medium, high (anomalies)

    return true;
  });
}

// Main Dashboard Router & Renderer
function renderDashboard() {
  // Hide/Show correct tables based on active tabs
  if (activeTab === 'baseline') {
    portsTable.style.display = 'none';
    baselineTable.style.display = 'table';
    panelTitle.innerText = 'Trusted Configurations (Baseline)';
    renderBaselineList();
  } else {
    portsTable.style.display = 'table';
    baselineTable.style.display = 'none';
    panelTitle.innerText = activeTab === 'anomalies' ? 'Detected Port Anomalies' : 'Active Connection Audit Logs';
    renderConnectionsList();
  }
}

// Render Ports Connections Table
function renderConnectionsList() {
  let list = connectionData;

  // If tab is 'anomalies', only show records containing anomalies
  if (activeTab === 'anomalies') {
    list = connectionData.filter(item => item.anomalies.length > 0);
  }

  // Apply search/filter parameters
  const searchTerm = searchInput.value.toLowerCase().trim();
  const severityVal = severityFilter.value;

  list = list.filter(item => {
    const matchesSearch = 
      item.port.toString().includes(searchTerm) ||
      item.protocol.toLowerCase().includes(searchTerm) ||
      item.processName.toLowerCase().includes(searchTerm) ||
      item.pid.toString().includes(searchTerm) ||
      item.localIp.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    if (severityVal === 'high') return item.severity === 'high';
    if (severityVal === 'medium') return item.severity === 'high' || item.severity === 'medium';
    if (severityVal === 'low') return item.severity !== 'info';

    return true;
  });

  panelCountBadge.innerText = `${list.length} connections`;

  if (list.length === 0) {
    portsTbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-placeholder">
          <div class="placeholder-content">
            <svg class="placeholder-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p>No connections matched the current filters. Modify your search or perform a new scan.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  portsTbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');
    
    // Risk Pill HTML
    let severityClass = 'risk-info';
    if (item.severity === 'high') severityClass = 'risk-high';
    else if (item.severity === 'medium') severityClass = 'risk-medium';
    else if (item.severity === 'low') severityClass = 'risk-low';

    // Anomaly descriptions HTML
    let anomaliesHtml = '';
    if (item.anomalies.length > 0) {
      anomaliesHtml = `
        <div class="anomaly-details-list">
          ${item.anomalies.map(anom => {
            const anomClass = anom.severity === 'high' ? 'crit' : (anom.severity === 'medium' ? 'warn' : 'info');
            return `
              <div class="anomaly-item ${anomClass}">
                <span class="anomaly-item-text ${anomClass}"><span class="anomaly-bullet">•</span> ${escapeHtml(anom.message)}</span>
                ${anom.suggestion ? `<div class="anomaly-suggestion">💡 <strong>Suggested Fix:</strong> ${escapeHtml(anom.suggestion)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      anomaliesHtml = `<span class="text-green" style="font-size: 0.78rem;">✓ Verified Safe (Baselined)</span>`;
    }

    // Action button states
    const actionButtons = [];
    
    // Allow trust adding only if it is not already in the baseline
    if (!item.baselined) {
      actionButtons.push(`
        <button class="btn-table-action action-trust" onclick="addToBaseline(${item.port}, '${item.processName}', '${item.protocol}')">
          Trust Configuration
        </button>
      `);
    }

    // Allow process termination
    actionButtons.push(`
      <button class="btn-table-action action-kill" onclick="confirmKillProcess(${item.pid}, '${item.processName}', ${item.port}, '${item.protocol}')">
        Kill Process
      </button>
    `);

    tr.innerHTML = `
      <td><span class="port-badge">${item.port}</span></td>
      <td><strong>${item.protocol}</strong></td>
      <td>
        <div class="process-cell">
          <span class="process-name">${escapeHtml(item.processName)}</span>
          <span class="process-pid">PID: ${item.pid}</span>
        </div>
      </td>
      <td><code>${item.localIp}</code></td>
      <td>
        <span class="risk-pill ${severityClass}">${item.severity}</span>
        ${anomaliesHtml}
      </td>
      <td class="actions-col">
        ${actionButtons.join('')}
      </td>
    `;
    portsTbody.appendChild(tr);
  });
}

// Render Baseline Configuration List Table
function renderBaselineList() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const list = baselineData.filter(item => 
    item.port.toString().includes(searchTerm) ||
    item.process.toLowerCase().includes(searchTerm) ||
    item.protocol.toLowerCase().includes(searchTerm)
  );

  panelCountBadge.innerText = `${list.length} trusted profiles`;

  if (list.length === 0) {
    baselineTbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-placeholder">
          <div class="placeholder-content">
            <svg class="placeholder-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p>No trusted configurations in baseline. Navigate to "All Connections" or "Anomalies" to approve running configurations.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  baselineTbody.innerHTML = '';
  list.forEach(item => {
    const tr = document.createElement('tr');
    
    const dateStr = item.addedAt ? new Date(item.addedAt).toLocaleString() : 'N/A';

    tr.innerHTML = `
      <td><span class="port-badge">${item.port}</span></td>
      <td><strong>${item.protocol}</strong></td>
      <td><code>${escapeHtml(item.process)}</code></td>
      <td><span class="text-muted">${dateStr}</span></td>
      <td class="actions-col">
        <button class="btn-table-action btn-danger" style="background: rgba(255,51,102,0.1); border-color: rgba(255,51,102,0.15); color: #ff3366;" onclick="removeFromBaseline(${item.port}, '${item.process}', '${item.protocol}')">
          Remove Trust
        </button>
      </td>
    `;
    baselineTbody.appendChild(tr);
  });
}

// Add configuration to trust baseline
async function addToBaseline(port, process, protocol) {
  try {
    const res = await fetch('/api/baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port, process, protocol })
    });
    
    const result = await res.json();
    if (result.success) {
      showToast('Baseline Updated', `Successfully trusted ${process} on port ${port}.`, 'success');
      
      // Update local baseline copy
      baselineData.push({ port, process, protocol });
      
      // Update scan records to show item is now trusted
      connectionData = connectionData.map(item => {
        if (item.port === port && item.processName === process && item.protocol === protocol) {
          return {
            ...item,
            baselined: true,
            severity: item.severity === 'low' && item.anomalies.length === 1 ? 'info' : item.severity, // downgrade if baseline was sole trigger
            anomalies: item.anomalies.filter(anom => anom.type !== 'baseline_drift')
          };
        }
        return item;
      });

      // Recalculate stats & refresh layout
      updateStats();
      renderDashboard();
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    showToast('Baseline Failed', err.message || 'Could not save configurations.', 'danger');
  }
}

// Remove configuration from baseline
async function removeFromBaseline(port, process, protocol) {
  try {
    const res = await fetch('/api/baseline', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port, process, protocol })
    });
    
    const result = await res.json();
    if (result.success) {
      showToast('Baseline Removed', `Removed trust profile for ${process}.`, 'success');
      
      // Pull configuration from local baseline list
      baselineData = baselineData.filter(item => 
        !(item.port === port && item.process === process && item.protocol === protocol)
      );

      // Re-initialize connections baseline check
      connectionData = connectionData.map(item => {
        if (item.port === port && item.processName === process && item.protocol === protocol) {
          return {
            ...item,
            baselined: false
          };
        }
        return item;
      });
      
      updateStats();
      renderDashboard();
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    showToast('Action Failed', err.message || 'Could not complete database request.', 'danger');
  }
}

// --- Action Hooks (Modal controllers & Process execution) ---

// Confirm kill target process trigger
function confirmKillProcess(pid, processName, port, protocol) {
  selectedProcessToKill = pid;
  killProcName.innerText = processName;
  killProcPid.innerText = pid;
  killProcPort.innerText = `${protocol} ${port}`;
  
  killModal.style.display = 'flex';
}

function closeModal() {
  killModal.style.display = 'none';
  selectedProcessToKill = null;
}

// Execute PID termination request
async function executeKillProcess() {
  if (!selectedProcessToKill) return;
  const pid = selectedProcessToKill;
  
  closeModal();
  
  try {
    const res = await fetch('/api/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    
    const result = await res.json();
    if (result.success) {
      showToast('Process Terminated', `Forced kill on PID ${pid} completed.`, 'success');
      
      // Update local ports dataset (remove connections tied to this PID)
      connectionData = connectionData.filter(item => item.pid !== pid);
      
      updateStats();
      renderDashboard();
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    showToast('Termination Failed', err.message || `Failed to kill process PID ${pid}.`, 'danger');
  }
}

// Toast alerts creation helper
function showToast(title, desc, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <div class="toast-msg-container">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-desc">${escapeHtml(desc)}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Slide out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Safe escape HTML inputs helper
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}
