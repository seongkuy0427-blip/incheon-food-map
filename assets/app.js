/* 인천 동선 맛집 지도 v2 — 키 없이 동작하는 정적 웹앱 */
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
    local: { label: '로컬', full: '찐후기·백년가게·방송·노포·국민맛집', color: '#0f9d58' },
    custom: { label: '내 맛집', full: '내가 추가한 맛집', color: '#d97706' }
  };

  var DISTRICTS = ['제물포구', '영종구', '미추홀구', '남동구', '연수구', '부평구', '서해구', '검단구', '계양구', '강화군'];
  var MEAL_CATS = ['한식', '중식', '일식', '양식', '해산물', '고기', '면·분식'];
  var ALL_CATS = MEAL_CATS.concat(['카페·디저트']);
  var LS_CUSTOM = 'incheonFoodMap.custom.v1';
  var LS_HIDDEN = 'incheonFoodMap.hidden.v1';

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
    base: [],
    custom: [],
    data: [],
    hidden: [],
    meta: {},
    start: null,
    end: null,
    mode: 'route',          /* route | district */
    travel: 'car',
    radius: 1000,
    foodGroup: 'all',       /* all | meal | cafe */
    cats: [],               /* 선택한 식사 세부 업종 */
    tiers: { michelin: true, blueribbon: true, local: true, custom: true },
    district: 'all',
    route: null,
    picking: null,          /* start | end | custom */
    selected: null,
    loading: false
  };

  var map, layerRest, layerRoute, layerHubs;
  var markers = {};
  var zoomTimer = null;
  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  var toastTimer = null;

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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, ms || 2800);
  }

  function storeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 */ }
  }

  function isHidden(r) { return state.hidden.indexOf(r.id) >= 0; }

  function mapSearchUrl(base, name) {
    return base + encodeURIComponent(name);
  }

  /* ── 경로 투영: 수직 최단거리 + 진행거리 ───────── */
  function projectToLine(pt, line) {
    var kx = 111320 * Math.cos(pt[0] * Math.PI / 180), ky = 110540;
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
    if (line.length === 1) best = { dist: haversine(pt, line[0]), along: 0 };
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
    window.__map = map;

    map.on('click', function (e) { handleMapClick(e.latlng); });
    map.on('zoomend', function () {
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(function () { if (state.data.length) renderMarkers(); }, 160);
    });
  }

  function pinIcon(tier, selected) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin ' + tier + (selected ? ' sel' : '') + '"><i></i></div>',
      iconSize: selected ? [28, 28] : [20, 20],
      iconAnchor: selected ? [14, 28] : [10, 20]
    });
  }

  function hubIcon(name) {
    return L.divIcon({
      className: 'hub-marker',
      html: '<span class="hub-pin"></span><span class="hub-label">' + esc(name) + '</span>',
      iconSize: [140, 18],
      iconAnchor: [5, 9]
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
        state.base = json.restaurants || [];
        state.meta = json.meta || {};
        state.custom = normalizeCustom(storeGet(LS_CUSTOM, []));
        state.hidden = storeGet(LS_HIDDEN, []);
        if (!Array.isArray(state.hidden)) state.hidden = [];
        syncData();
        state.loading = false;
        buildDistrictOptions();
        renderTierChips();
        renderFootNotes();
        renderList();
        renderMarkers();
        if (state.mode === 'district') fitDistrict(); else if (state.route) fitRouteView(); else fitAll();
        updateCustomCount();
        renderHiddenLine();
        el.brandCount.textContent = state.data.length;
      })
      .catch(function (err) {
        state.loading = false;
        el.list.innerHTML = '<div class="empty">맛집 데이터를 불러오지 못했습니다.<br>' +
          '잠시 후 새로고침해 주세요.<br><span style="font-size:11px;color:#a1a1aa">(' + esc(err.message) + ')</span></div>';
        toast('데이터를 불러오지 못했습니다.');
      });
  }

  function normalizeCustom(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (r) {
      return r && r.name && isFinite(r.lat) && isFinite(r.lng) && !isNaN(r.lat) && !isNaN(r.lng);
    }).map(function (r) {
      r.tier = 'custom';
      r.tierLabel = r.tierLabel || '내 맛집';
      r.tierNote = r.tierNote || '내가 직접 추가한 맛집.';
      r.region = r.region || '인천';
      if (!r.id) r.id = 'custom-' + Math.abs(hash(r.name + r.lat + r.lng));
      r._custom = true;
      return r;
    });
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }

  function syncData() {
    state.data = state.base.concat(state.custom);
    state.data.forEach(function (r) {
      if (ALL_CATS.indexOf(r.category) < 0) {
        r.category = r.tier === 'custom' ? '한식' : '한식';
      }
      r.categoryGroup = r.category === '카페·디저트' ? 'cafe' : 'meal';
    });
  }

  function saveCustom() {
    storeSet(LS_CUSTOM, state.custom);
    updateCustomCount();
  }

  function saveHidden() {
    storeSet(LS_HIDDEN, state.hidden);
    renderHiddenLine();
  }

  function buildDistrictOptions() {
    var counts = {};
    state.data.forEach(function (r) {
      if (!isHidden(r)) counts[r.district] = (counts[r.district] || 0) + 1;
    });
    var names = Object.keys(counts).sort(function (a, b) {
      var ia = DISTRICTS.indexOf(a), ib = DISTRICTS.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib;
    });
    var html = '<option value="all">전체 지역구 · ' + Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0) + '곳</option>';
    names.forEach(function (n) {
      html += '<option value="' + esc(n) + '">' + esc(n) + ' · ' + counts[n] + '곳</option>';
    });
    el.district.innerHTML = html;
    if (state.district !== 'all' && names.indexOf(state.district) < 0) state.district = 'all';
    el.district.value = state.district;
  }

  function renderTierChips() {
    var counts = { michelin: 0, blueribbon: 0, local: 0, custom: 0 };
    var catCounts = { meal: 0, cafe: 0 };
    state.data.forEach(function (r) {
      if (isHidden(r)) return;
      if (counts[r.tier] != null) counts[r.tier]++;
      catCounts[r.categoryGroup === 'cafe' ? 'cafe' : 'meal']++;
    });
    var html = '';
    Object.keys(TIERS).forEach(function (t) {
      html += '<button type="button" class="chip' + (state.tiers[t] ? ' on' : '') + '" data-tier="' + t + '" aria-pressed="' + state.tiers[t] + '">' +
        '<span class="i-dot ' + t + '"></span>' + TIERS[t].label + ' ' + counts[t] + '</button>';
    });
    el.tierChips.innerHTML = html;
    if (el.catCount) el.catCount.textContent = '식사 ' + catCounts.meal + ' · 카페 ' + catCounts.cafe;
    renderCatChips();
  }

  function renderCatChips() {
    if (!el.catChips) return;
    el.catChips.hidden = state.foodGroup === 'cafe';
    var html = '<button type="button" class="chip' + (state.cats.length ? '' : ' on') + '" data-cat="all">전체</button>';
    MEAL_CATS.forEach(function (c) {
      html += '<button type="button" class="chip' + (state.cats.indexOf(c) >= 0 ? ' on' : '') + '" data-cat="' + esc(c) + '" aria-pressed="' + (state.cats.indexOf(c) >= 0) + '">' + esc(c) + '</button>';
    });
    el.catChips.innerHTML = html;
    document.querySelectorAll('.seg-btn[data-group]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-group') === state.foodGroup);
    });
  }

  function renderFootNotes() {
    var counts = { michelin: 0, blueribbon: 0, local: 0, custom: 0 };
    state.data.forEach(function (r) {
      if (!isHidden(r) && counts[r.tier] != null) counts[r.tier]++;
    });
    var total = state.data.length - state.hidden.length;
    var labelCounts = {};
    state.data.forEach(function (r) {
      if (isHidden(r)) return;
      labelCounts[r.tierLabel || TIERS[r.tier].label] = (labelCounts[r.tierLabel || TIERS[r.tier].label] || 0) + 1;
    });
    var localBreak = Object.keys(labelCounts).filter(function (k) {
      return ['미쉐린 스타 브랜드', '미쉐린 스타 출신 셰프', '블루리본', '내 맛집'].indexOf(k) < 0;
    }).map(function (k) { return k + ' ' + labelCounts[k]; }).join(' · ');
    el.tierNoteFoot.innerHTML = '<b>수록 ' + total + '곳</b> · 미쉐린 ' + counts.michelin +
      ' · 블루리본 ' + counts.blueribbon +
      (counts.custom ? ' · 내 맛집 ' + counts.custom : '') +
      (state.meta.updated ? ' · 기준일 ' + state.meta.updated : '') +
      (state.hidden.length ? ' · 숨김 ' + state.hidden.length : '') + '<br>' +
      (localBreak ? '로컬: ' + localBreak + '<br>' : '');
    if (state.meta.tierNote) el.tierNoteFoot.innerHTML += esc(state.meta.tierNote);
    if (state.meta.districtNote) el.tierNoteFoot.innerHTML += '<br>' + esc(state.meta.districtNote);
  }

  function renderHiddenLine() {
    if (!el.hiddenLine) return;
    if (!state.hidden.length) { el.hiddenLine.hidden = true; return; }
    el.hiddenLine.hidden = false;
    el.hiddenNote.textContent = '숨긴 가게 ' + state.hidden.length + '곳';
    el.hiddenRestore.textContent = '복원';
  }

  function updateCustomCount() {
    if (!el.customCount) return;
    el.customCount.textContent = state.custom.length ? '내 맛집 ' + state.custom.length + '곳 저장됨' : '아직 저장한 내 맛집이 없습니다';
  }

  /* ── 검색 (출발/도착) ─────────────────────────── */
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

  function nominatim(q, opts) {
    var cfg = REGIONS[state.region];
    var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=ko' +
      '&countrycodes=kr&q=' + encodeURIComponent(q) + '&viewbox=' + cfg.viewbox.join(',');
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (arr) {
        return (arr || []).map(function (it) {
          return {
            name: (it.display_name || '').split(',').slice(0, 2).join(', '),
            lat: parseFloat(it.lat), lng: parseFloat(it.lon),
            meta: (it.display_name || '').split(',').slice(2, 4).join(', '),
            address: it.display_name || '',
            district: districtFromNominatim(it.address || {})
          };
        });
      })
      .catch(function () { return []; });
  }

  function districtFromNominatim(a) {
    var pool = [a.city_district, a.borough, a.county, a.suburb, a.city, a.state].filter(Boolean).join(' ');
    for (var i = 0; i < DISTRICTS.length; i++) {
      if (pool.indexOf(DISTRICTS[i]) >= 0) return DISTRICTS[i];
    }
    if (pool.indexOf('중구') >= 0) return '제물포구';
    if (pool.indexOf('동구') >= 0) return '제물포구';
    if (pool.indexOf('서구') >= 0) return '서해구';
    if (pool.indexOf('남구') >= 0) return '미추홀구';
    return '';
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
      if (e.key === 'Escape') box.hidden = true;
    });

    input.addEventListener('blur', function () {
      setTimeout(function () { box.hidden = true; }, 160);
    });
  }

  /* ── 출발/도착 ─────────────────────────────────── */
  function setEndpoint(kind, place) {
    var p = { name: place.name, lat: place.lat, lng: place.lng };
    if (kind === 'start') { state.start = p; el.startInput.value = p.name; }
    else { state.end = p; el.endInput.value = p.name; }
    clearPick();
    if (state.start && state.end && state.mode !== 'route') setMode('route', true);
    updateRoute();
  }

  function handleMapClick(latlng) {
    if (!state.picking) return;
    if (state.picking === 'custom') {
      state.picking = null;
      document.querySelector('.map-wrap').classList.remove('picking');
      el.pickNote.hidden = true;
      fillAddLocation(latlng.lat, latlng.lng, '');
      toast('지도에서 위치를 찍었습니다. 가게 정보를 채워 주세요.');
      return;
    }
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
      setEndpoint(kind, { name: '현재 위치', lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    state.routeSeq = (state.routeSeq || 0) + 1;
    var seq = state.routeSeq;
    if (state.travel === 'car') {
      osrmRoute(a, b)
        .then(function (route) { if (seq === state.routeSeq) applyRoute(route); })
        .catch(function () { if (seq === state.routeSeq) applyRoute(straightFallback(a, b)); });
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
    if (state.mode === 'route') fitRouteView();
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
    if (state.travel !== 'transit') return;
    HUBS.forEach(function (h) {
      L.marker([h.lat, h.lng], {
        icon: hubIcon(h.name), interactive: false, keyboard: false, zIndexOffset: -500
      }).addTo(layerHubs);
    });
  }

  function fitRouteView() {
    if (!state.route || state.route.line.length < 2) {
      if (state.start && state.end) {
        map.fitBounds(L.latLngBounds([[state.start.lat, state.start.lng], [state.end.lat, state.end.lng]]), { padding: [60, 60] });
      }
      return;
    }
    var b = L.latLngBounds(state.route.line);
    visible().forEach(function (rec) { b.extend([rec.r.lat, rec.r.lng]); });
    map.fitBounds(b, { padding: [46, 46] });
  }

  function fitAll() {
    var rows = state.data.filter(function (r) { return !isHidden(r); });
    if (!rows.length) return;
    map.fitBounds(L.latLngBounds(rows.map(function (r) { return [r.lat, r.lng]; })), { padding: [30, 30] });
  }

  function fitDistrict() {
    var rows = state.data.filter(function (r) {
      return !isHidden(r) && (state.district === 'all' || r.district === state.district);
    });
    if (!rows.length) { toast('이 지역구에 표시할 맛집이 없습니다.'); return; }
    map.fitBounds(L.latLngBounds(rows.map(function (r) { return [r.lat, r.lng]; })), { padding: [40, 40], maxZoom: 15 });
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

  function tierOn(r) { return !!state.tiers[r.tier]; }

  function visible() {
    var all = computed();
    var out = all.filter(function (rec) {
      var r = rec.r;
      if (isHidden(r)) return false;
      if (!tierOn(r)) return false;
      if (state.foodGroup === 'cafe' && r.categoryGroup !== 'cafe') return false;
      if (state.foodGroup === 'meal' && r.categoryGroup === 'cafe') return false;
      if (state.foodGroup !== 'cafe' && state.cats.length && state.cats.indexOf(r.category) < 0) return false;
      if (state.mode === 'district') {
        return state.district === 'all' || r.district === state.district;
      }
      if (state.route && state.radius > 0) {
        if (rec.dist == null || rec.dist > state.radius) return false;
      }
      return true;
    });
    if (state.mode === 'route' && state.route) {
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
    updateFiltersSummary();
    var rows = visible();
    el.resultCount.textContent = rows.length + '곳';
    el.listTitle.textContent = state.mode === 'district'
      ? (state.district === 'all' ? '지역구 전체 맛집' : state.district + ' 맛집')
      : '동선 위 맛집';
    el.sortNote.textContent = state.mode === 'route'
      ? (state.route ? (state.travel === 'car' ? '출발→도착 순' : '축 진행 순') : '')
      : '이름 순';
    if (!rows.length) {
      el.list.innerHTML = '<div class="empty">조건에 맞는 맛집이 없습니다.<br>' +
        (state.mode === 'district' ? '다른 지역구를 골라 보세요.' : '반경을 넓히거나 등급 필터를 풀어 보세요.') + '</div>';
      return;
    }
    el.list.innerHTML = rows.map(function (rec, i) {
      var r = rec.r;
      var distTxt = (state.mode !== 'route' || rec.dist == null) ? '' : '경로에서 ' + fmtDist(rec.dist);
      return '<button type="button" class="card' + (state.selected === r.id ? ' sel' : '') + '" data-id="' + esc(r.id) + '">' +
        '<span class="card-top"><span class="card-order">' + (i + 1) + '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' + badge(r.tier, r.tierLabel || TIERS[r.tier].label) + '</span>' +
        '<span class="card-meta">' + esc(r.district) + ' · ' + esc(r.category) +
        (distTxt ? ' <span class="card-dist">' + distTxt + '</span>' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function renderMarkers() {
    layerRest.eachLayer(function (m) {
      if (m.unbindTooltip) m.unbindTooltip();
    });
    layerRest.clearLayers();
    markers = {};
    var rows = visible();
    var labelIds = labelPlan(rows);
    rows.forEach(function (rec) {
      var r = rec.r;
      var selected = state.selected === r.id;
      var m = L.marker([r.lat, r.lng], {
        icon: pinIcon(r.tier, selected),
        title: r.name,
        zIndexOffset: selected ? 1000 : 0
      });
      m.bindTooltip(esc(r.name), {
        permanent: selected || !!labelIds[r.id],
        direction: 'right',
        offset: [11, 0],
        className: 'rest-tip' + (selected ? ' sel' : ''),
        opacity: 1
      });
      m.on('click', function () { openDetail(r.id); });
      m.addTo(layerRest);
      markers[r.id] = m;
    });
  }

  /* 화면에서 겹치지 않는 선에서 가게 이름 라벨을 고른다 */
  function labelPlan(rows) {
    var out = {};
    if (!map || !rows.length) return out;
    var boxes = [];
    var pins = [];
    var maxLabels = 34;
    var placed = 0;
    rows.forEach(function (rec) {
      var p = map.latLngToContainerPoint([rec.r.lat, rec.r.lng]);
      pins.push([p.x - 10, p.y - 22, p.x + 10, p.y + 2]);
    });
    for (var i = 0; i < rows.length && placed < maxLabels; i++) {
      var r = rows[i].r;
      if (state.selected === r.id) continue;
      var pt = map.latLngToContainerPoint([r.lat, r.lng]);
      if (pt.x < -40 || pt.y < -20 || pt.x > map.getSize().x + 20 || pt.y > map.getSize().y + 20) continue;
      var w = Math.min(210, r.name.length * 9.8 + 16);
      var box = [pt.x + 12, pt.y - 13, pt.x + 12 + w, pt.y + 13];
      var hit = false;
      var all = boxes.concat(pins);
      for (var j = 0; j < all.length; j++) {
        var b = all[j];
        if (!(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) { hit = true; break; }
      }
      if (hit) continue;
      boxes.push(box);
      out[r.id] = true;
      placed++;
    }
    return out;
  }

  function updateFiltersSummary() {
    if (!el.filtersSummary) return;
    var tierCount = Object.keys(state.tiers).filter(function (t) { return state.tiers[t]; }).length;
    var parts = [];
    if (state.mode === 'district') {
      parts.push(state.district === 'all' ? '지역구 전체' : state.district);
    } else {
      parts.push(state.travel === 'car' ? '자동차' : '대중교통');
      parts.push(state.radius > 0 ? '반경 ' + fmtDist(state.radius) : '반경 전체');
    }
    if (state.foodGroup === 'cafe') parts.push('카페·디저트');
    else if (state.cats.length) parts.push(state.cats.join('·'));
    else if (state.foodGroup === 'meal') parts.push('식사');
    parts.push(tierCount === 4 ? '등급 전체' : '등급 ' + tierCount + '종');
    el.filtersSummary.textContent = parts.join(' · ');
  }

  function renderSummary(msg) {
    if (msg) { el.summary.innerHTML = esc(msg); return; }
    if (state.mode === 'district') {
      var n = visible().length;
      el.summary.innerHTML =
        '<b>📍 ' + esc(state.district === 'all' ? '인천 전체' : state.district) + '</b> 맛집 <b>' + n + '곳</b><br>' +
        '동선과 상관없이 이 지역의 맛집을 모두 표시합니다.' +
        (state.district === 'all' ? '<br><span class="note">지역구를 고르면 지도가 그 동네로 이동합니다.</span>' : '');
      return;
    }
    if (!state.start || !state.end) {
      el.summary.textContent = '출발지와 도착지를 정해 주세요. 위 칩을 누르거나 검색, 지도 클릭으로 지정할 수 있습니다.';
      return;
    }
    var route = state.route;
    if (!route) return;
    var cnt = visible().length;
    var radiusTxt = state.radius > 0 ? '반경 ' + fmtDist(state.radius) + ' 내' : '경로 주변';
    var modeTxt = route.kind === 'road' ? '자동차 도로 기준' :
      (state.travel === 'transit' ? '대중교통 근사 축' : '직선 폴백');
    var durTxt = route.duration ? ' · 약 ' + fmtDur(route.duration) : '';
    el.summary.innerHTML =
      '<b>' + esc(state.start.name) + '</b> → <b>' + esc(state.end.name) + '</b><br>' +
      fmtDist(route.distance) + durTxt + ' · ' + modeTxt + '<br>' +
      radiusTxt + ' 맛집 <b>' + cnt + '곳</b> · 지역구 구분 없이 표시' +
      (state.travel === 'transit' ? '<br><span class="note">대중교통 노선·환승 정보는 제공되지 않아 출발→도착을 잇는 직선 축과 주요 역·거점으로 표시합니다. 실제 경로는 카드의 지도 앱을 이용하세요.</span>' : '') +
      (route.kind === 'straight' && state.travel === 'car' ? '<br><span class="err">경로 서버 응답이 없어 직선으로 표시했습니다.</span>' : '');
  }

  /* ── 상세 ─────────────────────────────────────── */
  function focusRestaurant(r) {
    if (!map) return;
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    var z = Math.max(map.getZoom(), 16);
    var size = map.getSize();
    var pt = map.project([r.lat, r.lng], z);
    var dx = 0, dy = 0;
    if (narrow) {
      dy = Math.round(size.y * 0.30);
    } else {
      dx = Math.round(Math.min(235, size.x * 0.22));
    }
    var center = map.unproject(pt.add([dx, dy]), z);
    map.flyTo(center, z, { duration: 0.6 });
  }

  function openDetail(id) {
    var r = state.data.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    state.selected = id;
    var rec = computed().filter(function (x) { return x.r.id === id; })[0];
    var distLine = rec && rec.dist != null ? '경로에서 ' + fmtDist(rec.dist) : '경로 미지정';

    var menus = (r.menus || []).length ? (r.menus || []).map(function (m) {
      return '<li><span>' + esc(m.name) + '</span><span class="p">' + esc(m.price) + '</span></li>';
    }).join('') : '<li><span>대표 메뉴는 매장에서 확인</span><span class="p">—</span></li>';

    var html = '' +
      '<div class="d-head">' + badge(r.tier, r.tierLabel || TIERS[r.tier].label) + '</div>' +
      '<h2 class="d-title" id="detail-title">' + esc(r.name) + '</h2>' +
      '<p class="d-meta">' + esc(r.category) + ' · ' + esc(r.district) +
      (r.districtOld && r.districtOld !== r.district ? '(' + esc(r.districtOld) + ')' : '') +
      ' ' + esc(r.dong || '') + '</p>' +
      '<div class="d-stats">' +
      '<div class="d-stat">' + (state.mode === 'route' ? '동선 이탈' : '동선') + '<b>' + (state.mode === 'route' && rec && rec.dist != null ? fmtDist(rec.dist) : '—') + '</b></div>' +
      '<div class="d-stat">영업<b>' + esc(r.hours || '매장 확인') + '</b></div>' +
      '<div class="d-stat">휴무<b>' + esc(r.closed || '매장 확인') + '</b></div>' +
      '</div>' +
      '<div class="d-sec"><h3>주소</h3><p>' + esc(r.address) + '</p></div>' +
      '<div class="d-sec"><h3>대표 메뉴</h3><ul class="menu-list">' + menus + '</ul></div>' +
      (r.reviewSummary ? '<div class="d-sec"><h3>후기 요약</h3><p>' + esc(r.reviewSummary) + '</p></div>' : '') +
      (r.tips ? '<div class="d-sec"><h3>이용 팁</h3><p>' + esc(r.tips) + '</p></div>' : '') +
      (r.phone ? '<div class="d-sec"><h3>전화</h3><p>' + esc(r.phone) + '</p></div>' : '') +
      (r.tierNote ? '<div class="d-tienote"><b>등급 근거</b> ' + esc(r.tierNote) + '</div>' : '') +
      '<div class="d-actions">' +
      '<button class="btn" type="button" data-act="start" data-id="' + esc(r.id) + '">출발지로</button>' +
      '<button class="btn" type="button" data-act="end" data-id="' + esc(r.id) + '">도착지로</button>' +
      '</div>' +
      '<div class="d-links">길찾기 <a href="' + esc(r.naverMapUrl) + '" target="_blank" rel="noopener">네이버지도</a>' +
      '<span class="dot">·</span><a href="' + esc(r.kakaoMapUrl) + '" target="_blank" rel="noopener">카카오맵</a></div>' +
      '<div class="d-foot-row">' +
      '<button class="link-btn danger" type="button" data-act="hide" data-id="' + esc(r.id) + '">🙈 내 지도에서 숨기기</button>' +
      (r._custom ? '<button class="link-btn danger" type="button" data-act="delete" data-id="' + esc(r.id) + '">🗑 삭제</button>' : '') +
      '</div>' +
      '<p class="d-meta" style="margin-top:12px">' + esc(distLine) + '</p>';

    el.detailContent.innerHTML = html;
    el.detail.hidden = false;
    document.body.style.overflow = 'hidden';

    renderMarkers();
    renderList();
    focusRestaurant(r);
  }

  function closeDetail() {
    el.detail.hidden = true;
    document.body.style.overflow = '';
    state.selected = null;
    renderMarkers();
    renderList();
  }

  /* ── 내 맛집 추가 ─────────────────────────────── */
  var addState = { lat: null, lng: null, address: '' };

  function openAddModal() {
    addState = { lat: null, lng: null, address: '' };
    el.addName.value = '';
    el.addCat.value = '한식';
    el.addMenu.value = '';
    el.addMemo.value = '';
    el.addAddress.value = '';
    el.addSearch.value = '';
    el.addDistrict.value = '';
    el.addResults.hidden = true;
    el.addCoord.textContent = '위치를 검색하거나 지도에서 찍어 주세요.';
    el.addCoord.classList.remove('ok');
    el.addModal.hidden = false;
    document.body.style.overflow = 'hidden';
    updateCustomCount();
    setTimeout(function () { el.addSearch.focus(); }, 60);
  }

  function closeAddModal() {
    el.addModal.hidden = true;
    if (el.detail.hidden) document.body.style.overflow = '';
  }

  function fillAddLocation(lat, lng, address) {
    addState.lat = lat; addState.lng = lng;
    if (address) addState.address = address;
    el.addAddress.value = addState.address || '';
    el.addCoord.textContent = '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
    el.addCoord.classList.add('ok');
    var guess = districtFromNominatim({});
    if (address) {
      for (var i = 0; i < DISTRICTS.length; i++) {
        if (address.indexOf(DISTRICTS[i]) >= 0) { guess = DISTRICTS[i]; break; }
      }
      if (!guess) {
        if (address.indexOf('중구') >= 0) guess = '제물포구';
        else if (address.indexOf('동구') >= 0) guess = '제물포구';
        else if (address.indexOf('서구') >= 0) guess = '서해구';
      }
    }
    if (guess && !el.addDistrict.value) el.addDistrict.value = guess;
    closeAddModal();
    el.addModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function reverseGeocode(lat, lng) {
    var url = 'https://nominatim.openstreetmap.org/reverse?format=json&accept-language=ko&lat=' + lat + '&lon=' + lng;
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return { address: '', district: '' };
        return { address: j.display_name || '', district: districtFromNominatim(j.address || {}) };
      })
      .catch(function () { return { address: '', district: '' }; });
  }

  function runAddSearch() {
    var q = el.addSearch.value.trim();
    if (!q) return;
    el.addResults.hidden = false;
    el.addResults.innerHTML = '<div class="r-empty">검색 중…</div>';
    nominatim(q).then(function (items) {
      if (!items.length) {
        el.addResults.innerHTML = '<div class="r-empty">검색 결과가 없습니다. 지도에서 직접 위치를 찍어 주세요.</div>';
        return;
      }
      el.addResults.innerHTML = items.map(function (it, i) {
        return '<button type="button" data-i="' + i + '"><span class="r-name">' + esc(it.name) +
          '</span><span class="r-meta">' + esc(it.address || it.meta || '') + '</span></button>';
      }).join('');
      el.addResults._items = items;
    });
  }

  function pickFromSearch(i) {
    var it = (el.addResults._items || [])[i];
    if (!it) return;
    addState.lat = it.lat; addState.lng = it.lng;
    addState.address = it.address || it.name;
    el.addCoord.textContent = '📍 ' + it.lat.toFixed(5) + ', ' + it.lng.toFixed(5);
    el.addCoord.classList.add('ok');
    el.addAddress.value = addState.address;
    if (!el.addName.value) {
      el.addName.value = (it.name || '').split(',')[0].split('(')[0].trim();
    }
    if (it.district) el.addDistrict.value = it.district;
    el.addResults.hidden = true;
  }

  function saveCustomRestaurant() {
    var name = el.addName.value.trim();
    if (!name) { toast('가게명을 입력해 주세요.'); el.addName.focus(); return; }
    if (addState.lat == null || addState.lng == null) { toast('위치를 검색하거나 지도에서 찍어 주세요.'); return; }
    var district = el.addDistrict.value;
    if (!district) { toast('지역구를 골라 주세요.'); el.addDistrict.focus(); return; }
    var cat = el.addCat.value || '한식';
    var menuText = el.addMenu.value.trim();
    var memo = el.addMemo.value.trim();
    var rec = {
      id: 'custom-' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      name: name,
      region: '인천',
      district: district,
      districtOld: district,
      dong: '',
      tier: 'custom',
      tierLabel: '내 맛집',
      tierNote: '내가 직접 추가한 맛집입니다. 이 기기의 브라우저에 저장됩니다.',
      category: cat,
      categoryGroup: cat === '카페·디저트' ? 'cafe' : 'meal',
      address: el.addAddress.value.trim() || ('인천광역시 ' + district + ' (좌표 지정)'),
      lat: addState.lat,
      lng: addState.lng,
      menus: menuText ? menuText.split(/\s*\/\s*/).filter(Boolean).map(function (s) {
        return { name: s, price: '' };
      }) : [],
      reviewSummary: memo ? '내 메모: ' + memo : '내가 직접 추가한 맛집입니다.',
      tips: '',
      phone: '',
      hours: '매장 확인',
      closed: '매장 확인',
      naverMapUrl: mapSearchUrl('https://map.naver.com/p/search/', name),
      kakaoMapUrl: mapSearchUrl('https://map.kakao.com/link/search/', name),
      _custom: true
    };
    state.custom.push(rec);
    saveCustom();
    state.tiers.custom = true;
    syncData();
    closeAddModal();
    buildDistrictOptions();
    renderTierChips();
    renderFootNotes();
    setMode('district', true);
    state.district = district;
    el.district.value = district;
    renderList();
    renderMarkers();
    renderSummary();
    fitDistrict();
    openDetail(rec.id);
    toast('⭐ ' + name + '을(를) 내 맛집에 저장했습니다.');
  }

  function deleteCustom(id) {
    var r = state.custom.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (!window.confirm('"' + r.name + '"을(를) 내 맛집에서 삭제할까요?')) return;
    state.custom = state.custom.filter(function (x) { return x.id !== id; });
    saveCustom();
    syncData();
    closeDetail();
    buildDistrictOptions();
    renderTierChips();
    renderFootNotes();
    renderList();
    renderMarkers();
    renderSummary();
    toast('삭제했습니다.');
  }

  function hideRestaurant(id) {
    var r = state.data.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (state.hidden.indexOf(id) < 0) state.hidden.push(id);
    saveHidden();
    closeDetail();
    buildDistrictOptions();
    renderTierChips();
    renderFootNotes();
    renderList();
    renderMarkers();
    renderSummary();
    toast('🙈 ' + r.name + '을(를) 지도에서 숨겼습니다. 필터의 "숨긴 가게 복원"으로 되살릴 수 있습니다.', 3600);
  }

  function restoreHidden() {
    var n = state.hidden.length;
    if (!n) return;
    state.hidden = [];
    saveHidden();
    buildDistrictOptions();
    renderTierChips();
    renderFootNotes();
    renderList();
    renderMarkers();
    renderSummary();
    toast(n + '곳을 다시 표시합니다.');
  }

  function exportCustom() {
    var payload = {
      app: 'incheon-food-map', version: 2, exportedAt: new Date().toISOString(),
      custom: state.custom, hidden: state.hidden
    };
    var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    a.href = URL.createObjectURL(blob);
    a.download = 'incheon-food-map-내맛집-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('내 맛집 ' + state.custom.length + '곳을 백업 파일로 내려받았습니다.');
  }

  function importCustom(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); } catch (e) {
        toast('JSON 파일을 읽을 수 없습니다.'); return;
      }
      var list = Array.isArray(data) ? data : (data && data.custom);
      if (!Array.isArray(list)) { toast('내 맛집 형식이 아닙니다.'); return; }
      var added = 0;
      var byId = {};
      state.custom.forEach(function (r) { byId[r.id] = r; });
      normalizeCustom(list).forEach(function (r) {
        if (byId[r.id]) return;
        state.custom.push(r); byId[r.id] = r; added++;
      });
      if (data && Array.isArray(data.hidden)) {
        data.hidden.forEach(function (id) {
          if (state.hidden.indexOf(id) < 0) state.hidden.push(id);
        });
        storeSet(LS_HIDDEN, state.hidden);
      }
      saveCustom();
      syncData();
      buildDistrictOptions();
      renderTierChips();
      renderFootNotes();
      renderList();
      renderMarkers();
      renderSummary();
      toast(added + '곳을 불러왔습니다. (내 맛집 ' + state.custom.length + '곳)');
    };
    reader.readAsText(file);
  }

  /* ── 모드 ─────────────────────────────────────── */
  function setMode(mode, silent) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-mode-block]').forEach(function (b) {
      b.hidden = b.getAttribute('data-mode-block') !== mode;
    });
    if (mode === 'district') {
      layerRoute.clearLayers();
      el.district.value = state.district;
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitDistrict();
    } else {
      drawRoute(state.route);
      drawHubs();
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent && state.route) fitRouteView();
    }
    updateFiltersSummary();
  }

  /* ── 이벤트 ───────────────────────────────────── */
  function bindEvents() {
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });

    el.addOpen.addEventListener('click', openAddModal);
    var addOpen2 = $('add-open-2');
    if (addOpen2) addOpen2.addEventListener('click', openAddModal);
    el.addClose.addEventListener('click', closeAddModal);
    el.addCancel.addEventListener('click', closeAddModal);
    el.addSave.addEventListener('click', saveCustomRestaurant);
    el.addSearchBtn.addEventListener('click', runAddSearch);
    el.addSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runAddSearch(); }
    });
    el.addResults.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) pickFromSearch(parseInt(b.getAttribute('data-i'), 10));
    });
    el.addPick.addEventListener('click', function () {
      state.picking = 'custom';
      closeAddModal();
      document.querySelector('.map-wrap').classList.add('picking');
      el.pickNote.hidden = false;
      el.pickNote.innerHTML = '지도를 클릭해 <b>내 맛집 위치</b>를 찍으세요. (Esc로 취소)';
      toast('지도를 클릭해 위치를 찍으세요.');
    });
    el.exportBtn.addEventListener('click', exportCustom);
    el.importBtn.addEventListener('click', function () { el.importFile.click(); });
    el.importFile.addEventListener('change', function () {
      if (el.importFile.files && el.importFile.files[0]) importCustom(el.importFile.files[0]);
      el.importFile.value = '';
    });
    el.hiddenRestore.addEventListener('click', restoreHidden);

    if (el.filtersToggle) {
      el.filtersToggle.addEventListener('click', function () {
        var open = el.filters.classList.toggle('open');
        el.filtersToggle.classList.toggle('open', open);
        el.filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
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

    document.querySelectorAll('.seg-btn[data-travel]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.seg-btn[data-travel]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.travel = b.getAttribute('data-travel');
        if (state.travel === 'transit') {
          state.radius = 1000;
          document.querySelectorAll('.seg-btn[data-radius]').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-radius') === '1000');
          });
        }
        el.modeHint.textContent = state.travel === 'car'
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
        if (state.route) fitRouteView();
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
      b.setAttribute('aria-pressed', state.tiers[t] ? 'true' : 'false');
      renderList(); renderMarkers(); renderSummary(); updateFiltersSummary();
    });

    document.querySelectorAll('.seg-btn[data-group]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.foodGroup = b.getAttribute('data-group');
        state.cats = [];
        renderCatChips();
        renderList(); renderMarkers(); renderSummary(); updateFiltersSummary();
        if (state.mode === 'district') fitDistrict();
        else if (state.route) fitRouteView();
      });
    });

    el.catChips.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cat]');
      if (!b) return;
      var c = b.getAttribute('data-cat');
      if (c === 'all') state.cats = [];
      else {
        var i = state.cats.indexOf(c);
        if (i >= 0) state.cats.splice(i, 1); else state.cats.push(c);
      }
      renderCatChips();
      renderList(); renderMarkers(); renderSummary(); updateFiltersSummary();
      if (state.mode === 'district') fitDistrict();
      else if (state.route) fitRouteView();
    });

    el.district.addEventListener('change', function () {
      state.district = el.district.value;
      if (state.mode !== 'district') setMode('district', true);
      renderSummary();
      renderList();
      renderMarkers();
      fitDistrict();
    });

    el.list.addEventListener('click', function (e) {
      var card = e.target.closest('.card[data-id]');
      if (card) openDetail(card.getAttribute('data-id'));
    });

    el.detail.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close') === '1') { closeDetail(); return; }
      var act = e.target.closest('button[data-act]');
      if (!act) return;
      var id = act.getAttribute('data-id');
      var kind = act.getAttribute('data-act');
      var r = state.data.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      if (kind === 'hide') { hideRestaurant(id); return; }
      if (kind === 'delete') { deleteCustom(id); return; }
      if (kind === 'start' || kind === 'end') {
        setEndpoint(kind, { name: r.name, lat: r.lat, lng: r.lng });
        closeDetail();
        toast((kind === 'start' ? '출발지' : '도착지') + '를 ' + r.name + '으로 지정했습니다.');
      }
    });
    el.detailClose.addEventListener('click', closeDetail);

    el.fitRoute.addEventListener('click', function () {
      if (state.mode === 'district') fitDistrict();
      else if (state.route) fitRouteView();
      else fitAll();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.addModal.hidden) { closeAddModal(); return; }
      if (!el.detail.hidden) { closeDetail(); return; }
      if (state.picking === 'custom') {
        state.picking = null;
        document.querySelector('.map-wrap').classList.remove('picking');
        el.pickNote.hidden = true;
        openAddModal();
      } else if (state.picking) {
        clearPick();
      }
    });

    /* 모달 배경 클릭 */
    el.addModal.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close') === '1') closeAddModal();
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
      catChips: $('cat-chips'), catCount: $('cat-count'),
      district: $('district-select'), districtCount: $('district-count'),
      summary: $('route-summary'),
      list: $('rest-list'), listTitle: $('list-title'), resultCount: $('result-count'), sortNote: $('sort-note'),
      detail: $('detail'), detailContent: $('detail-content'), detailClose: $('detail-close'),
      toast: $('toast'), fitRoute: $('fit-route'),
      filters: $('filters'), filtersToggle: $('filters-toggle'), filtersSummary: $('filters-summary'),
      tierNoteFoot: $('tier-note-foot'), brandCount: $('brand-count'),
      hiddenLine: $('hidden-line'), hiddenNote: $('hidden-note'), hiddenRestore: $('hidden-restore'),
      addOpen: $('add-open'), addModal: $('add-modal'), addClose: $('add-close'), addCancel: $('add-cancel'),
      addSearch: $('add-search'), addSearchBtn: $('add-search-btn'), addResults: $('add-results'),
      addPick: $('add-pick'), addCoord: $('add-coord'), addName: $('add-name'), addDistrict: $('add-district'),
      addCat: $('add-cat'), addMenu: $('add-menu'), addMemo: $('add-memo'), addAddress: $('add-address'),
      addSave: $('add-save'), exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file'),
      customCount: $('custom-count')
    };

    initMap();
    renderHubs();
    bindEvents();
    bindSearch('start');
    bindSearch('end');
    setMode('route', true);
    loadData();

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
