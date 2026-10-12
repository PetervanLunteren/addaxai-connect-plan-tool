/* Global helpers */
function $(id) { return document.getElementById(id); }
function val(id) { return parseFloat($(id).value) || 0; }
function eur(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* Tab switching */
function initTabs() {
  var btns = document.querySelectorAll('.tab-btn');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      var pane = $(btn.dataset.tab);
      pane.classList.add('active');

      // Fix Leaflet tile rendering after display:none
      if (btn.dataset.tab === 'tab-placement' && window.placementMap) {
        setTimeout(function () { window.placementMap.invalidateSize(); }, 50);
      }
    });
  });
}

/* Bidirectional camera count sync between tabs */
function initCameraSync() {
  var costInput = $('activeCameras');
  var placementInput = $('placementCameras');

  var syncing = false;

  costInput.addEventListener('input', function () {
    if (syncing) return;
    syncing = true;
    placementInput.value = costInput.value;
    placementInput.dispatchEvent(new Event('input', { bubbles: true }));
    syncing = false;
  });

  placementInput.addEventListener('input', function () {
    if (syncing) return;
    syncing = true;
    costInput.value = placementInput.value;
    costInput.dispatchEvent(new Event('input', { bubbles: true }));
    syncing = false;
  });
}

/* Save / Load project state */
var COST_IDS = ['years', 'activeCameras', 'backupCameras', 'enclosures', 'enclosureLocks', 'projMgmt', 'trainingSessions', 'localSupportSessions', 'devDays'];
var COST_CHECKBOXES = ['byo', 'byoSim', 'camMgmt', 'diy'];
var PRICE_IDS = [
  'priceCamera', 'priceEnclosure', 'priceEnclosureLock', 'priceConfig', 'priceLogistics', 'priceSD',
  'priceBatteries', 'priceSIM', 'camMgmtCost', 'priceCharger', 'priceSWSetup', 'priceProjMgmt',
  'priceSWMaint', 'priceSWDev', 'priceSrvSetup', 'priceSrvMaint', 'priceSrvInstance',
  'priceImgStorage', 'priceSrvBackup', 'priceTraining', 'priceLocalSupport'
];

function collectState() {
  var cost = {};
  COST_IDS.forEach(function (id) { cost[id] = val(id); });
  COST_CHECKBOXES.forEach(function (id) { cost[id] = $(id).checked; });

  var prices = {};
  PRICE_IDS.forEach(function (id) { prices[id] = val(id); });

  var placement = window.placementGetState ? window.placementGetState() : null;

  return { version: 1, cost: cost, prices: prices, placement: placement };
}

function restoreState(state) {
  if (!state) return;

  // Cost inputs
  if (state.cost) {
    COST_IDS.forEach(function (id) {
      if (state.cost[id] !== undefined && $(id)) {
        $(id).value = state.cost[id];
      }
    });
    COST_CHECKBOXES.forEach(function (id) {
      if (state.cost[id] !== undefined && $(id)) {
        $(id).checked = state.cost[id];
      }
    });
  }

  // Price inputs
  if (state.prices) {
    PRICE_IDS.forEach(function (id) {
      if (state.prices[id] !== undefined && $(id)) {
        $(id).value = state.prices[id];
      }
    });
  }

  // Placement
  if (state.placement && window.placementSetState) {
    window.placementSetState(state.placement);
  }

  // Sync placement camera count
  if (state.cost && state.cost.activeCameras !== undefined && $('placementCameras')) {
    $('placementCameras').value = state.cost.activeCameras;
  }

  // Trigger recalculation by dispatching events on key inputs
  ['activeCameras', 'years', 'byo', 'byoSim', 'camMgmt', 'diy'].forEach(function (id) {
    var el = $(id);
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function showToast(message, isError) {
  var toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 2100);
}

function initSaveLoad() {
  var btnSave = $('btnSave');
  var btnLoad = $('btnLoad');
  var fileInput = $('fileInput');

  btnSave.addEventListener('click', function () {
    var state = collectState();
    var json = JSON.stringify(state, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'addaxai-connect-plan.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  btnLoad.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var state = JSON.parse(ev.target.result);
        restoreState(state);
        showToast('Project loaded');
      } catch (_) {
        showToast('Could not load file', true);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be loaded again
    fileInput.value = '';
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initTabs();
  initCameraSync();
  initSaveLoad();
});
