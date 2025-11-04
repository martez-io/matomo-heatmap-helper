// State management
let currentState = 'input'; // 'input', 'scrolling', 'success'
let heatmapId = null;
let bypassedMatomoCheck = false; // Track if user bypassed the Matomo check

// Matomo API credentials
let matomoApiUrl = null;
let matomoAuthToken = null;
let matomoSiteId = null;
let matomoSiteName = null;

// DOM elements
const stateInput = document.getElementById('state-input');
const stateError = document.getElementById('state-error');
const stateScrolling = document.getElementById('state-scrolling');
const stateSuccess = document.getElementById('state-success');

const inputHeatmapId = document.getElementById('heatmap-id');
const btnStart = document.getElementById('btn-start');
const btnDone = document.getElementById('btn-done');
const btnRestore = document.getElementById('btn-restore');
const btnReset = document.getElementById('btn-reset');
const btnRetry = document.getElementById('btn-retry');
const btnContinueAnyway = document.getElementById('btn-continue-anyway');

const detectedCount = document.getElementById('detected-count');
const detectedList = document.getElementById('detected-list');
const successHeatmapId = document.getElementById('success-heatmap-id');
const errorUrl = document.getElementById('error-url');
const scrollingError = document.getElementById('scrolling-error');
const scrollingErrorMessage = document.getElementById('scrolling-error-message');

// Settings modal elements
const settingsModal = document.getElementById('settings-modal');
const btnSettingsInput = document.getElementById('btn-settings-input');
const btnSettingsError = document.getElementById('btn-settings-error');
const btnSettingsScrolling = document.getElementById('btn-settings-scrolling');
const btnSettingsSuccess = document.getElementById('btn-settings-success');
const btnCloseModal = document.getElementById('btn-close-modal');
const inputMatomoUrl = document.getElementById('matomo-url');
const inputMatomoToken = document.getElementById('matomo-token');
const btnValidate = document.getElementById('btn-validate');
const validationStatus = document.getElementById('validation-status');
const siteSelection = document.getElementById('site-selection');
const selectMatomoSite = document.getElementById('matomo-site');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnClearSettings = document.getElementById('btn-clear-settings');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load saved heatmap ID and Matomo credentials if they exist
  chrome.storage.local.get(['lastHeatmapId', 'matomoApiUrl', 'matomoAuthToken', 'matomoSiteId', 'matomoSiteName'], (result) => {
    if (result.lastHeatmapId) {
      inputHeatmapId.value = result.lastHeatmapId;
    }

    // Load Matomo credentials
    if (result.matomoApiUrl) matomoApiUrl = result.matomoApiUrl;
    if (result.matomoAuthToken) matomoAuthToken = result.matomoAuthToken;
    if (result.matomoSiteId) matomoSiteId = result.matomoSiteId;
    if (result.matomoSiteName) matomoSiteName = result.matomoSiteName;

    console.log('[Popup] Loaded credentials:', {
      hasUrl: !!matomoApiUrl,
      hasToken: !!matomoAuthToken,
      siteId: matomoSiteId,
      siteName: matomoSiteName
    });
  });

  // Check if Matomo exists on the current page
  checkMatomo();

  // Initialize settings modal event listeners
  initializeSettingsModal();
});

// State management
function showState(state) {
  currentState = state;

  stateInput.classList.remove('active');
  stateError.classList.remove('active');
  stateScrolling.classList.remove('active');
  stateSuccess.classList.remove('active');

  switch(state) {
    case 'input':
      stateInput.classList.add('active');
      inputHeatmapId.focus();
      break;
    case 'error':
      stateError.classList.add('active');
      break;
    case 'scrolling':
      stateScrolling.classList.add('active');
      break;
    case 'success':
      stateSuccess.classList.add('active');
      break;
  }
}

// Check if Matomo exists on the page
async function checkMatomo() {
  console.log('[Popup] Checking for Matomo...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('[Popup] Current tab:', tab.id, tab.url);

    // Execute in MAIN world (page context) to access window._paq
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',  // Run in page context, not isolated extension context!
      func: () => {
        return {
          hasMatomо: typeof window._paq !== 'undefined',
          details: typeof window._paq !== 'undefined'
            ? 'Matomo tracking (_paq) is available'
            : 'Matomo tracking (_paq) not found on this page',
          url: window.location.href
        };
      }
    });

    const result = results[0].result;
    console.log('[Popup] Matomo check result:', result);

    if (result.hasMatomо) {
      // Matomo found - show normal input state
      console.log('[Popup] Matomo found!', result.details);
      showState('input');
    } else {
      // Matomo not found - show error state
      console.log('[Popup] Matomo not found:', result.details);
      showMatomoError(result.url, result.details);
    }
  } catch (error) {
    console.error('[Popup] Error checking Matomo:', error);
    // Show error state for restricted pages
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    showMatomoError(tab.url, 'Cannot access this page (may be a restricted page like chrome:// or file://)');
  }
}

