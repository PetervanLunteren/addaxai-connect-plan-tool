/* Cost calculator */

var COLORS = [
  '#0b5f65','#0e7a82','#12949d','#2db3bc','#6dcdd4',
  '#d4a030','#e8be5a','#f0d68a','#063e42','#094f54',
  '#3ec0c8','#a8e1e5','#92702a','#b8963c','#c9ae60',
  '#48c5cd','#78d4da'
];

function prices() {
  return {
    camera: val('priceCamera'), enclosure: val('priceEnclosure'),
    enclosureLock: val('priceEnclosureLock'),
    config: val('priceConfig'), logistics: val('priceLogistics'),
    sd: val('priceSD'), batteries: val('priceBatteries'),
    sim: val('priceSIM'), charger: val('priceCharger'),
    swSetup: val('priceSWSetup'), swMaint: val('priceSWMaint'),
    swDev: val('priceSWDev'), srvSetup: val('priceSrvSetup'),
    srvMaint: val('priceSrvMaint'), srvInstance: val('priceSrvInstance'),
    imgStorage: val('priceImgStorage'), srvBackup: val('priceSrvBackup'),
    projMgmt: val('priceProjMgmt'),
    training: val('priceTraining'),
    localSupport: val('priceLocalSupport')
  };
}

function inputs() {
  return {
    years: val('years'),
    active: val('activeCameras'), backup: val('backupCameras'),
    encl: val('enclosures'), locks: val('enclosureLocks'),
    projMgmt: val('projMgmt'), sessions: val('trainingSessions'),
    localSupport: val('localSupportSessions'), devDays: val('devDays'),
    byo: $('byo').checked, byoSim: $('byoSim').checked, diy: $('diy').checked,
    inclMgmt: !$('camMgmt').checked, mgmtCost: val('camMgmtCost')
  };
}

/* Single source of truth for all cost lines: table, charts and scaling insight all use this */
function buildRows(P, I) {
  var months = I.years * 12;
  var perYr = ' / ' + I.years + 'yr';
  var hw  = function (n) { return I.byo ? 0 : n; };   // hardware, skipped with own cameras
  var svc = function (n) { return I.diy ? 0 : n; };   // service, skipped when doing it yourself
  var rows = [
    { name: 'Active cameras',                unit: P.camera,                 basis: 'Per item',             qty: hw(I.active),                 cat: 'Hardware' },
    { name: 'Backup cameras',                unit: P.camera,                 basis: 'Per item',             qty: hw(I.backup),                 cat: 'Hardware' },
    { name: 'Enclosures',                    unit: P.enclosure,              basis: 'Per item',             qty: hw(I.encl),                   cat: 'Hardware' },
    { name: 'Enclosure locks',               unit: P.enclosureLock,          basis: 'Per item',             qty: hw(I.locks),                  cat: 'Hardware' },
    { name: 'Battery charger',               unit: P.charger,                basis: 'Per project',          qty: hw(1),                        cat: 'Hardware' },
    { name: 'SD-cards (two units)',          unit: P.sd,                     basis: 'Per active camera',    qty: hw(I.active),                 cat: 'Hardware' },
    { name: 'Batteries (two units)',         unit: P.batteries,              basis: 'Per active camera',    qty: hw(I.active),                 cat: 'Hardware' },
    { name: 'Logistics',                     unit: P.logistics,              basis: 'Per item',             qty: hw(I.active + I.backup),      cat: 'Hardware' },
    { name: 'Camera configuration',          unit: P.config,                 basis: 'Per active camera',    qty: svc(hw(I.active)),            cat: 'Setup' },
    { name: 'Server setup',                  unit: P.srvSetup,               basis: 'Per project',          qty: svc(1),                       cat: 'Setup' },
    { name: 'Software setup',                unit: P.swSetup,                basis: 'Per project',          qty: svc(1),                       cat: 'Setup' },
    { name: 'Project management',            unit: P.projMgmt,               basis: 'Per project',          qty: svc(I.projMgmt),              cat: 'Setup' },
    { name: 'Software development',          unit: P.swDev,                  basis: 'Per day',              qty: svc(I.devDays),               cat: 'Setup' },
    { name: 'Training',                      unit: P.training,               basis: 'Per session',          qty: svc(I.sessions),              cat: 'Setup' },
    { name: 'Local support',                 unit: P.localSupport,           basis: 'Per session',          qty: svc(I.localSupport),          cat: 'Setup' },
    { name: 'Mobile data (SIM-card)',        unit: P.sim * months,           basis: 'Per camera' + perYr,   qty: I.byoSim ? 0 : I.active,      cat: 'Usage' },
    { name: 'Camera placement & management', unit: (I.inclMgmt ? I.mgmtCost : 0) * I.years, basis: 'Per camera' + perYr, qty: I.active,  cat: 'Usage' },
    { name: 'Server instance',               unit: P.srvInstance * months,   basis: 'Per project' + perYr,  qty: svc(1),                       cat: 'Usage' },
    { name: 'Server maintenance',            unit: P.srvMaint * months,      basis: 'Per project' + perYr,  qty: svc(1),                       cat: 'Usage' },
    { name: 'Software maintenance',          unit: P.swMaint * months,       basis: 'Per project' + perYr,  qty: svc(1),                       cat: 'Usage' },
    { name: 'Image storage',                 unit: P.imgStorage * months,    basis: 'Per project' + perYr,  qty: svc(1),                       cat: 'Usage' },
    { name: 'Server backup',                 unit: P.srvBackup * months,     basis: 'Per project' + perYr,  qty: svc(1),                       cat: 'Usage' }
  ];
  rows.forEach(function (r) { r.total = r.unit * r.qty; });
  return rows;
}

