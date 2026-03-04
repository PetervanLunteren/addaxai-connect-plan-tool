/* Camera placement tool */

(function () {
  var FOV_ANGLE_DEG = 50;
  var FOV_RANGE_M = 20;
  var FADE_STEPS = 3;

  var map;
  var drawnItems;
  var cameraLayer;
  var detectionLayer;
  var currentPolygon = null;
  var cameras = [];

  function initMap() {
    map = L.map('map').setView([20, 0], 2);
    window.placementMap = map;

    var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19
    });

    var light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      maxZoom: 19
    });

    osm.addTo(map);

    L.control.layers({
      'OpenStreetMap': osm,
      'Satellite': satellite,
      'Light': light
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    cameraLayer = new L.FeatureGroup();
    map.addLayer(cameraLayer);

    detectionLayer = new L.FeatureGroup();
    map.addLayer(detectionLayer);

    var drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          shapeOptions: {
            color: '#0b5f65',
            weight: 2,
            fillOpacity: 0.1
          }
        },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: drawnItems
      }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (e) {
      clearAll();
      drawnItems.addLayer(e.layer);
      currentPolygon = e.layer;
      onPolygonReady();
    });

    map.on(L.Draw.Event.EDITED, function () {
      if (drawnItems.getLayers().length > 0) {
        currentPolygon = drawnItems.getLayers()[0];
        onPolygonReady();
      }
    });

    map.on(L.Draw.Event.DELETED, function () {
      clearAll();
      currentPolygon = null;
      showEmptyState(true);
    });
  }

  function clearAll() {
    drawnItems.clearLayers();
    cameraLayer.clearLayers();
    detectionLayer.clearLayers();
    cameras = [];
  }

  function showEmptyState(show) {
    var el = $('mapEmptyState');
    var panel = $('metricsPanel');
    if (show) {
      el.classList.remove('hidden');
      panel.classList.remove('visible');
    } else {
      el.classList.add('hidden');
      panel.classList.add('visible');
    }
  }

  function onPolygonReady() {
    showEmptyState(false);
    var n = val('placementCameras');
    if (n < 1) n = 1;
    placeCamerasInGrid(n);
    renderDetectionZones();
    updateMetrics();
  }

  function getPolygonGeoJSON() {
    var latlngs = currentPolygon.getLatLngs()[0];
    var coords = latlngs.map(function (ll) { return [ll.lng, ll.lat]; });
    // Close the ring
    coords.push(coords[0]);
    return turf.polygon([coords]);
  }

  function placeCamerasInGrid(n) {
    cameraLayer.clearLayers();
    detectionLayer.clearLayers();
    cameras = [];

    if (!currentPolygon || n < 1) return;

    var poly = getPolygonGeoJSON();
    var areaM2 = turf.area(poly);
    var cellSizeM = Math.sqrt(areaM2 / n);
    var cellSizeKm = cellSizeM / 1000;

    if (cellSizeKm < 0.001) cellSizeKm = 0.001;

    var bbox = turf.bbox(poly);
    var grid = turf.pointGrid(bbox, cellSizeKm, { units: 'kilometers' });
    var inside = turf.pointsWithinPolygon(grid, poly);

    var points = inside.features;

    // If too many points, sort by distance from centroid and keep closest N
    if (points.length > n) {
      var centroid = turf.centroid(poly);
      points.sort(function (a, b) {
        return turf.distance(a, centroid) - turf.distance(b, centroid);
      });
      points = points.slice(0, n);
    }

    points.forEach(function (pt) {
      var coord = pt.geometry.coordinates;
      var angle = Math.random() * 360;
      cameras.push({ lng: coord[0], lat: coord[1], angle: angle });

      L.circleMarker([coord[1], coord[0]], {
        radius: 4,
        color: '#063e42',
        fillColor: '#0b5f65',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(cameraLayer);
    });
  }

  function renderDetectionZones() {
    detectionLayer.clearLayers();

    cameras.forEach(function (cam) {
      var center = turf.point([cam.lng, cam.lat]);
      var halfFov = FOV_ANGLE_DEG / 2;

      for (var step = FADE_STEPS; step >= 1; step--) {
        var range = FOV_RANGE_M * (step / FADE_STEPS);
        var rangeKm = range / 1000;
        var opacity = 0.08 + (FADE_STEPS - step) * 0.06;

        var leftBearing = cam.angle - halfFov;
        var rightBearing = cam.angle + halfFov;

        var leftPt = turf.destination(center, rangeKm, leftBearing, { units: 'kilometers' });
        var rightPt = turf.destination(center, rangeKm, rightBearing, { units: 'kilometers' });

        var triCoords = [
          [cam.lng, cam.lat],
          leftPt.geometry.coordinates,
          rightPt.geometry.coordinates,
          [cam.lng, cam.lat]
        ];

        L.polygon([
          [cam.lat, cam.lng],
          [leftPt.geometry.coordinates[1], leftPt.geometry.coordinates[0]],
          [rightPt.geometry.coordinates[1], rightPt.geometry.coordinates[0]]
        ], {
          color: '#0b5f65',
          weight: 0.5,
          fillColor: '#2db3bc',
          fillOpacity: opacity
        }).addTo(detectionLayer);
      }
    });
  }

  function updateMetrics() {
    if (!currentPolygon || cameras.length === 0) return;

    var poly = getPolygonGeoJSON();
    var areaM2 = turf.area(poly);
    var areaKm2 = areaM2 / 1e6;
    var n = cameras.length;

    // Camera density
    var density = n / areaKm2;

    // Mean spacing (approximate from grid cell)
    var cellSizeM = Math.sqrt(areaM2 / n);

    // Grid cell size in hectares
    var cellHa = (cellSizeM * cellSizeM) / 10000;

    // Detection area per camera (triangle area = 0.5 * range^2 * sin(fov))
    var fovRad = FOV_ANGLE_DEG * Math.PI / 180;
    var detectionPerCam = 0.5 * FOV_RANGE_M * FOV_RANGE_M * Math.sin(fovRad);
    var totalDetection = detectionPerCam * n;

    // Coverage %
    var coveragePct = (totalDetection / areaM2) * 100;

    $('metricArea').textContent = areaKm2.toFixed(2) + ' km\u00B2';
    $('metricCameras').textContent = n;
    $('metricDensity').textContent = density.toFixed(2) + ' /km\u00B2';
    $('metricSpacing').textContent = Math.round(cellSizeM) + ' m';
    $('metricCellSize').textContent = cellHa.toFixed(2) + ' ha';
    $('metricDetection').textContent = Math.round(totalDetection).toLocaleString() + ' m\u00B2';
    $('metricCoverage').textContent = coveragePct.toFixed(3) + '%';
  }

  /* Expose state for save/load */
  window.placementGetState = function () {
    if (!currentPolygon) return null;
    var latlngs = currentPolygon.getLatLngs()[0];
    var polygon = latlngs.map(function (ll) { return [ll.lng, ll.lat]; });
    return {
      polygon: polygon,
      cameras: cameras.map(function (c) { return { lng: c.lng, lat: c.lat, angle: c.angle }; })
    };
  };

  window.placementSetState = function (state) {
    clearAll();
    if (!state || !state.polygon || state.polygon.length < 3) {
      currentPolygon = null;
      showEmptyState(true);
      return;
    }
    // Draw polygon
    var latlngs = state.polygon.map(function (c) { return [c[1], c[0]]; });
    var layer = L.polygon(latlngs, {
      color: '#0b5f65',
      weight: 2,
      fillOpacity: 0.1
    });
    drawnItems.addLayer(layer);
    currentPolygon = layer;
    map.fitBounds(layer.getBounds(), { padding: [30, 30] });

    // Restore cameras if provided, otherwise generate fresh
    if (state.cameras && state.cameras.length > 0) {
      cameras = state.cameras.map(function (c) { return { lng: c.lng, lat: c.lat, angle: c.angle }; });
      cameras.forEach(function (cam) {
        L.circleMarker([cam.lat, cam.lng], {
          radius: 4,
          color: '#063e42',
          fillColor: '#0b5f65',
          fillOpacity: 1,
          weight: 1.5
        }).addTo(cameraLayer);
      });
      renderDetectionZones();
      updateMetrics();
      showEmptyState(false);
    } else {
      onPolygonReady();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    initMap();
    showEmptyState(true);

    $('placementCameras').addEventListener('input', function () {
      if (currentPolygon) {
        onPolygonReady();
      }
    });
  });
})();