// Show Matomo error state
function showMatomoError(url, details) {
  errorUrl.textContent = url;
  showState('error');
}

// Button: Retry Matomo Check
btnRetry.addEventListener('click', () => {
  console.log('[Popup] Retry button clicked');
  checkMatomo();
});

// Button: Continue Anyway
btnContinueAnyway.addEventListener('click', () => {
  console.log('[Popup] Continue anyway button clicked');
  bypassedMatomoCheck = true; // Mark that user bypassed the check
  showState('input');
});

// Button: Start Tracking
btnStart.addEventListener('click', async () => {
  console.log('[Popup] Start button clicked');
  const id = inputHeatmapId.value.trim();

  if (!id) {
    alert('Please enter a heatmap ID');
    return;
  }

  // Validate it's a number
  if (!/^\d+$/.test(id)) {
    alert('Heatmap ID must be a number');
    return;
  }

  heatmapId = id;
  console.log('[Popup] Heatmap ID validated:', heatmapId);

  // Save for next time
  chrome.storage.local.set({ lastHeatmapId: id });

  // Send message to content script to start tracking
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('[Popup] Sending message to tab:', tab.id, tab.url);

  chrome.tabs.sendMessage(tab.id, {
    action: 'startTracking',
    heatmapId: heatmapId
  }, (response) => {
    console.log('[Popup] Response received:', response);
    console.log('[Popup] Last error:', chrome.runtime.lastError);

    if (chrome.runtime.lastError) {
      alert('Failed to initialize tracking. Please refresh the page and try again.\n\nError: ' + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      console.log('[Popup] Tracking started successfully');
      showState('scrolling');
      // Start polling for updates
      startPolling(tab.id);
    } else {
      alert('Failed to initialize tracking. Please refresh the page and try again.');
    }
  });
});

// Button: Done Scrolling
btnDone.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Hide any previous error message
  scrollingError.style.display = 'none';

  // Disable button to prevent double-click
  btnDone.disabled = true;
  btnDone.textContent = 'Expanding elements...';

  try {
    // Step 1: Expand elements via content script (DOM manipulation)
    console.log('[Popup] Step 1: Expanding elements...');
    const expandResponse = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'expandElements'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!expandResponse || !expandResponse.success) {
      throw new Error(expandResponse?.error || 'Failed to expand elements');
    }

    console.log('[Popup] Elements expanded successfully');
    btnDone.textContent = 'Triggering Matomo...';

    // Step 2: Trigger Matomo in MAIN world (page context)
    console.log('[Popup] Step 2: Triggering Matomo screenshot...');
    const matomoResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',  // Run in page context to access window._paq
      func: (heatmapIdParam) => {
        console.log('[Page Context] Triggering Matomo with ID:', heatmapIdParam);

        // Don't throw - return error object instead so it can be caught properly
        if (typeof window._paq === 'undefined') {
          console.error('[Page Context] Matomo (_paq) not found');
          return {
            success: false,
            error: 'Matomo (_paq) not found on this page.\n\nPlease ensure:\n• Matomo tracking code is installed\n• The page has fully loaded\n• Ad blockers are not blocking Matomo'
          };
        }

        window._paq.push(['HeatmapSessionRecording::captureInitialDom', parseInt(heatmapIdParam)]);
        window._paq.push(['HeatmapSessionRecording::enable']);

        console.log('[Page Context] Matomo screenshot triggered successfully');
        return { success: true };
      },
      args: [heatmapId]
    });

    const matomoResult = matomoResults[0].result;
    console.log('[Popup] Matomo trigger result:', matomoResult);

    // Check if Matomo trigger succeeded
    if (!matomoResult || !matomoResult.success) {
      throw new Error(matomoResult?.error || 'Failed to trigger Matomo screenshot');
    }

    // Success!
    console.log('[Popup] Screenshot captured successfully');
    successHeatmapId.textContent = heatmapId;
    showState('success');
    stopPolling();

  } catch (error) {
    console.error('[Popup] Error during expand and capture:', error);

    // Stop polling
    stopPolling();

    // Reset button state so user can retry
    btnDone.disabled = false;
    btnDone.textContent = 'Done Scrolling - Take Screenshot';

    if (bypassedMatomoCheck) {
      // User already bypassed the initial check, show error in UI and stay in current state
      // This avoids sending them back to the error state in a confusing loop
      console.log('[Popup] User had bypassed Matomo check - showing error in UI');

      // Show error message in the scrolling state
      scrollingErrorMessage.textContent = error.message;
      scrollingError.style.display = 'block';

      // Scroll error into view
      scrollingError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      // First time error, show error state screen
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      showMatomoError(tab.url, error.message);
    }
  }
});