function sumRows(rows) {
  return rows.reduce(function (s, r) { return s + r.total; }, 0);
}

/* Unit prices that differ from the HTML default, so a loaded project is easy to inspect */
function priceChanges() {
  return PRICE_IDS.map(function (id) {
    var input = $(id);
    return {
      id: id,
      name: input.closest('tr').children[0].textContent.replace(/\*+$/, ''),
      def: parseFloat(input.defaultValue) || 0,
      cur: val(id)
    };
  }).filter(function (c) { return c.cur !== c.def; });
}

function renderPriceChanges() {
  var changes = priceChanges();
  var changedIds = changes.map(function (c) { return c.id; });

  // Highlight changed rows in the modal and show the default
  PRICE_IDS.forEach(function (id) {
    var input = $(id);
    var tr = input.closest('tr');
    var changed = changedIds.indexOf(id) !== -1;
    tr.classList.toggle('changed', changed);
    var note = tr.querySelector('.default-note');
    if (changed && !note) {
      note = document.createElement('span');
      note.className = 'default-note';
      tr.children[2].appendChild(note);
    }
    if (note) {
      if (changed) note.textContent = 'default \u20AC ' + eur(parseFloat(input.defaultValue) || 0);
      else note.remove();
    }
  });

  // Note under the parameters card
  var box = $('priceChanges');
  if (changes.length === 0) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<strong>Unit prices adjusted from the default</strong><ul>' +
    changes.map(function (c) {
      return '<li>' + c.name + ' <span>\u20AC ' + eur(c.def) + ' to \u20AC ' + eur(c.cur) + '</span></li>';
    }).join('') + '</ul>';
}

function renderDonut(svgEl, legendEl, data, total) {
  if (total === 0) {
    svgEl.innerHTML = '<text x="110" y="115" text-anchor="middle" fill="#9ca3af" font-size="14">No costs</text>';
    legendEl.innerHTML = '';
    return;
  }
  var cx = 110, cy = 110, R = 95, r = 55;
  var angle = -Math.PI / 2;
  var paths = '';
  data.forEach(function (d) {
    var frac = d.value / total;
    var a1 = angle;
    var a2 = angle + frac * 2 * Math.PI;
    var large = frac > 0.5 ? 1 : 0;
    var x1o = cx + R * Math.cos(a1), y1o = cy + R * Math.sin(a1);
    var x2o = cx + R * Math.cos(a2), y2o = cy + R * Math.sin(a2);
    var x1i = cx + r * Math.cos(a2), y1i = cy + r * Math.sin(a2);
    var x2i = cx + r * Math.cos(a1), y2i = cy + r * Math.sin(a1);
    paths += '<path d="M' + x1o + ',' + y1o + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2o + ',' + y2o + ' L' + x1i + ',' + y1i + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + x2i + ',' + y2i + ' Z" fill="' + d.color + '"/>';
    angle = a2;
  });
  paths += '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="#1f2937" font-size="12" font-weight="600">&euro; ' + eur(total) + '</text>';
  paths += '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" fill="#6b7280" font-size="10">total</text>';
  svgEl.innerHTML = paths;
  legendEl.innerHTML = data.map(function (d) {
    return '<div class="legend-item">' +
      '<span class="legend-swatch" style="background:' + d.color + '"></span>' +
      '<span>' + d.name + '</span>' +
      '<span class="legend-value">&euro; ' + eur(d.value) + '</span>' +
      '</div>';
  }).join('');
}

