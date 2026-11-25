/* 인천 동선 맛집 지도 — 키 없이 동작하는 정적 웹앱 */
(function () {
  'use strict';

  var REGIONS = {
    '인천': {
      label: '인천광역시',
      data: 'data/restaurants.json',
      center: [37.456, 126.705],
      zoom: 11,
      viewbox: [126.34, 37.64, 126.82, 37.35]
    }
  };

  var TIERS = {
    michelin: { label: '미쉐린', full: '미쉐린 스타 출신', color: '#d92d20' },
    blueribbon: { label: '블루리본', full: '블루리본 서베이', color: '#2563eb' },
    local: { label: '찐후기', full: '찐후기', color: '#0f9d58' }
  };

  var HUBS = [
    { name: '부평역', lat: 37.4894, lng: 126.7235 },
    { name: '인천시청역', lat: 37.4577, lng: 126.7022 },
    { name: '구월동 로데오', lat: 37.4451, lng: 126.7021 },
    { name: '인천터미널역', lat: 37.4419, lng: 126.6997 },
    { name: '송도 센트럴파크', lat: 37.3931, lng: 126.6386 },
    { name: '청라호수공원', lat: 37.5325, lng: 126.6343 },
    { name: '주안역', lat: 37.4651, lng: 126.6800 },
    { name: '동인천역', lat: 37.4754, lng: 126.6326 },
    { name: '신포시장', lat: 37.4714, lng: 126.6271 },
    { name: '월미도', lat: 37.4717, lng: 126.5992 },
    { name: '소래포구역', lat: 37.4009, lng: 126.7335 },
    { name: '검단사거리역', lat: 37.6017, lng: 126.6564 },
    { name: '계양역', lat: 37.5718, lng: 126.7363 },
    { name: '인천공항 T1', lat: 37.4497, lng: 126.4524 }
  ];

  var state = {
    region: '인천',
    data: [],
    meta: {},
    start: null,
    end: null,
    mode: 'car',
    radius: 1000,
    tiers: { michelin: true, blueribbon: true, local: true },
    district: 'all',
    route: null,
    picking: null,
    selected: null,
    loading: false
  };

  var map, layerRest, layerRoute, layerHubs;
  var markers = {};
  var $ = function (id) { return document.getElementById(id); };
  var el = {};

  /* ── 유틸 ─────────────────────────────────────── */
  function haversine(a, b) {
    var R = 6371000, toRad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * toRad, dLng = (b[1] - a[1]) * toRad;
    var la1 = a[0] * toRad, la2 = b[0] * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function fmtDist(m) {
    if (m == null) return '';
    if (m < 1000) return Math.round(m / 10) * 10 + 'm';
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + 'km';
  }

  function fmtDur(sec) {
    if (sec == null) return '';
    var min = Math.round(sec / 60);
    if (min < 60) return min + '분';
    return Math.floor(min / 60) + '시간 ' + (min % 60) + '분';
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.hidden = true; }, ms || 2600);
  }

  /* ── 경로 투영: 수직 최단거리 + 진행거리 ───────── */
  function projectToLine(pt, line) {
    var lat0 = pt[0] * Math.PI / 180;
    var kx = 111320 * Math.cos(lat0), ky = 110540;
    var px = 0, py = 0;
    var best = { dist: Infinity, along: 0 };
    var acc = 0;
    for (var i = 0; i < line.length - 1; i++) {
      var a = line[i], b = line[i + 1];
      var ax = (a[1] - pt[1]) * kx, ay = (a[0] - pt[0]) * ky;
      var bx = (b[1] - pt[1]) * kx, by = (b[0] - pt[0]) * ky;
      var dx = bx - ax, dy = by - ay;
      var len2 = dx * dx + dy * dy;
      var segLen = haversine(a, b);
      var t = len2 > 0 ? -(ax * dx + ay * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      var cx = ax + t * dx, cy = ay + t * dy;
      var d = Math.sqrt(cx * cx + cy * cy);
      if (d < best.dist) best = { dist: d, along: acc + segLen * t };
      acc += segLen;
    }
    if (line.length === 1) {
      best = { dist: haversine(pt, line[0]), along: 0 };
    }
    best.total = acc;
    return best;
  }

  /* ── 지도 ─────────────────────────────────────── */
  function initMap() {
    var cfg = REGIONS[state.region];
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView(cfg.center, cfg.zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    layerRoute = L.layerGroup().addTo(map);
    layerHubs = L.layerGroup().addTo(map);
    layerRest = L.layerGroup().addTo(map);

    map.on('click', function (e) {
      handleMapClick(e.latlng);
    });
  }

  function pinIcon(tier, selected) {
    return L.divIcon({
      className: '',
      html: '<div class="pin ' + tier + (selected ? ' sel' : '') + '"><i></i></div>',
      iconSize: selected ? [26, 26] : [20, 20],
      iconAnchor: selected ? [13, 26] : [10, 20]
    });
  }

  function hubIcon(name) {
    return L.divIcon({
      className: '',
      html: '<div class="hub-pin"></div><div class="hub-label">' + name + '</div>',
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
  }

  /* ── 데이터 ───────────────────────────────────── */
  function loadData() {
    state.loading = true;
    var cfg = REGIONS[state.region];
    return fetch(cfg.data, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('데이터 응답 ' + r.status);
        return r.json();
      })
      .then(function (json) {
        state.data = json.restaurants || [];
        state.meta = json.meta || {};
        state.loading = false;
        buildDistrictOptions();
        renderTierChips();
        renderFootNotes();
        renderList();
        fitAll();
      })
      .catch(function (err) {
        state.loading = false;
        el.list.innerHTML = '<div class="empty">맛집 데이터를 불러오지 못했습니다.<br>' +
          '잠시 후 새로고침해 주세요.<br><span style="font-size:11px;color:#a1a1aa">(' + err.message + ')</span></div>';
        toast('데이터를 불러오지 못했습니다.');
      });
  }

  function buildDistrictOptions() {
    var counts = {};
    state.data.forEach(function (r) { counts[r.district] = (counts[r.district] || 0) + 1; });
    var order = ['제물포구', '영종구', '미추홀구', '남동구', '연수구', '부평구', '서해구', '검단구', '계양구', '강화군'];
    var names = Object.keys(counts).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib;
    });
    var html = '<option value="all">전체 지역구</option>';
    names.forEach(function (n) {
      var old = '';
      var sample = state.data.filter(function (r) { return r.district === n; })[0];
      if (sample && sample.districtOld && sample.districtOld !== n) old = ' (' + sample.districtOld + ')';
      html += '<option value="' + n + '">' + n + old + ' · ' + counts[n] + '</option>';
    });
    el.district.innerHTML = html;
  }

  function renderTierChips() {
    var counts = { michelin: 0, blueribbon: 0, local: 0 };
    state.data.forEach(function (r) { if (counts[r.tier] != null) counts[r.tier]++; });
    var html = '';
    Object.keys(TIERS).forEach(function (t) {
      html += '<button type="button" class="chip on" data-tier="' + t + '">' +
        '<span class="i-dot ' + t + '"></span>' + TIERS[t].label + ' ' + counts[t] + '</button>';
    });
    el.tierChips.innerHTML = html;
  }

  function renderFootNotes() {
    if (state.meta.tierNote) {
      el.tierNoteFoot.innerHTML = '<b>참고</b> ' + state.meta.tierNote;
    }
    if (state.meta.districtNote) {
      el.tierNoteFoot.innerHTML += '<br>' + state.meta.districtNote;
    }
  }

  /* ── 검색 ─────────────────────────────────────── */
  function localMatches(q) {
    var key = q.replace(/\s+/g, '').toLowerCase();
    if (!key) return [];
    var out = [];
    HUBS.forEach(function (h) {
      if (h.name.replace(/\s+/g, '').toLowerCase().indexOf(key) >= 0) {
        out.push({ name: h.name, lat: h.lat, lng: h.lng, meta: '주요 거점' });
      }
    });
    state.data.forEach(function (r) {
      if (r.name.replace(/\s+/g, '').toLowerCase().indexOf(key) >= 0) {
        out.push({ name: r.name, lat: r.lat, lng: r.lng, meta: r.district + ' · ' + r.category });
      }
    });
    return out.slice(0, 6);
  }

  function nominatim(q) {
    var cfg = REGIONS[state.region];
    var vb = cfg.viewbox.join(',');
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ko' +
      '&q=' + encodeURIComponent(q) + '&viewbox=' + vb;
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (arr) {
        return (arr || []).map(function (it) {
          return {
            name: (it.display_name || '').split(',').slice(0, 2).join(', '),
            lat: parseFloat(it.lat), lng: parseFloat(it.lon),
            meta: (it.display_name || '').split(',').slice(2, 4).join(', ')
          };
        });
      })
      .catch(function () { return []; });
  }

  function bindSearch(kind) {
    var input = kind === 'start' ? el.startInput : el.endInput;
    var box = kind === 'start' ? el.startResults : el.endResults;
    var timer = null;

    function show(items) {
      if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.innerHTML = items.map(function (it, i) {
        return '<button type="button" data-i="' + i + '"><span class="r-name">' + esc(it.name) +
          '</span><span class="r-meta">' + esc(it.meta || '') + '</span></button>';
      }).join('');
      box.hidden = false;
      box._items = items;
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 1) { box.hidden = true; return; }
      show(localMatches(q));
      timer = setTimeout(function () {
        nominatim(q).then(function (remote) {
          if (input.value.trim() !== q) return;
          var merged = localMatches(q);
          remote.forEach(function (r) {
            if (!merged.some(function (m) { return haversine([m.lat, m.lng], [r.lat, r.lng]) < 80; })) merged.push(r);
          });
          show(merged.slice(0, 7));
        });
      }, 420);
    });

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-i]');
      if (!btn) return;
      var it = (box._items || [])[parseInt(btn.getAttribute('data-i'), 10)];
      if (!it) return;
      setEndpoint(kind, it);
      input.value = it.name;
      box.hidden = true;
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && box._items && box._items.length) {
        setEndpoint(kind, box._items[0]);
        input.value = box._items[0].name;
        box.hidden = true;
      }
      if (e.key === 'Escape') { box.hidden = true; }
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { box.hidden = true; }, 160);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── 출발/도착 ─────────────────────────────────── */
  function setEndpoint(kind, place) {
    var p = { name: place.name, lat: place.lat, lng: place.lng };
    if (kind === 'start') { state.start = p; el.startInput.value = p.name; }
    else { state.end = p; el.endInput.value = p.name; }
    clearPick();
    updateRoute();
  }

  function handleMapClick(latlng) {
    if (!state.picking) return;
    var kind = state.picking;
    var p = {
      name: '지도 선택 지점 (' + latlng.lat.toFixed(4) + ', ' + latlng.lng.toFixed(4) + ')',
      lat: latlng.lat, lng: latlng.lng
    };
    clearPick();
    setEndpoint(kind, p);
    toast((kind === 'start' ? '출발지' : '도착지') + '를 지도에서 지정했습니다.');
  }

  function startPick(kind) {
    state.picking = kind;
    document.querySelector('.map-wrap').classList.add('picking');
    el.pickNote.hidden = false;
    el.pickNote.innerHTML = '지도를 클릭해 <b>' + (kind === 'start' ? '출발지' : '도착지') + '</b>를 찍으세요. (Esc로 취소)';
    (kind === 'start' ? el.startPick : el.endPick).classList.add('active');
    toast('지도를 클릭해 위치를 지정하세요.');
  }

  function clearPick() {
    state.picking = null;
    document.querySelector('.map-wrap').classList.remove('picking');
    el.pickNote.hidden = true;
    el.startPick.classList.remove('active');
    el.endPick.classList.remove('active');
  }

  function useGps(kind) {
    if (!navigator.geolocation) { toast('이 브라우저에서는 위치를 쓸 수 없습니다.'); return; }
    toast('현재 위치를 확인하는 중…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      setEndpoint(kind, {
        name: '현재 위치',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      toast('현재 위치를 ' + (kind === 'start' ? '출발지' : '도착지') + '로 지정했습니다.');
    }, function () {
      toast('위치 권한이 없어 현재 위치를 쓸 수 없습니다. 주소로 검색해 주세요.');
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  }

  /* ── 경로 ─────────────────────────────────────── */
  function straightFallback(a, b) {
    var mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    return {
      line: [[a.lat, a.lng], [mid.lat, mid.lng], [b.lat, b.lng]],
      distance: haversine([a.lat, a.lng], [b.lat, b.lng]),
      duration: null,
      kind: 'straight'
    };
  }

  function osrmRoute(a, b) {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      a.lng + ',' + a.lat + ';' + b.lng + ',' + b.lat + '?overview=full&geometries=geojson';
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error('no route');
        var rt = j.routes[0];
        return {
          line: rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }),
          distance: rt.distance,
          duration: rt.duration,
          kind: 'road'
        };
      });
  }

  function updateRoute() {
    var a = state.start, b = state.end;
    if (!a || !b) {
      state.route = null;
      layerRoute.clearLayers();
      renderSummary();
      renderList();
      renderMarkers();
      return;
    }
    renderSummary('경로를 계산하는 중…');
    if (state.mode === 'car') {
      osrmRoute(a, b)
        .then(function (route) { applyRoute(route); })
        .catch(function () { applyRoute(straightFallback(a, b)); });
    } else {
      applyRoute(straightFallback(a, b));
    }
  }

  function applyRoute(route) {
    state.route = route;
    drawRoute(route);
    renderSummary();
    renderList();
    renderMarkers();
    fitRoute();
  }

  function drawRoute(route) {
    layerRoute.clearLayers();
    if (!route) return;
    var opts = route.kind === 'road'
      ? { color: '#4338ca', weight: 5, opacity: 0.85 }
      : { color: '#4338ca', weight: 4, opacity: 0.8, dashArray: '8 8' };
    L.polyline(route.line, opts).addTo(layerRoute);
    if (state.start) {
      L.circleMarker([state.start.lat, state.start.lng], {
        radius: 7, color: '#fff', weight: 3, fillColor: '#111114', fillOpacity: 1
      }).bindTooltip('출발: ' + esc(state.start.name), { direction: 'top' }).addTo(layerRoute);
    }
    if (state.end) {
      L.circleMarker([state.end.lat, state.end.lng], {
        radius: 7, color: '#111114', weight: 3, fillColor: '#fff', fillOpacity: 1
      }).bindTooltip('도착: ' + esc(state.end.name), { direction: 'top' }).addTo(layerRoute);
    }
  }

  function drawHubs() {
    layerHubs.clearLayers();
    if (state.mode !== 'transit') return;
    HUBS.forEach(function (h) {
      L.marker([h.lat, h.lng], { icon: hubIcon(h.name), interactive: false, keyboard: false })
        .addTo(layerHubs);
    });
  }

  function fitRoute() {
    if (state.route && state.route.line.length > 1) {
      map.fitBounds(L.latLngBounds(state.route.line), { padding: [40, 40] });
    } else if (state.start && state.end) {
      map.fitBounds(L.latLngBounds([[state.start.lat, state.start.lng], [state.end.lat, state.end.lng]]), { padding: [60, 60] });
    }
  }

  function fitAll() {
    if (!state.data.length) return;
    var b = L.latLngBounds(state.data.map(function (r) { return [r.lat, r.lng]; }));
    map.fitBounds(b, { padding: [30, 30] });
  }

  /* ── 필터/렌더 ─────────────────────────────────── */
  function computed() {
    return state.data.map(function (r) {
      var rec = { r: r, dist: null, along: null };
      if (state.route) {
        var p = projectToLine([r.lat, r.lng], state.route.line);
        rec.dist = p.dist;
        rec.along = p.along;
      }
      return rec;
    });
  }

  function visible() {
    var all = computed();
    var tiersOn = Object.keys(state.tiers).filter(function (t) { return state.tiers[t]; });
    var out = all.filter(function (rec) {
      if (tiersOn.indexOf(rec.r.tier) < 0) return false;
      if (state.district !== 'all' && rec.r.district !== state.district) return false;
      if (state.route && state.radius > 0 && (rec.dist == null || rec.dist > state.radius)) return false;
      return true;
    });
    if (state.route) {
      out.sort(function (a, b) { return (a.along || 0) - (b.along || 0); });
    } else {
      out.sort(function (a, b) { return a.r.name.localeCompare(b.r.name, 'ko'); });
    }
    return out;
  }

  function badge(tier, label) {
    return '<span class="badge ' + tier + '">' + esc(label) + '</span>';
  }

  function renderList() {
    var rows = visible();
    el.resultCount.textContent = rows.length + '곳';
    el.sortNote.textContent = state.route ? (state.mode === 'car' ? '출발→도착 순' : '축 진행 순') : '';
    if (!rows.length) {
      el.list.innerHTML = '<div class="empty">조건에 맞는 맛집이 없습니다.<br>반경을 넓히거나 등급·지역구 필터를 풀어 보세요.</div>';
      return;
    }
    el.list.innerHTML = rows.map(function (rec, i) {
      var r = rec.r;
      var distTxt = rec.dist == null ? '' : '경로에서 ' + fmtDist(rec.dist);
      return '<button type="button" class="card' + (state.selected === r.id ? ' sel' : '') + '" data-id="' + r.id + '">' +
        '<span class="card-top"><span class="card-order">' + (i + 1) + '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' + badge(r.tier, TIERS[r.tier].label) + '</span>' +
        '<span class="card-meta">' + esc(r.district) + ' · ' + esc(r.category) +
        (distTxt ? ' <span class="card-dist">' + distTxt + '</span>' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function renderMarkers() {
    layerRest.clearLayers();
    markers = {};
    var rows = visible();
    rows.forEach(function (rec) {
      var r = rec.r;
      var m = L.marker([r.lat, r.lng], {
        icon: pinIcon(r.tier, state.selected === r.id),
        title: r.name
      });
      m.on('click', function () { openDetail(r.id); });
      m.addTo(layerRest);
      markers[r.id] = m;
    });
  }

  function renderSummary(msg) {
    if (msg) { el.summary.innerHTML = msg; return; }
    if (!state.start || !state.end) {
      el.summary.textContent = '출발지와 도착지를 정해 주세요. 위 칩을 누르거나 검색, 지도 클릭으로 지정할 수 있습니다.';
      return;
    }
    var route = state.route;
    if (!route) return;
    var n = visible().length;
    var radiusTxt = state.radius > 0 ? '반경 ' + fmtDist(state.radius) + ' 내' : '경로 주변';
    var modeTxt = route.kind === 'road' ? '자동차 도로 기준' :
      (state.mode === 'transit' ? '대중교통 근사 축' : '직선 폴백');
    var durTxt = route.duration ? ' · 약 ' + fmtDur(route.duration) : '';
    el.summary.innerHTML =
      '<b>' + esc(state.start.name) + '</b> → <b>' + esc(state.end.name) + '</b><br>' +
      fmtDist(route.distance) + durTxt + ' · ' + modeTxt + '<br>' +
      radiusTxt + ' 맛집 <b>' + n + '곳</b>' +
      (state.mode === 'transit' ? '<br><span class="err">대중교통 노선·환승 정보는 제공되지 않아 출발→도착을 잇는 직선 축으로 표시합니다. 실제 경로는 카드의 네이버·카카오 길찾기를 이용하세요.</span>' : '') +
      (route.kind === 'straight' && state.mode === 'car' ? '<br><span class="err">경로 서버 응답이 없어 직선으로 표시했습니다.</span>' : '');
  }

  /* ── 상세 ─────────────────────────────────────── */
  function openDetail(id) {
    var r = state.data.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    state.selected = id;
    var rec = computed().filter(function (x) { return x.r.id === id; })[0];
    var distLine = rec && rec.dist != null ? '경로에서 ' + fmtDist(rec.dist) : '경로 미지정';

    var html = '' +
      '<div class="d-head">' + badge(r.tier, r.tierLabel || TIERS[r.tier].label) + '</div>' +
      '<h2 class="d-title" id="detail-title">' + esc(r.name) + '</h2>' +
      '<p class="d-meta">' + esc(r.category) + ' · ' + esc(r.district) +
      (r.districtOld && r.districtOld !== r.district ? '(' + esc(r.districtOld) + ')' : '') +
      ' ' + esc(r.dong || '') + '</p>' +
      '<div class="d-stats">' +
      '<div class="d-stat">동선 이탈<b>' + (rec && rec.dist != null ? fmtDist(rec.dist) : '—') + '</b></div>' +
      '<div class="d-stat">영업<b>' + esc(r.hours || '매장 확인') + '</b></div>' +
      '<div class="d-stat">휴무<b>' + esc(r.closed || '매장 확인') + '</b></div>' +
      '</div>' +
      '<div class="d-sec"><h3>주소</h3><p>' + esc(r.address) + '</p></div>' +
      '<div class="d-sec"><h3>대표 메뉴</h3><ul class="menu-list">' +
      (r.menus || []).map(function (m) {
        return '<li><span>' + esc(m.name) + '</span><span class="p">' + esc(m.price) + '</span></li>';
      }).join('') + '</ul></div>' +
      '<div class="d-sec"><h3>후기 요약</h3><p>' + esc(r.reviewSummary) + '</p></div>' +
      '<div class="d-sec"><h3>이용 팁</h3><p>' + esc(r.tips) + '</p></div>' +
      (r.phone ? '<div class="d-sec"><h3>전화</h3><p>' + esc(r.phone) + '</p></div>' : '') +
      (r.tierNote ? '<div class="d-tienote"><b>등급 근거</b> ' + esc(r.tierNote) + '</div>' : '') +
      '<div class="d-actions">' +
      '<a class="btn primary" href="' + esc(r.naverMapUrl) + '" target="_blank" rel="noopener">네이버지도 길찾기</a>' +
      '<a class="btn" href="' + esc(r.kakaoMapUrl) + '" target="_blank" rel="noopener">카카오맵</a>' +
      '<button class="btn" type="button" data-act="start" data-id="' + r.id + '">출발지로</button>' +
      '<button class="btn" type="button" data-act="end" data-id="' + r.id + '">도착지로</button>' +
      '</div>' +
      '<p class="d-meta" style="margin-top:12px">' + esc(distLine) + '</p>';

    el.detailContent.innerHTML = html;
    el.detail.hidden = false;
    document.body.style.overflow = 'hidden';

    var m = markers[id];
    if (m && map) {
      var narrow = window.matchMedia('(max-width: 900px)').matches;
      map.panInside([r.lat, r.lng], narrow
        ? { paddingTopLeft: [30, 30], paddingBottomRight: [30, 420] }
        : { paddingTopLeft: [30, 30], paddingBottomRight: [500, 60] });
    }
    renderMarkers();
    renderList();
  }

  function closeDetail() {
    el.detail.hidden = true;
    document.body.style.overflow = '';
    state.selected = null;
    renderMarkers();
    renderList();
  }

  /* ── 이벤트 ───────────────────────────────────── */
  function bindEvents() {
    el.startPick.addEventListener('click', function () { startPick('start'); });
    el.endPick.addEventListener('click', function () { startPick('end'); });
    el.startGps.addEventListener('click', function () { useGps('start'); });
    el.endGps.addEventListener('click', function () { useGps('end'); });

    el.hubChips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-hub]');
      if (!b) return;
      var hub = HUBS[parseInt(b.getAttribute('data-hub'), 10)];
      if (!hub) return;
      if (!state.start) { setEndpoint('start', hub); toast('출발지를 ' + hub.name + '으로 지정했습니다.'); }
      else { setEndpoint('end', hub); toast('도착지를 ' + hub.name + '으로 지정했습니다.'); }
    });

    document.querySelectorAll('.seg-btn[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.seg-btn[data-mode]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.mode = b.getAttribute('data-mode');
        if (state.mode === 'transit') {
          state.radius = 1000;
          document.querySelectorAll('.seg-btn[data-radius]').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-radius') === '1000');
          });
        }
        el.modeHint.textContent = state.mode === 'car'
          ? '도로 경로를 따라 실제 주행 동선을 계산합니다.'
          : '키 없이 동작하는 버전이라 노선·환승 정보가 없습니다. 출발→도착 직선 축과 역·거점을 참고해 고르고, 길찾기는 카드의 지도 앱으로 엽니다.';
        drawHubs();
        updateRoute();
      });
    });

    document.querySelectorAll('.seg-btn[data-radius]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.seg-btn[data-radius]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.radius = parseInt(b.getAttribute('data-radius'), 10);
        renderSummary(); renderList(); renderMarkers();
      });
    });

    el.tierChips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tier]');
      if (!b) return;
      var t = b.getAttribute('data-tier');
      var on = Object.keys(state.tiers).filter(function (k) { return state.tiers[k]; });
      if (state.tiers[t] && on.length === 1) { toast('등급은 최소 한 개는 켜 두어야 합니다.'); return; }
      state.tiers[t] = !state.tiers[t];
      b.classList.toggle('on', state.tiers[t]);
      renderList(); renderMarkers(); renderSummary();
    });

    el.district.addEventListener('change', function () {
      state.district = el.district.value;
      renderList(); renderMarkers();
    });

    el.list.addEventListener('click', function (e) {
      var card = e.target.closest('.card[data-id]');
      if (card) openDetail(card.getAttribute('data-id'));
    });

    el.detail.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close') === '1') { closeDetail(); return; }
      var act = e.target.closest('button[data-act]');
      if (act) {
        var r = state.data.filter(function (x) { return x.id === act.getAttribute('data-id'); })[0];
        if (r) {
          setEndpoint(act.getAttribute('data-act'), { name: r.name, lat: r.lat, lng: r.lng });
          closeDetail();
          toast((act.getAttribute('data-act') === 'start' ? '출발지' : '도착지') + '를 ' + r.name + '으로 지정했습니다.');
        }
      }
    });
    el.detailClose.addEventListener('click', closeDetail);

    el.fitRoute.addEventListener('click', function () {
      if (state.route) fitRoute(); else fitAll();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.detail.hidden) closeDetail();
        else if (state.picking) clearPick();
      }
    });
  }

  function renderHubs() {
    el.hubChips.innerHTML = HUBS.map(function (h, i) {
      return '<button type="button" class="chip" data-hub="' + i + '">' + esc(h.name) + '</button>';
    }).join('');
  }

  /* ── 시작 ─────────────────────────────────────── */
  function init() {
    el = {
      startInput: $('start-input'), endInput: $('end-input'),
      startResults: $('start-results'), endResults: $('end-results'),
      startPick: $('start-pick'), endPick: $('end-pick'),
      startGps: $('start-gps'), endGps: $('end-gps'),
      hubChips: $('hub-chips'), pickNote: $('pick-note'),
      modeHint: $('mode-hint'), tierChips: $('tier-chips'),
      district: $('district-select'), summary: $('route-summary'),
      list: $('rest-list'), resultCount: $('result-count'), sortNote: $('sort-note'),
      detail: $('detail'), detailContent: $('detail-content'), detailClose: $('detail-close'),
      toast: $('toast'), fitRoute: $('fit-route'),
      tierNoteFoot: $('tier-note-foot')
    };

    initMap();
    renderHubs();
    bindEvents();
    bindSearch('start');
    bindSearch('end');
    loadData();

    // 초기 데모: 부평역 → 송도 센트럴파크 (사용자가 바로 결과를 볼 수 있게)
    var ua = (navigator.userAgent || '').toLowerCase();
    if (ua.indexOf('jsdom') < 0) {
      window.setTimeout(function () {
        if (!state.start && !state.end) {
          setEndpoint('start', HUBS[0]);
          setEndpoint('end', HUBS[4]);
        }
      }, 350);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