// Button: Restore
btnRestore.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, {
    action: 'restore'
  }, (response) => {
    if (chrome.runtime.lastError) {
      alert('Failed to restore layout. Error: ' + chrome.runtime.lastError.message);
      return;
    }

    if (response && response.success) {
      alert('Layout restored successfully!');
    }
  });
});

// Button: Reset
btnReset.addEventListener('click', () => {
  heatmapId = null;
  bypassedMatomoCheck = false; // Reset bypass flag
  detectedCount.textContent = '0';
  detectedList.innerHTML = '';
  btnDone.disabled = false;
  btnDone.textContent = 'Done Scrolling - Take Screenshot';

  // Check Matomo again to show correct state
  checkMatomo();
});

// Polling for scroll updates
let pollingInterval = null;

function startPolling(tabId) {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Poll every 500ms for updates
  pollingInterval = setInterval(() => {
    chrome.tabs.sendMessage(tabId, {
      action: 'getStatus'
    }, (response) => {
      // Ignore errors during polling (tab might be closed, etc.)
      if (chrome.runtime.lastError) {
        return;
      }

      if (response && response.scrolledCount !== undefined) {
        updateScrollStatus(response);
      }
    });
  }, 500);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Update scroll status in UI
function updateScrollStatus(status) {
  detectedCount.textContent = status.scrolledCount;

  // Update detected list
  if (status.scrollables && status.scrollables.length > 0) {
    detectedList.innerHTML = '';

    status.scrollables.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'detected-item';

      const name = document.createElement('div');
      name.className = 'detected-item-name';
      name.textContent = `${index + 1}. ${item.selector}`;

      const info = document.createElement('div');
      info.className = 'detected-item-info';
      info.textContent = `${item.hiddenContent}px hidden content`;

      div.appendChild(name);
      div.appendChild(info);
      detectedList.appendChild(div);
    });
  }
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  stopPolling();
});

// ============================================================================
// Settings Modal Functions
// ============================================================================