function calculate() {
  var P = prices();
  var I = inputs();
  var active = I.active, years = I.years;

  // Disable camera inputs when BYO is checked
  document.querySelectorAll('.camera-row').forEach(function (row) {
    row.classList.toggle('disabled', I.byo);
  });

  // Disable service inputs when DIY is checked
  document.querySelectorAll('.service-row').forEach(function (row) {
    row.classList.toggle('disabled', I.diy);
  });

  renderPriceChanges();

  var rows = buildRows(P, I);
  var grandTotal = sumRows(rows);

  // Render output table with section headers
  var tbody = $('outputBody');
  var lastCat = '';
  var tableHTML = '';
  rows.forEach(function (r) {
    if (r.cat !== lastCat) {
      lastCat = r.cat;
      tableHTML += '<tr class="section-row"><td colspan="5">' + r.cat + '</td></tr>';
    }
    tableHTML += '<tr>' +
      '<td>' + r.name + '</td>' +
      '<td>' + r.basis + '</td>' +
      '<td><div class="currency"><span>&euro;</span><span>' + eur(r.unit) + '</span></div></td>' +
      '<td class="qty">' + r.qty + '</td>' +
      '<td><div class="currency"><span>&euro;</span><span>' + eur(r.total) + '</span></div></td>' +
      '</tr>';
  });
  var avgPerCamYear = (active > 0 && years > 0) ? eur(grandTotal / active / years) : '-';
  tableHTML += '<tr class="total-row">' +
      '<td colspan="4">Total</td>' +
      '<td><div class="currency"><span>&euro;</span><span>' + eur(grandTotal) + '</span></div></td>' +
      '</tr>' +
      '<tr class="metric-row">' +
      '<td colspan="4">Average cost per camera per year</td>' +
      '<td><div class="currency"><span>&euro;</span><span>' + avgPerCamYear + '</span></div></td>' +
      '</tr>';
  tbody.innerHTML = tableHTML;

  // Category totals for coarse chart
  var catTotals = {};
  rows.forEach(function (r) { catTotals[r.cat] = (catTotals[r.cat] || 0) + r.total; });

  // Detailed donut — group small slices into "Other"
  var nonZero = rows.filter(function (r) { return r.total > 0; });
  var threshold = grandTotal * 0.03;
  var chartData = [];
  var otherTotal = 0;
  nonZero.forEach(function (r, i) {
    if (r.total < threshold) {
      otherTotal += r.total;
    } else {
      chartData.push({ name: r.name, value: r.total, color: COLORS[i % COLORS.length] });
    }
  });
  if (otherTotal > 0) {
    chartData.push({ name: 'Other', value: otherTotal, color: '#9ca3af' });
  }
  renderDonut($('donut'), $('legend'), chartData, grandTotal);

  // Category donut
  var CAT_COLORS = { Hardware: '#0b5f65', Setup: '#d4a030', Usage: '#0e7a82' };
  var catData = Object.entries(catTotals)
    .filter(function (e) { return e[1] > 0; })
    .map(function (e) { return { name: e[0], value: e[1], color: CAT_COLORS[e[0]] || '#9ca3af' }; });
  renderDonut($('catDonut'), $('catLegend'), catData, grandTotal);

  // Scaling insight table
  var camSteps = [10, 25, 50, 75, 100, 150, 200];
  var yearSteps = [1, 2];
  var backupRatio = active > 0 ? I.backup / active : 0.1;
  var scaledTotal = function (c, y) {
    var alt = Object.assign({}, I, { active: c, backup: Math.round(c * backupRatio), years: y, devDays: 0 });
    return sumRows(buildRows(P, alt));
  };

  var scalingBody = $('scalingBody');
  var sHTML = '<tr><th class="row-header">Cameras \u2192<br>Years \u2193</th>';
  camSteps.forEach(function (c) {
    sHTML += '<th' + (c === active ? ' class="current-cell"' : '') + '>' + c + '</th>';
  });
  sHTML += '</tr>';

  yearSteps.forEach(function (y) {
    sHTML += '<tr><td class="row-header">' + y + ' yr' + (y > 1 ? 's' : '') + '</td>';
    camSteps.forEach(function (c) {
      var avg = scaledTotal(c, y) / c / y;
      var isCurrent = c === active && y === years;
      sHTML += '<td class="' + (isCurrent ? 'current-cell' : '') + '">\u20AC ' + Math.round(avg) + '</td>';
    });
    sHTML += '</tr>';
  });
  scalingBody.innerHTML = sHTML;

  // Scaling line chart
  var chartW = 600, chartH = 280, pad = { top: 20, right: 20, bottom: 40, left: 60 };
  var plotW = chartW - pad.left - pad.right;
  var plotH = chartH - pad.top - pad.bottom;

  var seriesData = yearSteps.map(function (y) {
    return {
      year: y,
      points: camSteps.map(function (c) {
        return { cam: c, avg: Math.round(scaledTotal(c, y) / c / y) };
      })
    };
  });

  var allAvgs = seriesData.flatMap(function (s) { return s.points.map(function (p) { return p.avg; }); });
  var maxAvg = Math.max.apply(null, allAvgs);
  var minAvg = Math.min.apply(null, allAvgs);
  var yMax = Math.ceil(maxAvg / 100) * 100;
  var yMin = Math.max(0, Math.floor(minAvg / 100) * 100 - 100);

  var xScale = function (c) { return pad.left + ((c - camSteps[0]) / (camSteps[camSteps.length - 1] - camSteps[0])) * plotW; };
  var yScale = function (v) { return pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH; };

  var lineColors = ['var(--teal-700)', 'var(--teal-400)'];
  var svg = '<svg viewBox="0 0 ' + chartW + ' ' + chartH + '" style="width:100%;height:auto;font-family:inherit;">';

  var yTicks = 5;
  for (var i = 0; i <= yTicks; i++) {
    var v = yMin + (yMax - yMin) * i / yTicks;
    var y = yScale(v);
    svg += '<line x1="' + pad.left + '" y1="' + y + '" x2="' + (chartW - pad.right) + '" y2="' + y + '" stroke="#e5e7eb" stroke-width="1"/>';
    svg += '<text x="' + (pad.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" fill="#6b7280" font-size="11">\u20AC ' + Math.round(v) + '</text>';
  }

  camSteps.forEach(function (c) {
    svg += '<text x="' + xScale(c) + '" y="' + (chartH - 8) + '" text-anchor="middle" fill="#6b7280" font-size="11">' + c + '</text>';
  });
  svg += '<text x="' + (pad.left + plotW / 2) + '" y="' + chartH + '" text-anchor="middle" fill="#9ca3af" font-size="10">cameras</text>';

  seriesData.forEach(function (s, si) {
    var color = lineColors[si];
    var pathD = s.points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + xScale(p.cam) + ',' + yScale(p.avg); }).join(' ');
    svg += '<path d="' + pathD + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
    s.points.forEach(function (p) {
      var isCurrent = p.cam === active && s.year === years;
      svg += '<circle cx="' + xScale(p.cam) + '" cy="' + yScale(p.avg) + '" r="' + (isCurrent ? 5 : 3) + '" fill="' + (isCurrent ? color : 'white') + '" stroke="' + color + '" stroke-width="2"/>';
    });
  });

  var legX = pad.left + 8;
  seriesData.forEach(function (s, si) {
    var legY = pad.top + 8 + si * 18;
    svg += '<line x1="' + legX + '" y1="' + legY + '" x2="' + (legX + 20) + '" y2="' + legY + '" stroke="' + lineColors[si] + '" stroke-width="2.5"/>';
    svg += '<text x="' + (legX + 26) + '" y="' + (legY + 4) + '" fill="#374151" font-size="11">' + s.year + ' yr' + (s.year > 1 ? 's' : '') + '</text>';
  });

  svg += '</svg>';
  $('scalingChart').innerHTML = svg;
}

document.addEventListener('DOMContentLoaded', function () {
  // Attach listeners to all inputs
  document.querySelectorAll('#tab-cost input[type="number"], .modal-overlay input[type="number"]').forEach(function (input) {
    input.addEventListener('input', calculate);
  });
  $('years').addEventListener('change', calculate);
  $('byo').addEventListener('change', calculate);
  $('camMgmt').addEventListener('change', calculate);
  $('byoSim').addEventListener('change', calculate);
  $('diy').addEventListener('change', calculate);

  // Modal
  var modal = $('pricesModal');
  $('openModal').addEventListener('click', function () { modal.classList.add('open'); });
  $('closeModal').addEventListener('click', function () { modal.classList.remove('open'); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });

  // Initial calculation
  calculate();
});
