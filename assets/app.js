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
  var MEAL_CATS = ['한식', '국밥', '중식', '일식', '양식', '해산물', '고기', '면·분식'];
  var ALL_CATS = MEAL_CATS.concat(['카페·디저트']);
  var LS_CUSTOM = 'incheonFoodMap.custom.v1';
  var LS_HIDDEN = 'incheonFoodMap.hidden.v1';
  var LS_NEAR = 'incheonFoodMap.near.v1';
  var LS_KAKAO = 'kakaoRestKey';

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
    mode: 'route',          /* route | district | near */
    travel: 'car',
    radius: 1000,
    routeSort: 'along',     /* along | near */
    near: null,             /* 기준 위치 {name, lat, lng} */
    nearRadius: 3000,       /* 1000 | 3000 | 5000 */
    foodGroup: 'all',       /* all | meal | cafe */
    cats: [],               /* 선택한 식사 세부 업종 */
    tiers: { michelin: true, blueribbon: true, local: true, custom: true },
    district: 'all',
    route: null,
    picking: null,          /* start | end | custom */
    selected: null,
    loading: false
  };

  var map, layerRest, layerRoute, layerHubs, layerNear;
  var nearCircle = null;
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

  /* 받침에 따라 '로/으로' 조사를 고른다 */
  function josaRo(s) {
    var t = String(s == null ? '' : s).trim();
    var c = t.slice(-1);
    if (!c) return '로';
    var code = c.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return '로';
    return ((code - 0xAC00) % 28) ? '으로' : '로';
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

  /* ── 카카오 로컬(상호명) 검색 ─────────────────────
     키는 localStorage(kakaoRestKey)에만 저장한다. 코드에는 어떤 키도 넣지 않는다. */
  function kakaoKey() {
    var v = storeGet(LS_KAKAO, '');
    return typeof v === 'string' ? v.trim() : '';
  }

  function setKakaoKey(key) {
    if (key) storeSet(LS_KAKAO, key);
    else { try { localStorage.removeItem(LS_KAKAO); } catch (e) { /* 저장 불가 */ } }
    renderKeyState();
  }

  var KAKAO_CATS = [
    ['순대국', '국밥'], ['해장국', '국밥'], ['설렁탕', '국밥'], ['곰탕', '국밥'], ['국밥', '국밥'], ['소머리', '국밥'], ['선지', '국밥'], ['내장탕', '국밥'],
    ['카페', '카페·디저트'], ['디저트', '카페·디저트'], ['베이커리', '카페·디저트'], ['제과', '카페·디저트'], ['브런치', '카페·디저트'],
    ['중식', '중식'], ['중국', '중식'],
    ['일식', '일식'], ['초밥', '일식'], ['스시', '일식'], ['라멘', '일식'], ['돈카츠', '일식'], ['우동', '일식'], ['이자카야', '일식'],
    ['해산물', '해산물'], ['횟집', '해산물'], ['조개', '해산물'], ['생선', '해산물'], ['복어', '해산물'],
    ['고기', '고기'], ['삼겹', '고기'], ['갈비', '고기'], ['곱창', '고기'], ['숯불', '고기'], ['구이', '고기'], ['족발', '고기'],
    ['양식', '양식'], ['이탈리안', '양식'], ['피자', '양식'], ['파스타', '양식'], ['스테이크', '양식'], ['햄버거', '양식'],
    ['국수', '면·분식'], ['칼국수', '면·분식'], ['냉면', '면·분식'], ['수제비', '면·분식'], ['분식', '면·분식'],
    ['김밥', '면·분식'], ['떡볶이', '면·분식'], ['만두', '면·분식'], ['돈까스', '면·분식']
  ];

  function categoryFromKakao(it) {
    var group = it.category_group_name || '';
    var text = (it.category_name || '') + ' ' + group;
    if (group.indexOf('카페') >= 0) return '카페·디저트';
    for (var i = 0; i < KAKAO_CATS.length; i++) {
      if (text.indexOf(KAKAO_CATS[i][0]) >= 0) return KAKAO_CATS[i][1];
    }
    return '한식';
  }

  function districtFromText(text) {
    if (!text) return '';
    for (var i = 0; i < DISTRICTS.length; i++) {
      if (text.indexOf(DISTRICTS[i]) >= 0) return DISTRICTS[i];
    }
    if (text.indexOf('중구') >= 0 || text.indexOf('동구') >= 0) return '제물포구';
    if (text.indexOf('서구') >= 0) return '서해구';
    if (text.indexOf('남구') >= 0) return '미추홀구';
    return '';
  }

  function kakaoDocToItem(d) {
    var address = d.road_address_name || d.address_name || '';
    return {
      name: d.place_name || '',
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
      address: address,
      roadAddress: d.road_address_name || '',
      jibunAddress: d.address_name || '',
      category: categoryFromKakao(d),
      categoryName: d.category_name || '',
      phone: d.phone || '',
      district: districtFromText(address),
      distance: d.distance ? parseInt(d.distance, 10) : null,
      placeUrl: d.place_url || '',
      source: 'kakao'
    };
  }

  /* 키가 없으면 호출하지 않고 reason 'no-key'로 즉시 돌려준다 */
  function kakaoSearch(q) {
    var key = kakaoKey();
    if (!key) return Promise.resolve({ ok: false, reason: 'no-key', items: [] });
    var cfg = REGIONS[state.region];
    var url = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=' + encodeURIComponent(q) +
      '&x=' + cfg.center[1] + '&y=' + cfg.center[0] + '&size=8';
    return fetch(url, { headers: { 'Authorization': 'KakaoAK ' + key } })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) return { ok: false, reason: 'auth', items: [] };
        if (!r.ok) return { ok: false, reason: 'http-' + r.status, items: [] };
        return r.json().then(function (j) {
          return { ok: true, reason: '', items: (j.documents || []).map(kakaoDocToItem) };
        });
      })
      .catch(function () { return { ok: false, reason: 'network', items: [] }; });
  }

  function kakaoEndpoint(it) {
    var cat = (it.categoryName || '').split(' > ').pop();
    return {
      name: it.name,
      lat: it.lat,
      lng: it.lng,
      meta: [cat, it.address].filter(Boolean).join(' · '),
      address: it.address
    };
  }

  function kakaoErrorNote(res) {
    if (res.reason === 'auth') return '카카오 REST API 키 또는 카카오맵/로컬 활성화 여부를 확인해 주세요.';
    if (res.reason === 'network') return '카카오 서버에 연결하지 못했습니다.';
    if (res.reason === 'no-key') return '';
    return '카카오 검색이 응답하지 않았습니다.';
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
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView(cfg.center, cfg.zoom);
    /* 공개 타일 중 키·워터마크 없이 동작하는 OSM을 쓰고, 타일 팬에만 색 보정(실버-블루 톤)을 준다.
       (CartoDB Positron은 2026-11 현재 'API KEY REQUIRED' 워터마크가 찍혀 사용 불가) */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 8,
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: true
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    layerRoute = L.layerGroup().addTo(map);
    layerHubs = L.layerGroup().addTo(map);
    layerNear = L.layerGroup().addTo(map);
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
      html: '<span class="pin ' + tier + (selected ? ' sel' : '') + '"><i></i></span>',
      iconSize: selected ? [30, 30] : [22, 22],
      iconAnchor: selected ? [15, 22] : [11, 17]
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

  function endpointIcon(kind, label) {
    return L.divIcon({
      className: 'endpoint-wrap',
      html: '<span class="endpoint ' + kind + '"><i></i></span>',
      iconSize: kind === 'start' ? [24, 24] : [26, 26],
      iconAnchor: kind === 'start' ? [12, 12] : [13, 20],
      title: label
    });
  }

  /* 내 주변 기준 위치 마커 */
  function nearIcon() {
    return L.divIcon({
      className: 'near-wrap',
      html: '<span class="near-pin"><i></i></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
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
        if (state.mode === 'district') fitDistrict();
        else if (state.mode === 'near') { nearNowText(); drawNear(); fitNear(); }
        else if (state.route) fitRouteView();
        else fitAll();
        updateCustomCount();
        renderHiddenLine();
        el.brandCount.textContent = state.data.length;
        var totalEl = $('data-total');
        if (totalEl) totalEl.textContent = state.base.length;
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
    /* 등급 필터는 v4에서 패널에서 뺐다. 배지·카운트에 필요한 집계만 갱신 */
    var catCounts = { meal: 0, cafe: 0 };
    state.data.forEach(function (r) {
      if (isHidden(r)) return;
      catCounts[r.categoryGroup === 'cafe' ? 'cafe' : 'meal']++;
    });
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
    var NO_KEY_NOTE = '상호명 검색을 쓰려면 카카오 키를 한 번만 입력해 주세요. (내 맛집 추가 → 카카오 상호명 검색 키)';

    function show(items, note) {
      if (!items.length && !note) { box.hidden = true; box.innerHTML = ''; return; }
      var html = items.map(function (it, i) {
        return '<button type="button" data-i="' + i + '"><span class="r-name">' + esc(it.name) +
          '</span><span class="r-meta">' + esc(it.meta || '') + '</span></button>';
      }).join('');
      if (note) html += '<div class="r-hint">' + note + '</div>';
      box.innerHTML = html;
      box.hidden = false;
      box._items = items;
    }

    function merge(base, extra) {
      extra.forEach(function (r) {
        if (!isFinite(r.lat) || !isFinite(r.lng)) return;
        if (!base.some(function (m) { return haversine([m.lat, m.lng], [r.lat, r.lng]) < 80; })) base.push(r);
      });
      return base;
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 1) { box.hidden = true; return; }
      show(localMatches(q));
      timer = setTimeout(function () {
        var base = localMatches(q);
        if (!kakaoKey()) {
          nominatim(q).then(function (remote) {
            if (input.value.trim() !== q) return;
            var merged = merge(base, remote);
            show(merged.slice(0, 7), merged.length ? '' : NO_KEY_NOTE);
          });
          return;
        }
        kakaoSearch(q).then(function (res) {
          if (input.value.trim() !== q) return;
          var items = merge(base, res.items.map(kakaoEndpoint));
          if (res.ok) {
            if (!items.length) {
              show([], '카카오에서 찾은 곳이 없습니다. 다른 이름으로 검색하거나 지도에서 직접 찍어 주세요.');
              return;
            }
            show(items.slice(0, 8));
            return;
          }
          var note = kakaoErrorNote(res);
          nominatim(q).then(function (remote) {
            if (input.value.trim() !== q) return;
            show(merge(items, remote).slice(0, 8), note);
          });
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
    if (state.picking === 'near') {
      state.picking = null;
      document.querySelector('.map-wrap').classList.remove('picking');
      el.pickNote.hidden = true;
      if (el.nearPick) el.nearPick.classList.remove('active');
      setNear({ name: '지도에서 찍은 위치', lat: latlng.lat, lng: latlng.lng });
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
    var label = kind === 'start' ? '출발지' : kind === 'end' ? '도착지' : '기준 위치';
    el.pickNote.innerHTML = '지도를 클릭해 <b>' + label + '</b>를 찍으세요. (Esc로 취소)';
    var btn = kind === 'start' ? el.startPick : kind === 'end' ? el.endPick : el.nearPick;
    if (btn) btn.classList.add('active');
    toast('지도를 클릭해 ' + label + '를 지정하세요.');
  }

  function clearPick() {
    state.picking = null;
    document.querySelector('.map-wrap').classList.remove('picking');
    el.pickNote.hidden = true;
    el.startPick.classList.remove('active');
    el.endPick.classList.remove('active');
    if (el.nearPick) el.nearPick.classList.remove('active');
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
    var common = { lineCap: 'round', lineJoin: 'round', interactive: false };
    var main = route.kind === 'road'
      ? { color: '#4F46E5', weight: 4, opacity: 1 }
      : { color: '#4F46E5', weight: 4.5, opacity: 1, dashArray: '1 9' };
    /* 세 겹: 부드러운 외곽 글로우 → 화이트 케이싱 → 4px 메인 라인 */
    L.polyline(route.line, Object.assign({}, common, { color: '#6366F1', weight: 15, opacity: 0.16 })).addTo(layerRoute);
    L.polyline(route.line, Object.assign({}, common, { color: '#FFFFFF', weight: 8, opacity: 0.95 })).addTo(layerRoute);
    L.polyline(route.line, Object.assign({}, common, main)).addTo(layerRoute);

    if (state.start) {
      L.marker([state.start.lat, state.start.lng], {
        icon: endpointIcon('start', '출발'), zIndexOffset: 900, keyboard: false
      }).bindTooltip('출발 · ' + esc(state.start.name), { direction: 'top', offset: [0, -10], className: 'end-tip', opacity: 1 }).addTo(layerRoute);
    }
    if (state.end) {
      L.marker([state.end.lat, state.end.lng], {
        icon: endpointIcon('end', '도착'), zIndexOffset: 900, keyboard: false
      }).bindTooltip('도착 · ' + esc(state.end.name), { direction: 'top', offset: [0, -14], className: 'end-tip', opacity: 1 }).addTo(layerRoute);
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

  /* 패널·바텀시트에 가리지 않는 영역에 맞춰 지도를 맞춘다 */
  function fitPadding() {
    if (isMobile()) {
      return {
        paddingTopLeft: [26, 86],
        paddingBottomRight: [26, Math.round(sheetHeight() + 26)]
      };
    }
    var left = (el.panel ? el.panel.getBoundingClientRect().width : 392) + 48;
    return { paddingTopLeft: [left, 34], paddingBottomRight: [34, 34] };
  }

  function fitRouteView() {
    if (!state.route || state.route.line.length < 2) {
      if (state.start && state.end) {
        map.fitBounds(L.latLngBounds([[state.start.lat, state.start.lng], [state.end.lat, state.end.lng]]), fitPadding());
      }
      return;
    }
    var b = L.latLngBounds(state.route.line);
    visible().forEach(function (rec) { b.extend([rec.r.lat, rec.r.lng]); });
    map.fitBounds(b, fitPadding());
  }

  function fitAll() {
    var rows = state.data.filter(function (r) { return !isHidden(r); });
    if (!rows.length) return;
    map.fitBounds(L.latLngBounds(rows.map(function (r) { return [r.lat, r.lng]; })), fitPadding());
  }

  function fitDistrict() {
    var rows = state.data.filter(function (r) {
      return !isHidden(r) && (state.district === 'all' || r.district === state.district);
    });
    if (!rows.length) { toast('이 지역구에 표시할 맛집이 없습니다.'); return; }
    var opts = fitPadding();
    opts.maxZoom = 15;
    map.fitBounds(L.latLngBounds(rows.map(function (r) { return [r.lat, r.lng]; })), opts);
  }

  /* ── 내 주변 ─────────────────────────────────── */
  function saveNear() {
    storeSet(LS_NEAR, { near: state.near, radius: state.nearRadius });
  }

  function nearBounds() {
    if (!state.near) return null;
    var dLat = state.nearRadius / 111320;
    var dLng = state.nearRadius / (111320 * Math.cos(state.near.lat * Math.PI / 180));
    return L.latLngBounds(
      [state.near.lat - dLat, state.near.lng - dLng],
      [state.near.lat + dLat, state.near.lng + dLng]
    );
  }

  function fitNear() {
    var b = nearBounds();
    if (!b) { fitAll(); return; }
    var opts = fitPadding();
    opts.maxZoom = 15;
    map.fitBounds(b, opts);
  }

  function drawNear() {
    if (!layerNear) return;
    layerNear.clearLayers();
    nearCircle = null;
    if (state.mode !== 'near' || !state.near) return;
    var c = [state.near.lat, state.near.lng];
    nearCircle = L.circle(c, {
      radius: state.nearRadius,
      color: '#4F46E5', weight: 1.5, opacity: 0.8,
      fillColor: '#6366F1', fillOpacity: 0.10,
      interactive: false
    }).addTo(layerNear);
    var m = L.marker(c, { icon: nearIcon(), zIndexOffset: 1200, keyboard: false });
    var label = state.near.name.length > 16 ? state.near.name.slice(0, 15) + '…' : state.near.name;
    m.bindTooltip(isMobile() ? '기준 위치' : '기준 위치 · ' + esc(label), {
      permanent: !isMobile(), direction: 'top', offset: [0, -14], className: 'near-tip', opacity: 1
    });
    m.addTo(layerNear);
  }

  function nearNowText() {
    if (!el.nearNow) return;
    if (!state.near) {
      el.nearNow.innerHTML = '아직 기준 위치가 없습니다. <b>내 위치(GPS)</b>·검색·지도 클릭 중 편한 방법으로 정해 주세요.';
      return;
    }
    el.nearNow.innerHTML = '기준 위치 <b>' + esc(state.near.name) + '</b> · 반경 ' +
      fmtDist(state.nearRadius) + ' 안의 맛집을 가까운 순으로 보여 줍니다.';
  }

  function setNear(place, opts) {
    if (!place || !isFinite(place.lat) || !isFinite(place.lng)) {
      toast('위치를 찾지 못했습니다. 다른 이름으로 검색하거나 지도를 눌러 주세요.');
      return;
    }
    state.near = { name: place.name || '지정한 위치', lat: +place.lat, lng: +place.lng };
    if (el.nearInput) el.nearInput.value = state.near.name;
    saveNear();
    clearPick();
    if (state.mode !== 'near') setMode('near', true);
    nearNowText();
    renderSummary();
    renderList();
    renderMarkers();
    drawNear();
    if (!opts || opts.fit !== false) fitNear();
    if (!opts || !opts.silent) toast('기준 위치를 ' + state.near.name + josaRo(state.near.name) + ' 잡았습니다.');
  }

  function setNearRadius(r) {
    state.nearRadius = r;
    document.querySelectorAll('.seg-btn[data-nradius]').forEach(function (b) {
      var on = parseInt(b.getAttribute('data-nradius'), 10) === r;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    saveNear();
    if (state.mode === 'near') {
      nearNowText();
      drawNear();
      renderSummary();
      renderList();
      renderMarkers();
      fitNear();
    }
  }

  function useNearGps() {
    if (!navigator.geolocation) {
      toast('이 브라우저에서는 현재 위치를 쓸 수 없습니다. 장소를 검색하거나 지도를 눌러 지정해 주세요.', 4200);
      return;
    }
    toast('현재 위치를 확인하는 중…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      setNear({ name: '현재 위치', lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, function (err) {
      var m = '현재 위치를 가져오지 못했습니다. ';
      if (err && err.code === 1) m += '브라우저·휴대폰에서 위치 권한을 “허용”으로 바꾼 뒤 다시 눌러 주세요.';
      else if (err && err.code === 3) m += '시간이 초과됐습니다. 잠시 뒤 다시 누르거나 장소를 검색해 주세요.';
      else m += '신호가 약합니다. 장소를 검색하거나 지도를 눌러 지정해 주세요.';
      toast(m, 5200);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  /* 기본 위치 검색(내 주변): 내장 지명 → 카카오(키 있을 때) → Nominatim */
  function bindNearSearch() {
    var input = el.nearInput, box = el.nearResults;
    if (!input || !box) return;
    var timer = null;
    var NO_KEY_NOTE = '상호명 검색을 쓰려면 카카오 키를 한 번만 입력해 주세요. (지금은 주요 지명·주소 검색으로 동작합니다)';

    function show(items, note) {
      if (!items.length && !note) { box.hidden = true; box.innerHTML = ''; return; }
      var html = items.map(function (it, i) {
        return '<button type="button" data-i="' + i + '"><span class="r-name">' + esc(it.name) +
          '</span><span class="r-meta">' + esc(it.meta || '') + '</span></button>';
      }).join('');
      if (note) html += '<div class="r-hint">' + note + '</div>';
      box.innerHTML = html;
      box.hidden = false;
      box._items = items;
    }

    function merge(base, extra) {
      extra.forEach(function (r) {
        if (!isFinite(r.lat) || !isFinite(r.lng)) return;
        if (!base.some(function (m) { return haversine([m.lat, m.lng], [r.lat, r.lng]) < 80; })) base.push(r);
      });
      return base;
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 1) { box.hidden = true; return; }
      show(localMatches(q));
      timer = setTimeout(function () {
        var base = localMatches(q);
        if (kakaoKey()) {
          kakaoSearch(q).then(function (res) {
            if (input.value.trim() !== q) return;
            if (res.ok) {
              var items = merge(base, res.items.map(kakaoEndpoint));
              show(items.slice(0, 8), items.length ? '' : '카카오에서 찾은 곳이 없습니다. 다른 이름으로 검색하거나 지도를 직접 눌러 주세요.');
              return;
            }
            var note = kakaoErrorNote(res);
            nominatim(q).then(function (remote) {
              if (input.value.trim() !== q) return;
              show(merge(base, remote).slice(0, 8), note);
            });
          });
          return;
        }
        nominatim(q).then(function (remote) {
          if (input.value.trim() !== q) return;
          var merged = merge(base, remote);
          show(merged.slice(0, 7), merged.length ? '' : NO_KEY_NOTE);
        });
      }, 420);
    });

    function pick(i) {
      var it = (box._items || [])[i];
      if (!it) return;
      box.hidden = true;
      setNear(it);
    }

    box.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-i]');
      if (btn) pick(parseInt(btn.getAttribute('data-i'), 10));
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && box._items && box._items.length) { e.preventDefault(); pick(0); }
      if (e.key === 'Escape') box.hidden = true;
    });
    input.addEventListener('blur', function () {
      setTimeout(function () { box.hidden = true; }, 160);
    });
  }

  /* ── 필터/렌더 ─────────────────────────────────── */
  function computed() {
    return state.data.map(function (r) {
      var rec = { r: r, dist: null, along: null, near: null };
      if (state.route) {
        var p = projectToLine([r.lat, r.lng], state.route.line);
        rec.dist = p.dist;
        rec.along = p.along;
      }
      if (state.near) rec.near = haversine([state.near.lat, state.near.lng], [r.lat, r.lng]);
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
      if (state.mode === 'near') {
        if (!state.near || rec.near == null) return false;
        return rec.near <= state.nearRadius;
      }
      if (state.mode === 'district') {
        return state.district === 'all' || r.district === state.district;
      }
      if (state.route && state.radius > 0) {
        if (rec.dist == null || rec.dist > state.radius) return false;
      }
      return true;
    });
    if (state.mode === 'near') {
      out.sort(function (a, b) { return (a.near == null ? 1e12 : a.near) - (b.near == null ? 1e12 : b.near); });
    } else if (state.mode === 'route' && state.route && state.routeSort === 'near') {
      out.sort(function (a, b) { return (a.dist == null ? 1e12 : a.dist) - (b.dist == null ? 1e12 : b.dist); });
    } else if (state.mode === 'route' && state.route) {
      out.sort(function (a, b) { return (a.along || 0) - (b.along || 0); });
    } else {
      out.sort(function (a, b) { return a.r.name.localeCompare(b.r.name, 'ko'); });
    }
    return out;
  }

  /* 카드·상세 배지: 뭉뚱그린 등급 대신 실제 세부 구분을 그대로 보여 준다 */
  var SUB_BADGES = {
    '미쉐린 스타 브랜드': { cls: 'b-michelin', text: '미쉐린' },
    '미쉐린 스타 출신 셰프': { cls: 'b-michelin', text: '미쉐린' },
    '블루리본': { cls: 'b-blueribbon', text: '블루리본' },
    '백년가게': { cls: 'b-baeknyeon', text: '백년가게' },
    '방송 맛집': { cls: 'b-broadcast', text: '방송맛집' },
    '방송맛집': { cls: 'b-broadcast', text: '방송맛집' },
    '노포': { cls: 'b-nopo', text: '노포' },
    '국민맛집': { cls: 'b-gukmin', text: '국민맛집' },
    '찐후기': { cls: 'b-jjin', text: '찐후기' },
    '내 맛집': { cls: 'b-custom', text: '내 맛집' }
  };
  var TIER_BADGES = {
    michelin: { cls: 'b-michelin', text: '미쉐린' },
    blueribbon: { cls: 'b-blueribbon', text: '블루리본' },
    local: { cls: 'b-jjin', text: '로컬' },
    custom: { cls: 'b-custom', text: '내 맛집' }
  };

  function subBadge(r) {
    return SUB_BADGES[r.tierLabel] || TIER_BADGES[r.tier] || { cls: 'b-jjin', text: r.tierLabel || '기타' };
  }

  function badgeHtml(r) {
    var m = subBadge(r);
    var title = r.tierLabel && r.tierLabel !== m.text ? ' title="' + esc(r.tierLabel) + '"' : '';
    return '<span class="badge ' + m.cls + '"' + title + '>' + esc(m.text) + '</span>';
  }

  function renderList() {
    updateFiltersSummary();
    var rows = visible();
    el.resultCount.textContent = rows.length + '곳';
    if (state.mode === 'near') {
      el.listTitle.textContent = '내 주변 맛집';
      if (el.nearCount) el.nearCount.textContent = '반경 내 ' + rows.length + '곳';
      el.sortNote.textContent = '가까운 순';
      el.sortNote.disabled = true;
      el.sortNote.classList.add('static');
    } else if (state.mode === 'district') {
      el.listTitle.textContent = state.district === 'all' ? '지역구 전체 맛집' : state.district + ' 맛집';
      el.sortNote.textContent = '이름 순';
      el.sortNote.disabled = true;
      el.sortNote.classList.add('static');
    } else {
      el.listTitle.textContent = '동선 위 맛집';
      el.sortNote.disabled = !state.route;
      el.sortNote.classList.toggle('static', !state.route);
      el.sortNote.textContent = state.route
        ? (state.routeSort === 'near' ? '경로에서 가까운 순 ⇄' : '출발→도착 순 ⇄')
        : '';
    }
    if (!rows.length) {
      var hint = state.mode === 'near'
        ? (state.near ? '반경을 넓혀 보거나 업종 필터를 풀어 보세요.' : '위에서 기준 위치를 먼저 정해 주세요.')
        : state.mode === 'district' ? '다른 지역구를 골라 보세요.' : '반경을 넓히거나 업종 필터를 풀어 보세요.';
      el.list.innerHTML = '<div class="empty">조건에 맞는 맛집이 없습니다.<br>' + hint + '</div>';
      return;
    }
    el.list.innerHTML = rows.map(function (rec, i) {
      var r = rec.r;
      var distTxt = '';
      if (state.mode === 'near' && rec.near != null) distTxt = fmtDist(rec.near);
      else if (state.mode === 'route' && rec.dist != null) distTxt = '경로에서 ' + fmtDist(rec.dist);
      return '<button type="button" class="card' + (state.selected === r.id ? ' sel' : '') + '" data-id="' + esc(r.id) + '">' +
        '<span class="card-top"><span class="card-order">' + (i + 1) + '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' + badgeHtml(r) + '</span>' +
        '<span class="card-meta">' + esc(r.district) + '<span class="sep">·</span>' + esc(r.category) +
        (distTxt ? '<span class="card-dist' + (state.mode === 'near' ? ' near' : '') + '">' + distTxt + '</span>' : '') + '</span>' +
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
    var parts = [];
    if (state.mode === 'near') {
      parts.push(state.near ? state.near.name : '기준 위치 없음');
      parts.push('반경 ' + fmtDist(state.nearRadius));
    } else if (state.mode === 'district') {
      parts.push(state.district === 'all' ? '지역구 전체' : state.district);
    } else {
      parts.push(state.travel === 'car' ? '자동차' : '대중교통');
      parts.push(state.radius > 0 ? '반경 ' + fmtDist(state.radius) : '반경 전체');
    }
    if (state.foodGroup === 'cafe') parts.push('카페·디저트');
    else if (state.cats.length) parts.push(state.cats.join('·'));
    else if (state.foodGroup === 'meal') parts.push('식사');
    el.filtersSummary.textContent = parts.join(' · ');
  }

  function renderSummary(msg) {
    if (msg) { el.summary.innerHTML = esc(msg); return; }
    if (state.mode === 'near') {
      if (!state.near) {
        el.summary.innerHTML = '<b>내 주변 맛집</b><br>기준 위치를 정하면 반경 안의 맛집을 <b>가까운 순서</b>로 보여줍니다.<br>' +
          '<span class="note">현재 내 위치(GPS) · 장소 검색 · 지도에서 직접 찍기 중에 고르세요.</span>';
        return;
      }
      var n = visible().length;
      el.summary.innerHTML =
        '<b>' + esc(state.near.name) + '</b> 반경 <b>' + fmtDist(state.nearRadius) + '</b> 맛집 <b>' + n + '곳</b><br>' +
        '기준 위치에서 가까운 순서로 보여 줍니다.' +
        (n === 0 ? '<br><span class="err">반경을 넓혀 보세요(5km).</span>' : '') +
        '<br><span class="note">기준 위치는 오른쪽 위 지도 핀입니다. 다른 지점으로 바꾸려면 다시 검색하거나 지도를 누르세요.</span>';
      return;
    }
    if (state.mode === 'district') {
      var n = visible().length;
      el.summary.innerHTML =
        '<b>' + esc(state.district === 'all' ? '인천 전체' : state.district) + '</b> 맛집 <b>' + n + '곳</b><br>' +
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
      /* 바텀시트에 가리지 않는 위쪽 영역의 중앙에 핀을 둔다 */
      dy = Math.round((sheetHeight() * 0.55) / 2 + 24);
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
    var statDist = (state.mode === 'route' && rec && rec.dist != null) ? fmtDist(rec.dist) : '—';
    var sb = subBadge(r);

    var menus = (r.menus || []).length ? (r.menus || []).map(function (m) {
      return '<li><span class="m-name">' + esc(m.name) + '</span><span class="m-dots"></span><span class="m-price">' + esc(m.price) + '</span></li>';
    }).join('') : '<li><span class="m-name d-empty">대표 메뉴는 매장에서 확인</span><span class="m-dots"></span><span class="m-price">—</span></li>';

    var placeLine = esc(r.category) + ' · ' + esc(r.district) +
      (r.districtOld && r.districtOld !== r.district ? '(舊 ' + esc(r.districtOld) + ')' : '') +
      (r.dong ? ' ' + esc(r.dong) : '');

    var html = '' +
      '<div class="d-head">' + badgeHtml(r) +
      (r.tierLabel && r.tierLabel !== sb.text ? '<span class="d-tier-note">' + esc(r.tierLabel) + '</span>' : '') +
      '</div>' +
      '<h2 class="d-title" id="detail-title">' + esc(r.name) + '</h2>' +
      '<p class="d-meta">' + placeLine + (r.phone ? ' · ' + esc(r.phone) : '') + '</p>' +
      '<div class="d-stats">' +
      (state.mode === 'route'
        ? '<div class="d-stat">동선 이탈<b>' + statDist + '</b></div>'
        : '<div class="d-stat">지역<b>' + esc(r.district || '인천') + '</b></div>') +
      '<div class="d-stat">영업<b>' + esc(r.hours || '매장 확인') + '</b></div>' +
      '<div class="d-stat">휴무<b>' + esc(r.closed || '매장 확인') + '</b></div>' +
      '</div>' +
      '<div class="d-sec"><h3>주소</h3><p>' + esc(r.address) + '</p></div>' +
      '<div class="d-sec"><h3>대표 메뉴</h3><ul class="menu-list">' + menus + '</ul></div>' +
      (r.reviewSummary ? '<div class="d-sec"><h3>후기 요약</h3><div class="d-note">' + esc(r.reviewSummary) + '</div></div>' : '') +
      (r.tips ? '<div class="d-sec"><h3>이용 팁</h3><div class="d-note">' + esc(r.tips) + '</div></div>' : '') +
      (r.tierNote ? '<div class="d-tiernote"><b>등급 근거</b> ' + esc(r.tierNote) + '</div>' : '') +
      '<div class="d-links" style="margin-top:16px">' +
      '<a class="chip-link" href="' + esc(r.naverMapUrl) + '" target="_blank" rel="noopener">네이버지도 <span class="arrow">↗</span></a>' +
      '<a class="chip-link" href="' + esc(r.kakaoMapUrl) + '" target="_blank" rel="noopener">카카오맵 <span class="arrow">↗</span></a>' +
      '</div>' +
      '<div class="d-actions">' +
      '<button class="btn" type="button" data-act="start" data-id="' + esc(r.id) + '">출발지로</button>' +
      '<button class="btn primary" type="button" data-act="end" data-id="' + esc(r.id) + '">도착지로</button>' +
      '</div>' +
      '<div class="d-foot-row">' +
      '<button class="link-btn danger" type="button" data-act="hide" data-id="' + esc(r.id) + '">지도에서 숨기기</button>' +
      (r._custom ? '<button class="link-btn danger" type="button" data-act="delete" data-id="' + esc(r.id) + '">삭제</button>' : '') +
      '</div>';

    el.detailContent.innerHTML = html;
    el.detail.hidden = false;
    el.detailContent.parentNode.scrollTop = 0;
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
    if (el.addPhone) el.addPhone.value = '';
    el.addSearch.value = '';
    el.addDistrict.value = '';
    el.addResults.hidden = true;
    el.addCoord.textContent = '위치를 검색하거나 지도에서 찍어 주세요.';
    el.addCoord.classList.remove('ok');
    el.addModal.hidden = false;
    document.body.style.overflow = 'hidden';
    updateCustomCount();
    renderKeyState();
    setKeyPanel(false);
    setTimeout(function () { el.addSearch.focus(); }, 60);
  }

  function closeAddModal() {
    el.addModal.hidden = true;
    if (el.detail.hidden) document.body.style.overflow = '';
  }

  function renderKeyState() {
    var key = kakaoKey();
    if (el.kakaoKeyState) {
      el.kakaoKeyState.textContent = key ? '저장됨 · 끝 ' + key.slice(-4) : '미등록';
      el.kakaoKeyState.classList.toggle('on', !!key);
    }
    if (el.kakaoKeyClear) el.kakaoKeyClear.hidden = !key;
    if (el.kakaoKeyInput) el.kakaoKeyInput.value = '';
    if (el.addSearchHint) {
      el.addSearchHint.innerHTML = key
        ? '카카오 상호명 검색 사용 중 — 가게 이름(예: 윤가네바지락칼국수)만 넣고 검색하세요.'
        : '위 <b>카카오 키</b>를 한 번 넣으면 상호명으로 바로 찾습니다. 지금은 도로명주소 검색만 됩니다.';
    }
    if (el.keyOpen) el.keyOpen.classList.toggle('on', !!key);
  }

  function setKeyPanel(open) {
    if (!el.kakaoKeyPanel) return;
    el.kakaoKeyPanel.hidden = !open;
    el.kakaoKeyToggle.classList.toggle('open', open);
    el.kakaoKeyToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(function () { el.kakaoKeyInput.focus(); }, 80);
  }

  function openKeyPanel() {
    openAddModal();
    setKeyPanel(true);
  }

  function saveKeyFromInput() {
    var v = (el.kakaoKeyInput.value || '').trim();
    if (!v) { toast('카카오 REST API 키를 붙여넣어 주세요.'); el.kakaoKeyInput.focus(); return; }
    if (v.length < 20) { toast('키가 너무 짧습니다. REST API 키(32자 내외)를 확인해 주세요.'); el.kakaoKeyInput.focus(); return; }
    setKakaoKey(v);
    toast('카카오 키를 이 기기에 저장했습니다. 이제 상호명으로 검색됩니다.', 3200);
    if (el.addSearch.value.trim()) runAddSearch();
  }

  function clearKey() {
    setKakaoKey('');
    toast('카카오 키를 이 기기에서 삭제했습니다.');
  }

  function fillAddLocation(lat, lng, address) {
    addState.lat = lat; addState.lng = lng;
    if (address) addState.address = address;
    el.addAddress.value = addState.address || '';
    el.addCoord.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
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

  function renderAddResults(items, warn) {
    var html = '';
    if (warn) html += '<div class="r-warn">' + esc(warn) + '</div>';
    if (!items.length) {
      html += '<div class="r-empty">검색 결과가 없습니다. 지도에서 직접 위치를 찍어 주세요.</div>';
    } else {
      html += items.map(function (it, i) {
        var tag = it.source === 'kakao' ? '<span class="r-src">카카오</span>' : '';
        return '<button type="button" data-i="' + i + '"><span class="r-name">' + esc(it.name) + tag +
          '</span><span class="r-meta">' + esc(it.meta || it.address || '') + '</span></button>';
      }).join('');
    }
    el.addResults.innerHTML = html;
    el.addResults._items = items;
    el.addResults.hidden = false;
  }

  function nominatimToAddItem(it) {
    return {
      name: (it.name || '').split(',')[0].split('(')[0].trim(),
      lat: it.lat,
      lng: it.lng,
      address: it.address || it.name,
      district: it.district || districtFromText(it.address || it.name || ''),
      source: 'osm'
    };
  }

  function runAddSearch() {
    var q = el.addSearch.value.trim();
    if (!q) return;
    el.addResults.hidden = false;
    if (!kakaoKey()) {
      el.addResults.innerHTML = '<div class="r-empty">주소로 검색 중…</div>';
      nominatim(q).then(function (items) {
        renderAddResults(items.map(nominatimToAddItem),
          items.length ? '' : '카카오 키를 넣으면 상호명으로 바로 찾습니다.');
      });
      return;
    }
    el.addResults.innerHTML = '<div class="r-empty">카카오에서 상호명으로 찾는 중…</div>';
    kakaoSearch(q).then(function (res) {
      if (res.ok && res.items.length) {
        renderAddResults(res.items.map(function (it) {
          it.meta = [(it.categoryName || '').split(' > ').pop(), it.address, it.phone].filter(Boolean).join(' · ');
          return it;
        }), '');
        return;
      }
      var warn = res.ok
        ? '카카오에서 찾지 못해 주소로 검색했습니다 (카카오 로컬은 상호명·지명 위주입니다).'
        : kakaoErrorNote(res) + ' 주소로 검색했습니다.';
      nominatim(q).then(function (items) {
        renderAddResults(items.map(nominatimToAddItem), warn);
      });
    });
  }

  function pickFromSearch(i) {
    var it = (el.addResults._items || [])[i];
    if (!it) return;
    addState.lat = it.lat; addState.lng = it.lng;
    addState.address = it.address || it.name;
    el.addCoord.textContent = it.lat.toFixed(5) + ', ' + it.lng.toFixed(5);
    el.addCoord.classList.add('ok');
    el.addAddress.value = addState.address;
    if (it.source === 'kakao') {
      el.addName.value = it.name;
      if (it.category) el.addCat.value = it.category;
      if (it.phone && el.addPhone) el.addPhone.value = it.phone;
    } else if (!el.addName.value) {
      el.addName.value = it.name;
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
    var phone = el.addPhone ? el.addPhone.value.trim() : '';
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
      phone: phone,
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
    toast(name + ' · 내 맛집에 저장했습니다.');
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
    toast(r.name + ' · 지도에서 숨겼습니다. 목록 위 \'복원\'으로 되살릴 수 있습니다.', 3600);
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
    if (el.filtersToggle) {
      var routeOnly = mode !== 'route';
      el.filtersToggle.hidden = routeOnly;
      if (routeOnly) {
        el.filters.classList.remove('open');
        el.filtersToggle.classList.remove('open');
        el.filtersToggle.setAttribute('aria-expanded', 'false');
      }
    }
    if (mode === 'district') {
      layerRoute.clearLayers();
      drawNear();
      el.district.value = state.district;
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitDistrict();
    } else if (mode === 'near') {
      layerRoute.clearLayers();
      layerHubs.clearLayers();
      nearNowText();
      drawNear();
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitNear();
    } else {
      drawRoute(state.route);
      drawHubs();
      drawNear();
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent && state.route) fitRouteView();
    }
    updateFiltersSummary();
    if (el.fitRoute) {
      var lbl = el.fitRoute.querySelector('span');
      if (lbl) lbl.textContent = mode === 'near' ? '반경 보기' : mode === 'district' ? '동네 보기' : '경로 보기';
    }
  }

  /* ── 이벤트 ───────────────────────────────────── */
  function bindEvents() {
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });

    el.addOpen.addEventListener('click', openAddModal);
    var addOpen2 = $('add-open-2');
    if (addOpen2) addOpen2.addEventListener('click', openAddModal);
    if (el.keyOpen) el.keyOpen.addEventListener('click', openKeyPanel);
    if (el.kakaoKeyToggle) {
      el.kakaoKeyToggle.addEventListener('click', function () {
        setKeyPanel(el.kakaoKeyPanel.hidden);
      });
      el.kakaoKeySave.addEventListener('click', saveKeyFromInput);
      el.kakaoKeyClear.addEventListener('click', clearKey);
      el.kakaoKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveKeyFromInput(); }
      });
    }
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

    if (el.nearGps) el.nearGps.addEventListener('click', useNearGps);
    if (el.nearPick) el.nearPick.addEventListener('click', function () { startPick('near'); });
    if (el.nearHubs) {
      el.nearHubs.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-near-hub]');
        if (!b) return;
        var hub = HUBS[parseInt(b.getAttribute('data-near-hub'), 10)];
        if (hub) setNear({ name: hub.name + ' 근처', lat: hub.lat, lng: hub.lng });
      });
    }
    document.querySelectorAll('.seg-btn[data-nradius]').forEach(function (b) {
      b.addEventListener('click', function () {
        setNearRadius(parseInt(b.getAttribute('data-nradius'), 10));
      });
    });
    if (el.sortNote) {
      el.sortNote.addEventListener('click', function () {
        if (state.mode !== 'route' || !state.route) return;
        state.routeSort = state.routeSort === 'near' ? 'along' : 'near';
        renderList();
        renderMarkers();
      });
    }

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

    el.tierChips = $('tier-chips');
    if (el.tierChips) {
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
    }

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
      else if (state.mode === 'near') fitNear();
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
    var html = HUBS.map(function (h, i) {
      return '<button type="button" class="chip" data-hub="' + i + '">' + esc(h.name) + '</button>';
    }).join('');
    el.hubChips.innerHTML = html;
    if (el.nearHubs) {
      el.nearHubs.innerHTML = HUBS.map(function (h, i) {
        return '<button type="button" class="chip" data-near-hub="' + i + '">' + esc(h.name) + '</button>';
      }).join('');
    }
  }

  /* ── 모바일: 플로팅 상단 바 · 바텀시트 ────────────── */
  var mqMobile = window.matchMedia('(max-width: 900px)');
  var sheetState = { snaps: [0.34, 0.5, 0.88], idx: 1, drag: null };

  function isMobile() { return mqMobile.matches; }

  function sheetHeight() {
    if (!el.panel || !isMobile()) return 0;
    return el.panel.getBoundingClientRect().height;
  }

  function setSheetHeight(px, animate) {
    if (!el.panel) return;
    el.panel.classList.toggle('dragging', !animate);
    el.panel.style.height = px + 'px';
    document.documentElement.style.setProperty('--panel-h', Math.round(px) + 'px');
  }

  function snapSheet(idx) {
    if (!el.panel) return;
    idx = Math.max(0, Math.min(sheetState.snaps.length - 1, idx));
    sheetState.idx = idx;
    setSheetHeight(Math.round(window.innerHeight * sheetState.snaps[idx]), true);
    document.body.classList.toggle('sheet-full', idx === sheetState.snaps.length - 1);
    if (map) setTimeout(function () { map.invalidateSize(); }, 320);
  }

  function applyViewport() {
    var mobile = isMobile();
    document.body.classList.toggle('is-mobile', mobile);
    if (mobile) {
      snapSheet(sheetState.idx);
    } else {
      document.body.classList.remove('sheet-full');
      if (el.panel) {
        el.panel.style.height = '';
        el.panel.classList.remove('dragging');
      }
      document.documentElement.style.removeProperty('--panel-h');
    }
    if (map) setTimeout(function () { map.invalidateSize(); }, 80);
  }

  function bindSheetDrag() {
    var grip = $('panel-grip');
    if (!grip || !el.panel) return;
    var moved = false;
    grip.addEventListener('pointerdown', function (e) {
      if (!isMobile()) return;
      sheetState.drag = { y: e.clientY, h: el.panel.getBoundingClientRect().height };
      moved = false;
      el.panel.classList.add('dragging');
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      e.preventDefault();
    });
    grip.addEventListener('pointermove', function (e) {
      var d = sheetState.drag;
      if (!d) return;
      var h = d.h + (d.y - e.clientY);
      if (Math.abs(d.y - e.clientY) > 4) moved = true;
      h = Math.max(window.innerHeight * 0.18, Math.min(window.innerHeight * 0.94, h));
      setSheetHeight(h, false);
    });
    function end() {
      if (!sheetState.drag) return;
      sheetState.drag = null;
      el.panel.classList.remove('dragging');
      var h = el.panel.getBoundingClientRect().height;
      if (!moved) {
        snapSheet(sheetState.idx === sheetState.snaps.length - 1 ? 0 : sheetState.idx + 1);
        return;
      }
      var best = 0, bd = 1e9;
      sheetState.snaps.forEach(function (r, i) {
        var d = Math.abs(window.innerHeight * r - h);
        if (d < bd) { bd = d; best = i; }
      });
      snapSheet(best);
    }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      snapSheet(sheetState.idx === sheetState.snaps.length - 1 ? 0 : sheetState.idx + 1);
    });
  }

  function bindDetailDrag() {
    var grip = $('detail-grip');
    var body = document.querySelector('.sheet-body');
    if (!grip || !body) return;
    var st = null, dy = 0;
    grip.addEventListener('pointerdown', function (e) {
      if (!isMobile()) return;
      st = e.clientY; dy = 0;
      body.style.transition = 'none';
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    grip.addEventListener('pointermove', function (e) {
      if (st == null) return;
      dy = Math.max(0, e.clientY - st);
      body.style.transform = 'translateY(' + dy + 'px)';
    });
    function up() {
      if (st == null) return;
      st = null;
      body.style.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
      body.style.transform = '';
      if (dy > 96) closeDetail();
      dy = 0;
    }
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
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
      panel: $('panel'), panelGrip: $('panel-grip'),
      toast: $('toast'), fitRoute: $('fit-route'),
      filters: $('filters'), filtersToggle: $('filters-toggle'), filtersSummary: $('filters-summary'),
      tierNoteFoot: $('tier-note-foot'), brandCount: $('brand-count'),
      hiddenLine: $('hidden-line'), hiddenNote: $('hidden-note'), hiddenRestore: $('hidden-restore'),
      addOpen: $('add-open'), addModal: $('add-modal'), addClose: $('add-close'), addCancel: $('add-cancel'),
      nearInput: $('near-input'), nearResults: $('near-results'), nearPick: $('near-pick'),
      nearGps: $('near-gps'), nearHubs: $('near-hubs'), nearNow: $('near-now'), nearCount: $('near-count'),
      addSearch: $('add-search'), addSearchBtn: $('add-search-btn'), addResults: $('add-results'),
      addSearchHint: $('add-search-hint'), addPhone: $('add-phone'),
      keyOpen: $('key-open'), kakaoKeyToggle: $('kakao-key-toggle'), kakaoKeyPanel: $('kakao-key-panel'),
      kakaoKeyInput: $('kakao-key-input'), kakaoKeyState: $('kakao-key-state'),
      kakaoKeySave: $('kakao-key-save'), kakaoKeyClear: $('kakao-key-clear'),
      addPick: $('add-pick'), addCoord: $('add-coord'), addName: $('add-name'), addDistrict: $('add-district'),
      addCat: $('add-cat'), addMenu: $('add-menu'), addMemo: $('add-memo'), addAddress: $('add-address'),
      addSave: $('add-save'), exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file'),
      customCount: $('custom-count')
    };

    initMap();
    renderHubs();
    bindEvents();
    applyViewport();
    bindSheetDrag();
    bindDetailDrag();
    renderKeyState();
    bindSearch('start');
    bindSearch('end');
    bindNearSearch();
    /* 저장해 둔 내 주변 기준 위치·반경 복원 */
    var savedNear = storeGet(LS_NEAR, null);
    if (savedNear && savedNear.near && isFinite(savedNear.near.lat) && isFinite(savedNear.near.lng)) {
      state.near = { name: savedNear.near.name || '지정한 위치', lat: +savedNear.near.lat, lng: +savedNear.near.lng };
      if (el.nearInput) el.nearInput.value = state.near.name;
    }
    if (savedNear && [1000, 3000, 5000].indexOf(+savedNear.radius) >= 0) state.nearRadius = +savedNear.radius;
    document.querySelectorAll('.seg-btn[data-nradius]').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.getAttribute('data-nradius'), 10) === state.nearRadius);
    });
    setMode('route', true);
    loadData();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (isMobile()) snapSheet(sheetState.idx);
        if (map) map.invalidateSize();
      }, 140);
    });
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', applyViewport);
    else if (mqMobile.addListener) mqMobile.addListener(applyViewport);

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