function initializeSettingsModal() {
  console.log('[Popup] Initializing settings modal');

  // Settings button click handlers (all states)
  btnSettingsInput.addEventListener('click', openSettingsModal);
  btnSettingsError.addEventListener('click', openSettingsModal);
  btnSettingsScrolling.addEventListener('click', openSettingsModal);
  btnSettingsSuccess.addEventListener('click', openSettingsModal);

  // Modal close handlers
  btnCloseModal.addEventListener('click', closeSettingsModal);
  settingsModal.addEventListener('click', (e) => {
    // Close if clicking the backdrop
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Validate button
  btnValidate.addEventListener('click', validateAndLoadSites);

  // Save button
  btnSaveSettings.addEventListener('click', saveSettings);

  // Clear button
  btnClearSettings.addEventListener('click', clearSettings);
}

function openSettingsModal() {
  console.log('[Popup] Opening settings modal');

  // Populate form with current values if they exist
  if (matomoApiUrl) inputMatomoUrl.value = matomoApiUrl;
  if (matomoAuthToken) inputMatomoToken.value = matomoAuthToken;

  // Show/hide clear button based on whether credentials exist
  if (matomoApiUrl && matomoAuthToken && matomoSiteId) {
    btnClearSettings.style.display = 'block';
  } else {
    btnClearSettings.style.display = 'none';
  }

  // Reset validation UI
  validationStatus.style.display = 'none';
  validationStatus.className = 'status-message';
  siteSelection.style.display = 'none';
  btnSaveSettings.style.display = 'none';

  // Show modal
  settingsModal.classList.add('active');

  // Auto-load sites if credentials exist
  if (matomoApiUrl && matomoAuthToken) {
    console.log('[Popup] Auto-loading sites with saved credentials');
    validateAndLoadSites();
  }
}

function closeSettingsModal() {
  console.log('[Popup] Closing settings modal');
  settingsModal.classList.remove('active');
}

async function validateAndLoadSites() {
  console.log('[Popup] Validating token and loading sites');

  const url = inputMatomoUrl.value.trim();
  const token = inputMatomoToken.value.trim();

  // Validate inputs
  if (!url || !token) {
    showValidationStatus('error', 'Please enter both Matomo URL and Auth Token');
    return;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    showValidationStatus('error', 'Invalid URL format. Please enter a valid URL (e.g., https://matomo.example.com)');
    return;
  }

  // Show loading state
  btnValidate.disabled = true;
  btnValidate.textContent = 'Validating...';
  showValidationStatus('loading', 'Connecting to Matomo and fetching sites with write access...');

  try {
    // Call Matomo API to get sites with write access
    const sites = await callMatomoAPI(url, {
      method: 'SitesManager.getSitesWithMinimumAccess',
      permission: 'write',
      token_auth: token
    });

    console.log('[Popup] Received sites:', sites);

    // Check if we got a valid response
    if (!Array.isArray(sites) || sites.length === 0) {
      throw new Error('No sites with write access found for this token');
    }

    // Success! Populate site dropdown
    selectMatomoSite.innerHTML = '';
    sites.forEach(site => {
      const option = document.createElement('option');
      option.value = JSON.stringify({ idsite: site.idsite, name: site.name });
      option.textContent = `${site.name} (ID: ${site.idsite})`;

      // Pre-select current site if it matches
      if (matomoSiteId && site.idsite == matomoSiteId) {
        option.selected = true;
      }

      selectMatomoSite.appendChild(option);
    });

    // Show success message and site selection
    showValidationStatus('success', `✓ Found ${sites.length} site(s) with write access`);
    siteSelection.style.display = 'block';
    btnSaveSettings.style.display = 'block';

    // Reset validate button
    btnValidate.disabled = false;
    btnValidate.textContent = 'Validate & Load Sites';

  } catch (error) {
    console.error('[Popup] Validation error:', error);
    showValidationStatus('error', `Validation failed: ${error.message}`);

    // Reset validate button
    btnValidate.disabled = false;
    btnValidate.textContent = 'Validate & Load Sites';

    // Hide site selection
    siteSelection.style.display = 'none';
    btnSaveSettings.style.display = 'none';
  }
}

function showValidationStatus(type, message) {
  validationStatus.style.display = 'block';
  validationStatus.className = `status-message ${type}`;
  validationStatus.textContent = message;
}

async function saveSettings() {
  console.log('[Popup] Saving settings');

  const url = inputMatomoUrl.value.trim();
  const token = inputMatomoToken.value.trim();
  const selectedSite = JSON.parse(selectMatomoSite.value);

  // Update in-memory variables
  matomoApiUrl = url;
  matomoAuthToken = token;
  matomoSiteId = selectedSite.idsite;
  matomoSiteName = selectedSite.name;

  // Save to storage
  chrome.storage.local.set({
    matomoApiUrl: url,
    matomoAuthToken: token,
    matomoSiteId: selectedSite.idsite,
    matomoSiteName: selectedSite.name
  }, () => {
    console.log('[Popup] Settings saved successfully');
    showValidationStatus('success', `✓ Settings saved! Using site: ${selectedSite.name}`);

    // Close modal after a short delay
    setTimeout(() => {
      closeSettingsModal();
    }, 1500);
  });
}

async function clearSettings() {
  console.log('[Popup] Clearing settings');

  if (!confirm('Are you sure you want to clear all Matomo API credentials?')) {
    return;
  }

  // Clear in-memory variables
  matomoApiUrl = null;
  matomoAuthToken = null;
  matomoSiteId = null;
  matomoSiteName = null;

  // Clear from storage
  chrome.storage.local.remove(['matomoApiUrl', 'matomoAuthToken', 'matomoSiteId', 'matomoSiteName'], () => {
    console.log('[Popup] Settings cleared');

    // Clear form
    inputMatomoUrl.value = '';
    inputMatomoToken.value = '';
    selectMatomoSite.innerHTML = '';

    // Reset UI
    validationStatus.style.display = 'none';
    siteSelection.style.display = 'none';
    btnSaveSettings.style.display = 'none';
    btnClearSettings.style.display = 'none';

    showValidationStatus('success', 'Credentials cleared successfully');

    setTimeout(() => {
      closeSettingsModal();
    }, 1500);
  });
}

async function callMatomoAPI(baseUrl, params) {
  // Build URL
  const url = `${baseUrl}/index.php`;

  // Build form data
  const formData = new URLSearchParams();
  formData.append('module', 'API');
  formData.append('format', 'json');

  // Add all params
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, value);
  }

  console.log('[Popup] Calling Matomo API (POST):', url);
  console.log('[Popup] Form data:', formData.toString());

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for Matomo API error response
    if (data.result === 'error') {
      throw new Error(data.message || 'Matomo API returned an error');
    }

    return data;

  } catch (error) {
    console.error('[Popup] API call failed:', error);

    // Provide user-friendly error messages
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to Matomo. Check the URL and your internet connection.');
    } else if (error.message.includes('CORS')) {
      throw new Error('CORS error. The Matomo server may need to allow requests from this extension.');
    } else {
      throw error;
    }
  }
}
