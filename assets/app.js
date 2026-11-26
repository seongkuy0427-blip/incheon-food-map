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
  var LS_SUBWAY = 'incheonFoodMap.subway.v1';
  var LS_KAKAO = 'kakaoRestKey';        /* REST API 키 — 상호명·주소 검색 */
  var LS_KAKAO_JS = 'kakaoJsKey';       /* JavaScript 키 — 진짜 카카오맵 지도 */

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

  /* 인천을 지나는 6개 노선 — 역 순서·노선색은 공식 노선도 기준.
     역 좌표는 카카오맵 지하철역(노선별) 좌표를 기준으로 하고, OSM(Nominatim)·위키백과 좌표와 교차 검증했다(2026-11).
     transfer 표시는 같은 이름의 역이 다른 노선에도 있는지로 계산한다. */
  var LINES = [
    { id: 'incheon1', name: '인천1호선', color: '#6F99D0', stations: [
      ['계양', 37.571518, 126.736335], ['귤현', 37.566299, 126.742679], ['박촌', 37.553661, 126.745067],
      ['임학', 37.545012, 126.738633], ['계산', 37.543308, 126.727731], ['경인교대입구', 37.538124, 126.722631],
      ['작전', 37.530271, 126.722561], ['갈산', 37.517118, 126.721551], ['부평구청', 37.508466, 126.720583],
      ['부평시장', 37.498364, 126.722285], ['부평', 37.490377, 126.723455], ['동수', 37.485507, 126.718606],
      ['부평삼거리', 37.477835, 126.710294], ['간석오거리', 37.467083, 126.707918], ['인천시청', 37.457736, 126.702236],
      ['예술회관', 37.448526, 126.700916], ['인천터미널', 37.441917, 126.699695], ['문학경기장', 37.434651, 126.698449],
      ['선학', 37.426947, 126.698923], ['신연수', 37.418108, 126.694020], ['원인재', 37.412369, 126.687889],
      ['동춘', 37.404576, 126.680851], ['동막', 37.397942, 126.673448], ['캠퍼스타운', 37.388443, 126.662206],
      ['테크노파크', 37.382281, 126.656299], ['지식정보단지', 37.377507, 126.645861], ['인천대입구', 37.386206, 126.639542],
      ['센트럴파크', 37.392846, 126.634989], ['국제업무지구', 37.399658, 126.630542], ['송도달빛축제공원', 37.406920, 126.626018],
    ] },
    { id: 'incheon2', name: '인천2호선', color: '#ED8B00', stations: [
      ['검단오류', 37.594942, 126.627905], ['왕길', 37.595130, 126.642477], ['검단사거리', 37.601660, 126.656438],
      ['마전', 37.597635, 126.667221], ['완정', 37.592841, 126.673034], ['독정', 37.584848, 126.676003],
      ['검암', 37.568677, 126.675675], ['검바위', 37.561126, 126.677531], ['아시아드경기장', 37.551314, 126.677106],
      ['서해구청', 37.544045, 126.676844], ['가정', 37.524818, 126.675359], ['가정중앙시장', 37.517526, 126.676822],
      ['석남', 37.507474, 126.676300], ['서부여성회관', 37.500345, 126.675868], ['인천가좌', 37.489835, 126.675243],
      ['가재울', 37.484150, 126.683768], ['주안국가산단', 37.473913, 126.681220], ['주안', 37.465155, 126.679016],
      ['시민공원', 37.458385, 126.681075], ['석바위시장', 37.457669, 126.692353], ['인천시청', 37.456913, 126.701104],
      ['석천사거리', 37.456789, 126.710422], ['모래내시장', 37.455863, 126.719622], ['만수', 37.454976, 126.731736],
      ['남동구청', 37.448175, 126.736566], ['인천대공원', 37.448477, 126.752852], ['운연', 37.439643, 126.759607],
    ] },
    { id: 'line1', name: '1호선', color: '#0052A4', stations: [
      ['부개', 37.488477, 126.740730], ['부평', 37.489449, 126.724331], ['백운', 37.483342, 126.707294],
      ['동암', 37.470696, 126.702890], ['간석', 37.464706, 126.693519], ['주안', 37.465052, 126.679968],
      ['도화', 37.466118, 126.668576], ['제물포', 37.466819, 126.657494], ['도원', 37.468773, 126.642535],
      ['동인천', 37.475402, 126.632616], ['인천', 37.476167, 126.616822],
    ] },
    { id: 'suin', name: '수인분당선', color: '#F5A200', stations: [
      ['소래포구', 37.400940, 126.733492], ['인천논현', 37.400659, 126.722452], ['호구포', 37.401642, 126.708683],
      ['남동인더스파크', 37.407742, 126.695227], ['원인재', 37.413212, 126.686458], ['연수', 37.417928, 126.678747],
      ['송도', 37.429962, 126.654676], ['인하대', 37.448339, 126.649763], ['숭의', 37.460800, 126.638410],
      ['신포', 37.468453, 126.624533], ['인천', 37.476470, 126.617396],
    ] },
    { id: 'airport', name: '공항철도', color: '#0090D2', stations: [
      ['계양', 37.571771, 126.736274], ['검암', 37.569253, 126.673642], ['청라국제도시', 37.556464, 126.624660],
      ['영종', 37.512029, 126.524974], ['운서', 37.492808, 126.493729], ['공항화물청사', 37.459061, 126.477516],
      ['인천공항1터미널', 37.447529, 126.452585], ['인천공항2터미널', 37.468801, 126.433643],
    ] },
    { id: 'seoul7', name: '서울7호선', color: '#747F00', stations: [
      ['굴포천', 37.507046, 126.731348], ['부평구청', 37.507433, 126.721440], ['산곡', 37.508607, 126.703544],
      ['석남', 37.506243, 126.676149],
    ] },
  ];
  var LINE_BY_ID = {};
  LINES.forEach(function (ln) { LINE_BY_ID[ln.id] = ln; });
  /* 2026년 서구 → 서해구 개편으로 역명이 바뀐 곳: 예전 이름으로도 찾히게 */
  var STATION_ALIAS = { '서해구청': '서구청' };

  /* 업종 칩: 이모지 + 선택 시 컬러 */
  var CAT_META = {
    '한식': { emoji: '🍚', color: '#EA580C' },
    '국밥': { emoji: '🍲', color: '#B45309' },
    '중식': { emoji: '🥟', color: '#DC2626' },
    '일식': { emoji: '🍣', color: '#2563EB' },
    '양식': { emoji: '🍝', color: '#7C3AED' },
    '해산물': { emoji: '🦐', color: '#0891B2' },
    '고기': { emoji: '🥩', color: '#BE123C' },
    '면·분식': { emoji: '🍜', color: '#65A30D' },
    '카페·디저트': { emoji: '☕', color: '#92400E' }
  };

  var state = {
    region: '인천',
    base: [],
    custom: [],
    data: [],
    hidden: [],
    meta: {},
    start: null,
    end: null,
    mode: 'route',          /* route | near | subway | district */
    travel: 'car',
    radius: 1000,
    routeSort: 'along',     /* along | near */
    nearSort: 'dist',       /* dist | rank */
    districtSort: 'rank',   /* rank | name */
    near: null,             /* 기준 위치 {name, lat, lng} */
    nearRadius: 3000,       /* 1000 | 3000 | 5000 */
    subway: { line: 'incheon1', station: null, radius: 1000, sort: 'dist' },  /* station: null이면 호선 전체 */
    foodGroup: 'all',       /* all | meal | cafe */
    cats: [],               /* 선택한 식사 세부 업종 */
    tiers: { michelin: true, blueribbon: true, local: true, custom: true },
    district: 'all',
    route: null,
    picking: null,          /* start | end | custom */
    selected: null,
    loading: false
  };

  var engine = null;                    /* 현재 지도 엔진(leaflet | kakao) */
  var engineState = { kind: 'leaflet', note: '', fallback: false };
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

  /* JavaScript 키: 카카오맵 지도 엔진용. 이것도 코드·저장소에 넣지 않고 localStorage에만 둔다. */
  function kakaoJsKey() {
    var v = storeGet(LS_KAKAO_JS, '');
    return typeof v === 'string' ? v.trim() : '';
  }

  function setKakaoJsKey(key) {
    if (key) storeSet(LS_KAKAO_JS, key);
    else { try { localStorage.removeItem(LS_KAKAO_JS); } catch (e) { /* 저장 불가 */ } }
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

  /* ── 지도 엔진 어댑터 (Leaflet ↔ 카카오맵) ─────────
     두 엔진을 같은 인터페이스로 감싸서 모든 모드·필터·핀 클릭·반경 원이
     어느 엔진에서도 똑같이 동작하게 한다. 키는 localStorage에만 둔다. */
  var KAKAO_SDK_BASE = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=';

  function mercX(lng, z) { return (lng + 180) / 360 * 256 * Math.pow(2, z); }
  function mercY(lat, z) {
    var s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z);
  }
  function mercLng(x, z) { return x / (256 * Math.pow(2, z)) * 360 - 180; }
  function mercLat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / (256 * Math.pow(2, z));
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  function kakaoLevelOf(zoom) { return Math.max(1, Math.min(14, Math.round(19 - zoom))); }
  function zoomOfLevel(level) { return 19 - level; }

  /* 두 엔진 공통: 좌표 한 점에 0×0 HTML 상자를 놓고 그 안에 핀·라벨을 절대배치한다 */
  function overlayNode(html, cls) {
    var d = document.createElement('div');
    d.className = 'ov' + (cls ? ' ' + cls : '');
    d.innerHTML = html;
    return d;
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error(label || 'timeout')); }, ms);
      promise.then(function (v) { clearTimeout(t); resolve(v); },
        function (e) { clearTimeout(t); reject(e); });
    });
  }

  /* ── Leaflet 엔진 ─────────────────────────────── */
  function createLeafletEngine(center, zoom) {
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([center.lat, center.lng], zoom);
    /* 공개 타일 중 키·워터마크 없이 동작하는 OSM을 쓰고, 타일 팬에만 색 보정(실버-블루 톤)을 준다.
       (CartoDB Positron은 2026-11 현재 'API KEY REQUIRED' 워터마크가 찍혀 사용 불가) */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 8,
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: true
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    var groups = {
      route: L.layerGroup().addTo(map),
      hubs: L.layerGroup().addTo(map),
      near: L.layerGroup().addTo(map),
      subway: L.layerGroup().addTo(map),
      rest: L.layerGroup().addTo(map)
    };
    var handlers = { click: [], moveend: [] };
    map.on('click', function (e) {
      handlers.click.forEach(function (f) { f({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    });
    map.on('moveend zoomend', function () {
      handlers.moveend.forEach(function (f) { f(); });
    });

    return {
      kind: 'leaflet',
      raw: map,
      on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
      size: function () { var s = map.getSize(); return { x: s.x, y: s.y }; },
      center: function () { var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
      zoom: function () { return map.getZoom(); },
      setView: function (c, z) { map.setView([c.lat, c.lng], z, { animate: false }); },
      flyTo: function (c, z) { map.flyTo([c.lat, c.lng], z, { duration: 0.6 }); },
      invalidate: function () { map.invalidateSize(); },
      zoomIn: function () { map.zoomIn(); },
      zoomOut: function () { map.zoomOut(); },
      containerPoint: function (p) {
        var pt = map.latLngToContainerPoint([p.lat, p.lng]);
        return { x: pt.x, y: pt.y };
      },
      clear: function (g) { groups[g].clearLayers(); },
      polyline: function (g, pts, st) {
        return L.polyline(pts.map(function (p) { return [p.lat, p.lng]; }), {
          color: st.color,
          weight: st.weight,
          opacity: st.opacity == null ? 1 : st.opacity,
          dashArray: st.dash ? '1 9' : null,
          lineCap: 'round', lineJoin: 'round', interactive: false
        }).addTo(groups[g]);
      },
      circle: function (g, c, r, st) {
        return L.circle([c.lat, c.lng], {
          radius: r,
          color: st.color,
          weight: st.weight == null ? 1.5 : st.weight,
          opacity: st.opacity == null ? 0.8 : st.opacity,
          fillColor: st.fillColor,
          fillOpacity: st.fillOpacity == null ? 0.1 : st.fillOpacity,
          interactive: false
        }).addTo(groups[g]);
      },
      overlay: function (g, o) {
        var m = L.marker([o.lat, o.lng], {
          icon: L.divIcon({ className: 'ov-wrap', html: o.node, iconSize: [0, 0], iconAnchor: [0, 0] }),
          keyboard: false,
          zIndexOffset: o.zIndex || 0,
          interactive: o.interactive !== false
        });
        if (o.onClick) m.on('click', function (e) { L.DomEvent.stop(e); o.onClick(); });
        m.addTo(groups[g]);
        return m;
      },
      destroy: function () { map.remove(); }
    };
  }

  /* ── 카카오맵 엔진 ─────────────────────────────── */
  function createKakaoEngine(center, zoom) {
    var host = $('map');
    /* 카카오 SDK가 컨테이너 스타일을 직접 만지므로, #map 레이아웃은 건드리지 않도록 안쪽 홀더를 둔다 */
    var holder = document.createElement('div');
    holder.id = 'kakao-map';
    holder.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    host.appendChild(holder);
    var map = new kakao.maps.Map(holder, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level: kakaoLevelOf(zoom),
      draggable: true,
      scrollwheel: true
    });
    var groups = { route: [], hubs: [], near: [], subway: [], rest: [] };
    var handlers = { click: [], moveend: [] };

    kakao.maps.event.addListener(map, 'click', function (me) {
      var ll = me.latLng;
      handlers.click.forEach(function (f) { f({ lat: ll.getLat(), lng: ll.getLng() }); });
    });
    kakao.maps.event.addListener(map, 'idle', function () {
      handlers.moveend.forEach(function (f) { f(); });
    });

    function toLatLng(p) { return new kakao.maps.LatLng(p.lat, p.lng); }

    return {
      kind: 'kakao',
      raw: map,
      on: function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
      size: function () {
        return { x: holder.clientWidth, y: holder.clientHeight };
      },
      center: function () {
        var c = map.getCenter();
        return { lat: c.getLat(), lng: c.getLng() };
      },
      zoom: function () { return zoomOfLevel(map.getLevel()); },
      setView: function (c, z) {
        map.setLevel(kakaoLevelOf(z), { animate: false });
        map.setCenter(toLatLng(c));
      },
      flyTo: function (c, z) {
        map.setLevel(kakaoLevelOf(z));
        map.panTo(toLatLng(c));
      },
      invalidate: function () {
        try { map.relayout(); } catch (e) { /* noop */ }
      },
      zoomIn: function () { map.setLevel(Math.max(1, map.getLevel() - 1)); },
      zoomOut: function () { map.setLevel(Math.min(14, map.getLevel() + 1)); },
      containerPoint: function (p) {
        var pt = map.getProjection().containerPointFromCoords(toLatLng(p));
        return { x: pt.x, y: pt.y };
      },
      clear: function (g) {
        groups[g].forEach(function (o) { try { o.setMap(null); } catch (e) { /* noop */ } });
        groups[g] = [];
      },
      polyline: function (g, pts, st) {
        var line = new kakao.maps.Polyline({
          path: pts.map(toLatLng),
          strokeColor: st.color,
          strokeWeight: st.weight,
          strokeOpacity: st.opacity == null ? 1 : st.opacity,
          strokeStyle: st.dash ? 'dashed' : 'solid'
        });
        line.setMap(map);
        groups[g].push(line);
        return line;
      },
      circle: function (g, c, r, st) {
        var cir = new kakao.maps.Circle({
          center: toLatLng(c),
          radius: r,
          strokeColor: st.color,
          strokeWeight: st.weight == null ? 1.5 : st.weight,
          strokeOpacity: st.opacity == null ? 0.8 : st.opacity,
          strokeStyle: 'solid',
          fillColor: st.fillColor,
          fillOpacity: st.fillOpacity == null ? 0.1 : st.fillOpacity
        });
        cir.setMap(map);
        groups[g].push(cir);
        return cir;
      },
      overlay: function (g, o) {
        o.node.style.pointerEvents = 'auto';
        var ov = new kakao.maps.CustomOverlay({
          position: toLatLng(o),
          content: o.node,
          xAnchor: 0,
          yAnchor: 0,
          zIndex: o.zIndex || 1,
          clickable: o.interactive !== false
        });
        ov.setMap(map);
        if (o.onClick) {
          o.node.addEventListener('click', function (ev) {
            ev.stopPropagation();
            o.onClick();
          });
        }
        groups[g].push(ov);
        return ov;
      },
      destroy: function () {
        Object.keys(groups).forEach(function (g) {
          groups[g].forEach(function (o) { try { o.setMap(null); } catch (e) { /* noop */ } });
          groups[g] = [];
        });
        try { host.innerHTML = ''; } catch (e) { /* noop */ }
      }
    };
  }

  /* ── 엔진 부팅·전환·폴백 ─────────────────────────── */
  var sdkLoading = null;

  function loadKakaoSdk(key) {
    if (window.kakao && window.kakao.maps && window.__kakaoSdkKey === key) {
      return withTimeout(new Promise(function (resolve) {
        window.kakao.maps.load(function () { resolve(true); });
      }), 8000, 'sdk-callback');
    }
    if (sdkLoading && sdkLoading.key === key) return sdkLoading.promise;
    var promise = new Promise(function (resolve, reject) {
      var old = document.getElementById('kakao-sdk');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var s = document.createElement('script');
      s.id = 'kakao-sdk';
      s.async = true;
      s.src = KAKAO_SDK_BASE + encodeURIComponent(key) + '&autoload=false';
      s.onload = function () {
        if (!window.kakao || !window.kakao.maps) { reject(new Error('sdk-empty')); return; }
        window.__kakaoSdkKey = key;
        try {
          window.kakao.maps.load(function () { resolve(true); });
        } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error('script-error')); };
      document.head.appendChild(s);
    });
    promise.catch(function () {
      /* 실패한 로드는 캐시하지 않는다 — 도메인을 고친 뒤 다시 저장하면 재시도 */
      if (sdkLoading && sdkLoading.promise === promise) sdkLoading = null;
    });
    sdkLoading = { key: key, promise: promise };
    return promise;
  }

  function updateEngineUi() {
    var label = engineState.kind === 'kakao' ? '카카오맵'
      : engineState.kind === 'kakao-loading' ? '카카오맵 준비 중…'
      : engineState.fallback ? '기본 지도(OSM) · 카카오맵 대신' : '기본 지도(OSM)';
    if (el.mapEngineLabel) el.mapEngineLabel.textContent = label;
    if (el.mapEngineNote) {
      el.mapEngineNote.textContent = engineState.note || '';
      el.mapEngineNote.hidden = !engineState.note;
    }
    if (el.kakaoZoom) el.kakaoZoom.hidden = engineState.kind !== 'kakao';
    document.body.classList.toggle('engine-kakao', engineState.kind === 'kakao');
    document.body.classList.toggle('engine-leaflet', engineState.kind !== 'kakao');
    if (el.keyOpen) el.keyOpen.classList.toggle('on', !!(kakaoJsKey() || kakaoKey()));
  }

  function kakaoTilesPresent() {
    if (document.querySelectorAll('#map img').length > 0) return true;
    var nodes = document.querySelectorAll('#map div');
    for (var i = 0; i < nodes.length; i++) {
      var bg = nodes[i].style && nodes[i].style.backgroundImage;
      if (bg && (bg.indexOf('daumcdn') >= 0 || bg.indexOf('kakao') >= 0)) return true;
    }
    return false;
  }

  /* 카카오맵이 타일을 실제로 그렸는지 확인. 도메인·키가 틀리면 타일이 오지 않아 빈 화면이 되므로
     그때는 자동으로 Leaflet으로 되돌린다. */
  function watchKakaoTiles() {
    return new Promise(function (resolve, reject) {
      var done = false;
      function ok() { if (!done) { done = true; resolve(true); } }
      try {
        kakao.maps.event.addListener(engine.raw, 'tilesloaded', ok);
      } catch (e) { /* noop */ }
      setTimeout(function () {
        if (done) return;
        done = true;
        if (kakaoTilesPresent()) { resolve(true); return; }
        reject(new Error('tiles'));
      }, 8000);
    });
  }

  function bootMap(kind) {
    var cfg = REGIONS[state.region];
    var prev = engine ? { center: engine.center(), zoom: engine.zoom() } : null;
    var host = $('map');
    if (engine) { try { engine.destroy(); } catch (e) { /* noop */ } engine = null; }
    host.innerHTML = '';
    host.removeAttribute('style');

    var center = prev ? prev.center : { lat: cfg.center[0], lng: cfg.center[1] };
    var zoom = prev ? prev.zoom : cfg.zoom;

    engine = kind === 'kakao' ? createKakaoEngine(center, zoom) : createLeafletEngine(center, zoom);
    engineState.kind = kind;
    if (kind === 'kakao') engineState.fallback = false;

    engine.on('click', handleMapClick);
    engine.on('moveend', function () {
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(function () {
        if (!state.data.length) return;
        renderMarkers();
        if (state.mode === 'subway') drawSubway();
      }, 170);
    });
    window.__engine = engine;
    window.__appState = state;
    if (kind === 'leaflet') window.__map = engine.raw;
    updateEngineUi();
    return engine;
  }

  function startMap(forceKind) {
    var key = kakaoJsKey();
    var want = forceKind || (key ? 'kakao' : 'leaflet');
    if (want !== 'kakao') {
      bootMap('leaflet');
      engineState.note = '';
      engineState.fallback = false;
      updateEngineUi();
      return Promise.resolve();
    }
    engineState.kind = 'kakao-loading';
    engineState.note = key ? '' : '카카오 JavaScript 키가 없어 기본 지도로 표시합니다.';
    updateEngineUi();
    return withTimeout(loadKakaoSdk(key), 9000, 'sdk-timeout')
      .then(function () {
        bootMap('kakao');
        return watchKakaoTiles();
      })
      .then(function () {
        engineState.note = '';
        updateEngineUi();
      })
      .catch(function (err) {
        bootMap('leaflet');
        engineState.fallback = true;
        engineState.note = '카카오 JavaScript 키 또는 허용 도메인 https://seongkuy0427-blip.github.io 를 확인해 주세요. 지금은 기본 지도로 표시합니다.';
        updateEngineUi();
        console.warn('[map] 카카오맵 대신 기본 지도로 표시합니다:', err && err.message);
        toast('카카오맵을 열지 못해 기본 지도로 표시합니다. JavaScript 키·허용 도메인을 확인해 주세요.', 5600);
      });
  }

  /* 키를 새로 넣거나 지웠을 때: 보던 위치를 유지한 채 엔진만 갈아 끼운다 */
  function switchEngine(kind) {
    return startMap(kind).then(function () {
      if (!engine) return;
      refreshMapContents();
    });
  }

  function refreshMapContents() {
    drawRoute(state.route);
    drawHubs();
    drawNear();
    renderMarkers();
  }

  /* 핀·라벨 HTML: 두 엔진이 같은 마크업을 쓴다 */
  function pinOverlayHtml(tier, selected, name) {
    var box = selected
      ? 'left:-15px;top:-22px;width:30px;height:30px'
      : 'left:-11px;top:-17px;width:22px;height:22px';
    var html = '<span class="pin ' + tier + (selected ? ' sel' : '') +
      '" style="position:absolute;' + box + '"><i></i></span>';
    if (name) html += '<span class="ov-label' + (selected ? ' sel' : '') + '">' + esc(name) + '</span>';
    return html;
  }

  function endpointOverlayHtml(kind, name) {
    var box = kind === 'start'
      ? 'left:-12px;top:-12px;width:24px;height:24px'
      : 'left:-13px;top:-20px;width:26px;height:26px';
    return '<span class="endpoint ' + kind + '" style="position:absolute;' + box + '"><i></i></span>' +
      '<span class="ov-tag ' + kind + '" style="position:absolute;left:0;' +
      (kind === 'start' ? 'top:-18px' : 'top:-26px') + '">' +
      esc((kind === 'start' ? '출발 · ' : '도착 · ') + name) + '</span>';
  }

  function hubOverlayHtml(name) {
    return '<span class="hub-pin" style="position:absolute;left:-3.5px;top:-3.5px"></span>' +
      '<span class="hub-label" style="position:absolute;left:6px;top:-7px">' + esc(name) + '</span>';
  }

  function nearOverlayHtml(showLabel, name) {
    var html = '<span class="near-pin" style="position:absolute;left:-13px;top:-13px"><i></i></span>';
    if (showLabel) {
      html += '<span class="ov-tag near" style="position:absolute;left:0;top:-20px">' +
        esc('기준 위치 · ' + name) + '</span>';
    }
    return html;
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
      var meta = CAT_META[c] || { emoji: '', color: '#475569' };
      var on = state.cats.indexOf(c) >= 0;
      html += '<button type="button" class="chip cat' + (on ? ' on' : '') + '" data-cat="' + esc(c) +
        '" style="--c:' + meta.color + '" aria-pressed="' + on + '">' +
        (meta.emoji ? '<span class="chip-emoji" aria-hidden="true">' + meta.emoji + '</span>' : '') + esc(c) + '</button>';
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
    LINES.forEach(function (ln) {
      ln.stations.forEach(function (s) {
        var nm = s[0] + '역';
        var hay = (nm + ' ' + (STATION_ALIAS[s[0]] || '')).replace(/\s+/g, '').toLowerCase();
        if (hay.indexOf(key) >= 0) {
          out.push({ name: nm, lat: s[1], lng: s[2], meta: '지하철역 · ' + ln.name });
        }
      });
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
      if (engine) engine.clear('route');
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
    if (!engine) return;
    engine.clear('route');
    if (!route) return;
    if (route.line && route.line.length >= 2) {
      var pts = route.line.map(function (p) { return { lat: p[0], lng: p[1] }; });
      /* 세 겹: 부드러운 외곽 글로우 → 화이트 케이싱 → 4px 메인 라인 */
      engine.polyline('route', pts, { color: '#6366F1', weight: 15, opacity: 0.16 });
      engine.polyline('route', pts, { color: '#FFFFFF', weight: 8, opacity: 0.95 });
      engine.polyline('route', pts, {
        color: '#4F46E5', weight: 4, opacity: 1, dash: route.kind !== 'road'
      });
    }

    if (state.start) {
      engine.overlay('route', {
        lat: state.start.lat, lng: state.start.lng, zIndex: 30, interactive: false,
        node: overlayNode(endpointOverlayHtml('start', state.start.name))
      });
    }
    if (state.end) {
      engine.overlay('route', {
        lat: state.end.lat, lng: state.end.lng, zIndex: 30, interactive: false,
        node: overlayNode(endpointOverlayHtml('end', state.end.name))
      });
    }
  }

  function drawHubs() {
    if (!engine) return;
    engine.clear('hubs');
    if (state.travel !== 'transit' || state.mode !== 'route') return;
    HUBS.forEach(function (h) {
      engine.overlay('hubs', {
        lat: h.lat, lng: h.lng, interactive: false, zIndex: 5,
        node: overlayNode(hubOverlayHtml(h.name))
      });
    });
  }

  /* 패널·바텀시트에 가리지 않는 영역에 맞춰 지도를 맞춘다 */
  function fitPadding() {
    if (isMobile()) {
      return {
        left: 26,
        top: 122,
        right: 26,
        bottom: Math.round(sheetHeight() + 26)
      };
    }
    var left = (el.panel ? el.panel.getBoundingClientRect().width : 392) + 48;
    return { left: left, top: 34, right: 34, bottom: 34 };
  }

  /* 두 엔진 공통 fitBounds: 가려지는 패딩을 뺀 영역 중앙에 bounds를 맞춘다 */
  function fitTo(points, opts) {
    if (!engine || !points || !points.length) return;
    opts = opts || {};
    var pad = opts.padding || fitPadding();
    var size = engine.size();
    var w = size.x, h = size.y;
    if (!w || !h) return;
    var availW = Math.max(120, w - pad.left - pad.right);
    var availH = Math.max(120, h - pad.top - pad.bottom);
    var minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    points.forEach(function (p) {
      if (!isFinite(p.lat) || !isFinite(p.lng)) return;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });
    if (minLat > maxLat) return;
    var center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
    var spanLat = maxLat - minLat, spanLng = maxLng - minLng;
    var z = 19;
    for (; z > 8; z--) {
      var bw = Math.abs(mercX(maxLng, z) - mercX(minLng, z));
      var bh = Math.abs(mercY(minLat, z) - mercY(maxLat, z));
      if (bw <= availW && bh <= availH) break;
    }
    if (z < 8) z = 8;
    if (opts.maxZoom) z = Math.min(z, opts.maxZoom);
    if (spanLat < 1e-6 && spanLng < 1e-6) z = Math.min(opts.maxZoom || 16, 16);
    var boxX = pad.left + availW / 2, boxY = pad.top + availH / 2;
    var cx = mercX(center.lng, z) + (w / 2 - boxX);
    var cy = mercY(center.lat, z) + (h / 2 - boxY);
    engine.setView({ lat: mercLat(cy, z), lng: mercLng(cx, z) }, z);
  }

  function fitRouteView() {
    var pts = [];
    if (state.route && state.route.line && state.route.line.length >= 2) {
      pts = state.route.line.map(function (p) { return { lat: p[0], lng: p[1] }; });
    } else if (state.start && state.end) {
      pts = [state.start, state.end];
    } else {
      return;
    }
    visible().forEach(function (rec) { pts.push({ lat: rec.r.lat, lng: rec.r.lng }); });
    fitTo(pts);
  }

  function fitAll() {
    var rows = state.data.filter(function (r) { return !isHidden(r); });
    if (!rows.length) return;
    fitTo(rows.map(function (r) { return { lat: r.lat, lng: r.lng }; }));
  }

  function fitDistrict() {
    var rows = state.data.filter(function (r) {
      return !isHidden(r) && (state.district === 'all' || r.district === state.district);
    });
    if (!rows.length) { toast('이 지역구에 표시할 맛집이 없습니다.'); return; }
    fitTo(rows.map(function (r) { return { lat: r.lat, lng: r.lng }; }), { maxZoom: 15 });
  }

  /* ── 내 주변 ─────────────────────────────────── */
  function saveNear() {
    storeSet(LS_NEAR, { near: state.near, radius: state.nearRadius });
  }

  function nearCornerPoints() {
    if (!state.near) return [];
    var dLat = state.nearRadius / 111320;
    var dLng = state.nearRadius / (111320 * Math.cos(state.near.lat * Math.PI / 180));
    return [
      { lat: state.near.lat - dLat, lng: state.near.lng - dLng },
      { lat: state.near.lat + dLat, lng: state.near.lng + dLng }
    ];
  }

  function fitNear() {
    if (!state.near) { fitAll(); return; }
    fitTo(nearCornerPoints(), { maxZoom: 15 });
  }

  function drawNear() {
    if (!engine) return;
    engine.clear('near');
    if (state.mode !== 'near' || !state.near) return;
    engine.circle('near', { lat: state.near.lat, lng: state.near.lng }, state.nearRadius, {
      color: '#0D9488', weight: 1.5, opacity: 0.85,
      fillColor: '#14B8A6', fillOpacity: 0.12
    });
    var label = state.near.name.length > 16 ? state.near.name.slice(0, 15) + '…' : state.near.name;
    engine.overlay('near', {
      lat: state.near.lat, lng: state.near.lng, zIndex: 1200, interactive: false,
      node: overlayNode(nearOverlayHtml(!isMobile(), label))
    });
  }

  function nearNowText() {
    if (!el.nearNow) return;
    if (!state.near) {
      el.nearNow.innerHTML = '아직 기준 위치가 없습니다. <b>내 위치(GPS)</b>·검색·지도 클릭 중 편한 방법으로 정해 주세요. 역 주변은 <b>지하철 주변</b> 탭에서 고를 수 있습니다.';
      return;
    }
    el.nearNow.innerHTML = '기준 위치 <b>' + esc(state.near.name) + '</b>' +
      (lineTagsHtml(state.near.name) ? ' ' + lineTagsHtml(state.near.name) : '') +
      ' · 반경 ' + fmtDist(state.nearRadius) + ' 안의 맛집을 ' +
      (state.nearSort === 'rank' ? '추천·인기순' : '가까운 순') + '으로 보여 줍니다.';
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

  /* ── 지하철 주변 ─────────────────────────────── */
  function lineTagsHtml(name) {
    var base = String(name || '').replace(/\s*근처$/, '').replace(/역$/, '');
    var found = [];
    LINES.forEach(function (ln) {
      var hit = ln.stations.some(function (s) { return s[0] === base || (STATION_ALIAS[s[0]] || '') === base; });
      if (hit) found.push(ln);
    });
    return found.map(function (ln) {
      return '<span class="line-tag" style="--lt:' + ln.color + '"><i class="line-dot" style="background:' + ln.color + '"></i>' + esc(ln.name) + '</span>';
    }).join('');
  }

  function transferLines(name, selfId) {
    return LINES.filter(function (ln) {
      if (ln.id === selfId) return false;
      return ln.stations.some(function (s) { return s[0] === name; });
    });
  }

  function isTransferName(name) {
    var n = 0;
    LINES.forEach(function (ln) {
      if (ln.stations.some(function (s) { return s[0] === name; })) n++;
    });
    return n > 1;
  }

  function subwayLine() { return LINE_BY_ID[state.subway.line] || LINES[0]; }

  function subwayStationEntry() {
    var ln = subwayLine(), name = state.subway.station;
    if (!name) return null;
    for (var i = 0; i < ln.stations.length; i++) if (ln.stations[i][0] === name) return ln.stations[i];
    return null;
  }

  function nearestStationOn(lat, lng, ln) {
    var best = null, bd = Infinity;
    ln.stations.forEach(function (s) {
      var d = haversine([lat, lng], [s[1], s[2]]);
      if (d < bd) { bd = d; best = s; }
    });
    return { station: best, dist: bd };
  }

  function saveSubway() {
    storeSet(LS_SUBWAY, {
      line: state.subway.line, station: state.subway.station,
      radius: state.subway.radius, sort: state.subway.sort
    });
  }

  /* 역 하나를 반경 안 맛집 개수까지 세어 준다(업종·등급 필터만 적용, 모드 조건 제외) */
  function countNearStation(st, radius) {
    var n = 0;
    state.data.forEach(function (r) {
      if (isHidden(r) || !tierOn(r)) return;
      if (state.foodGroup === 'cafe' && r.categoryGroup !== 'cafe') return;
      if (state.foodGroup === 'meal' && r.categoryGroup === 'cafe') return;
      if (state.foodGroup !== 'cafe' && state.cats.length && state.cats.indexOf(r.category) < 0) return;
      if (haversine([st[1], st[2]], [r.lat, r.lng]) <= radius) n++;
    });
    return n;
  }

  function renderSubwayLines() {
    if (!el.swLines) return;
    el.swLines.innerHTML = LINES.map(function (ln) {
      var on = ln.id === state.subway.line;
      return '<button type="button" class="sw-line' + (on ? ' on' : '') + '" data-line="' + ln.id + '"' +
        ' style="--line-color:' + ln.color + '" role="tab" aria-selected="' + (on ? 'true' : 'false') + '">' +
        '<i class="sw-line-badge"></i><span class="sw-line-name">' + esc(ln.name) + '</span>' +
        '<span class="sw-line-n">' + ln.stations.length + '</span></button>';
    }).join('');
  }

  function renderSubwayStations() {
    if (!el.swStations) return;
    var ln = subwayLine();
    var radius = state.subway.radius;
    var allOn = !state.subway.station;
    var html = '<button type="button" class="sw-all' + (allOn ? ' on' : '') + '" data-sw-all="1" aria-pressed="' + (allOn ? 'true' : 'false') + '" style="--line-color:' + ln.color + '">' +
      '<span class="sw-all-t">' + esc(ln.name) + ' 전체</span>' +
      '<span class="sw-all-s">역마다 반경 ' + fmtDist(radius) + ' 이내</span></button>';
    html += '<div class="sw-rail" style="--line-color:' + ln.color + '">';
    ln.stations.forEach(function (s) {
      var on = state.subway.station === s[0];
      var others = transferLines(s[0], ln.id);
      var tr = others.map(function (o) {
        return '<i class="sw-tr" style="background:' + o.color + '" title="환승 · ' + esc(o.name) + '"></i>';
      }).join('');
      var cnt = countNearStation(s, radius);
      html += '<button type="button" class="sw-st' + (on ? ' on' : '') + '" data-sw-station="' + esc(s[0]) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="sw-dot"></span>' +
        '<span class="sw-name">' + esc(s[0]) + (others.length ? '<span class="sw-tr-wrap">' + tr + '</span>' : '') + '</span>' +
        '<span class="sw-n' + (cnt ? '' : ' zero') + '">' + cnt + '</span></button>';
    });
    html += '</div>';
    el.swStations.innerHTML = html;
    /* 선택한 역이 목록 밖으로 밀려 있으면 레일 안에서만 중앙에 오게 한다 */
    var rail = el.swStations.querySelector('.sw-rail');
    var onEl = rail && rail.querySelector('.sw-st.on');
    if (rail && onEl) {
      var top = onEl.offsetTop - rail.clientHeight / 2 + onEl.offsetHeight / 2;
      rail.scrollTop = Math.max(0, top);
    }
  }

  function renderSubway() {
    renderSubwayLines();
    renderSubwayStations();
    if (el.swCount) el.swCount.textContent = LINES.length + '개 노선 · ' + LINES.reduce(function (n, l) { return n + l.stations.length; }, 0) + '개 역';
    document.querySelectorAll('.seg-btn[data-swradius]').forEach(function (b) {
      var on = parseInt(b.getAttribute('data-swradius'), 10) === state.subway.radius;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function stationOverlayHtml(name, color, active, showLabel) {
    return '<span class="sw-pin' + (active ? ' on' : '') + (isTransferName(name) ? ' transfer' : '') + '" style="--line-color:' + color + '">' +
      '<i class="sw-pin-dot"></i>' +
      (showLabel ? '<b class="sw-pin-label">' + esc(name) + '</b>' : '') + '</span>';
  }

  function drawSubway() {
    if (!engine) return;
    engine.clear('subway');
    if (state.mode !== 'subway') return;
    var ln = subwayLine();
    var st = subwayStationEntry();
    var color = ln.color;
    var pts = ln.stations.map(function (s) { return { lat: s[1], lng: s[2] }; });

    engine.polyline('subway', pts, { color: '#FFFFFF', weight: 10, opacity: 0.9 });
    engine.polyline('subway', pts, { color: color, weight: 5.5, opacity: 0.95 });

    if (!st) {
      ln.stations.forEach(function (s) {
        engine.circle('subway', { lat: s[1], lng: s[2] }, state.subway.radius, {
          color: color, weight: 0, opacity: 0, fillColor: color, fillOpacity: 0.07
        });
      });
    } else {
      engine.circle('subway', { lat: st[1], lng: st[2] }, state.subway.radius, {
        color: color, weight: 1.6, opacity: 0.9, fillColor: color, fillOpacity: 0.13
      });
    }

      var zoom = engine.zoom();
      var nameAll = zoom >= 13 || ln.stations.length <= 8;
      ln.stations.forEach(function (s) {
        var on = !!st && st[0] === s[0];
        var showLabel = nameAll || on || isTransferName(s[0]);
        var node = overlayNode(stationOverlayHtml(s[0], color, on, showLabel), 'ov-sw');
        node.setAttribute('title', s[0] + '역' + (isTransferName(s[0]) ? ' · 환승' : ''));
        engine.overlay('subway', {
          lat: s[1], lng: s[2], node: node, zIndex: on ? 1250 : 40,
          onClick: function () { selectSubwayStation(s[0]); }
        });
      });

    /* 선택한 역은 점 자체를 크게 표시한다(핀·라벨 중복 없이) */
  }

  function fitSubway() {
    var ln = subwayLine();
    var st = subwayStationEntry();
    if (st) {
      var dLat = state.subway.radius / 111320;
      var dLng = state.subway.radius / (111320 * Math.cos(st[1] * Math.PI / 180));
      fitTo([
        { lat: st[1] - dLat, lng: st[2] - dLng },
        { lat: st[1] + dLat, lng: st[2] + dLng }
      ], { maxZoom: 15 });
      return;
    }
    fitTo(ln.stations.map(function (s) { return { lat: s[1], lng: s[2] }; }), { maxZoom: 13 });
  }

  function selectSubwayStation(name) {
    var ln = subwayLine();
    var st = null;
    for (var i = 0; i < ln.stations.length; i++) if (ln.stations[i][0] === name) st = ln.stations[i];
    if (!st) return;
    state.subway.station = name;
    state.subway.sort = 'dist';
    saveSubway();
    if (state.mode !== 'subway') setMode('subway', true);
    renderSubway();
    drawSubway();
    renderSummary();
    renderList();
    renderMarkers();
    fitSubway();
    toast(st[0] + '역 · 반경 ' + fmtDist(state.subway.radius), 1800);
  }

  function setSubwayLine(id) {
    if (!LINE_BY_ID[id] || id === state.subway.line) {
      if (state.mode !== 'subway') setMode('subway');
      return;
    }
    state.subway.line = id;
    state.subway.station = null;
    saveSubway();
    renderSubway();
    if (state.mode !== 'subway') setMode('subway', true);
    drawSubway();
    renderSummary();
    renderList();
    renderMarkers();
    fitSubway();
  }

  function setSubwayRadius(r) {
    state.subway.radius = r;
    saveSubway();
    renderSubway();
    if (state.mode === 'subway') {
      drawSubway();
      renderSummary();
      renderList();
      renderMarkers();
      fitSubway();
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
      if (state.mode === 'subway') {
        var ln = subwayLine();
        var st = subwayStationEntry();
        if (st) {
          rec.sdist = haversine([st[1], st[2]], [r.lat, r.lng]);
          rec.sst = st;
        } else {
          var nrst = nearestStationOn(r.lat, r.lng, ln);
          rec.sdist = nrst.dist;
          rec.sst = nrst.station;
        }
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
      if (state.mode === 'near') {
        if (!state.near || rec.near == null) return false;
        return rec.near <= state.nearRadius;
      }
      if (state.mode === 'subway') {
        return rec.sdist != null && rec.sdist <= state.subway.radius;
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
      if (state.nearSort === 'rank') rankSort(out);
      else out.sort(function (a, b) { return (a.near == null ? 1e12 : a.near) - (b.near == null ? 1e12 : b.near); });
    } else if (state.mode === 'subway') {
      if (state.subway.sort === 'rank') rankSort(out);
      else out.sort(function (a, b) { return (a.sdist == null ? 1e12 : a.sdist) - (b.sdist == null ? 1e12 : b.sdist); });
    } else if (state.mode === 'district') {
      if (state.districtSort === 'name') out.sort(byName);
      else rankSort(out);
    } else if (state.mode === 'route' && state.route && state.routeSort === 'near') {
      out.sort(function (a, b) { return (a.dist == null ? 1e12 : a.dist) - (b.dist == null ? 1e12 : b.dist); });
    } else if (state.mode === 'route' && state.route) {
      out.sort(function (a, b) { return (a.along || 0) - (b.along || 0); });
    } else {
      out.sort(byName);
    }
    return out;
  }

  function byName(a, b) { return a.r.name.localeCompare(b.r.name, 'ko'); }

  /* 추천·인기순: 미쉐린 > 블루리본 > 백년가게 > 방송맛집 > 노포 > 국민맛집 > 찐후기·내 맛집
     같은 등급이면 기준/경로에서 가까운 순, 그래도 같으면 이름순 */
  function rankKey(r) {
    if (r._custom || r.tier === 'custom' || r.tierLabel === '내 맛집') return 7;
    var label = r.tierLabel || (TIERS[r.tier] ? TIERS[r.tier].label : '');
    if (r.tier === 'michelin' || label.indexOf('미쉐린') >= 0) return 0;
    if (label.indexOf('블루리본') >= 0) return 1;
    if (label.indexOf('백년') >= 0) return 2;
    if (label.indexOf('방송') >= 0) return 3;
    if (label.indexOf('노포') >= 0) return 4;
    if (label.indexOf('국민') >= 0) return 5;
    return 6;
  }

  function rankSort(rows) {
    rows.sort(function (a, b) {
      var d = rankKey(a.r) - rankKey(b.r);
      if (d) return d;
      var da = a.near != null ? a.near : (a.sdist != null ? a.sdist : (a.dist != null ? a.dist : 1e12));
      var db = b.near != null ? b.near : (b.sdist != null ? b.sdist : (b.dist != null ? b.dist : 1e12));
      if (da !== db) return da - db;
      return byName(a, b);
    });
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
    } else if (state.mode === 'district') {
      el.listTitle.textContent = state.district === 'all' ? '지역구 전체 맛집' : state.district + ' 맛집';
    } else if (state.mode === 'subway') {
      var swLine = subwayLine();
      var swSt = subwayStationEntry();
      el.listTitle.textContent = swSt ? swSt[0] + '역 주변 맛집' : swLine ? swLine.name + ' 주변 맛집' : '지하철 주변 맛집';
    } else {
      el.listTitle.textContent = '동선 위 맛집';
    }
    renderSortSwitch();
    if (!rows.length) {
      var hint = state.mode === 'near'
        ? (state.near ? '반경을 넓혀 보거나 업종 필터를 풀어 보세요.' : '위에서 기준 위치를 먼저 정해 주세요.')
        : state.mode === 'subway' ? '반경을 넓히거나 다른 역을 골라 보세요.'
        : state.mode === 'district' ? '다른 지역구를 골라 보세요.' : '반경을 넓히거나 업종 필터를 풀어 보세요.';
      el.list.innerHTML = '<div class="empty">조건에 맞는 맛집이 없습니다.<br>' + hint + '</div>';
      return;
    }
    el.list.innerHTML = rows.map(function (rec, i) {
      var r = rec.r;
      var distTxt = '';
      if (state.mode === 'near' && rec.near != null) distTxt = fmtDist(rec.near);
      else if (state.mode === 'subway' && rec.sdist != null) {
        distTxt = (state.subway.station ? '' : (rec.sst ? rec.sst[0] + '역 ' : '')) + fmtDist(rec.sdist);
      }
      else if (state.mode === 'route' && rec.dist != null) distTxt = '경로에서 ' + fmtDist(rec.dist);
      var nearCls = (state.mode === 'near' || state.mode === 'subway') ? ' near' : '';
      return '<button type="button" class="card' + (state.selected === r.id ? ' sel' : '') + '" data-id="' + esc(r.id) + '">' +
        '<span class="card-top"><span class="card-order">' + (i + 1) + '</span>' +
        '<span class="card-name">' + esc(r.name) + '</span>' + badgeHtml(r) + '</span>' +
        '<span class="card-meta">' + esc(r.district) + '<span class="sep">·</span>' +
        (CAT_META[r.category] ? '<span class="cat-tag">' + CAT_META[r.category].emoji + ' ' + esc(r.category) + '</span>' : esc(r.category)) +
        (distTxt ? '<span class="card-dist' + nearCls + '">' + distTxt + '</span>' : '') + '</span>' +
        '</button>';
    }).join('');
  }

  function sortOptions() {
    if (state.mode === 'near') {
      return { active: state.nearSort, disabled: false, items: [['dist', '가까운 순'], ['rank', '추천·인기순']] };
    }
    if (state.mode === 'subway') {
      return { active: state.subway.sort, disabled: false, items: [['dist', '가까운 순'], ['rank', '추천·인기순']] };
    }
    if (state.mode === 'district') {
      return { active: state.districtSort, disabled: false, items: [['rank', '추천·인기순'], ['name', '이름순']] };
    }
    return { active: state.routeSort, disabled: !state.route, items: [['along', '동선 순'], ['near', '가까운 순']] };
  }

  function renderSortSwitch() {
    if (!el.sortSwitch) return;
    var cfg = sortOptions();
    var btns = el.sortSwitch.querySelectorAll('.sort-btn');
    if (btns.length !== cfg.items.length) {
      el.sortSwitch.innerHTML = cfg.items.map(function (it) {
        return '<button type="button" class="sort-btn" data-sort="' + it[0] + '">' + it[1] + '</button>';
      }).join('');
      btns = el.sortSwitch.querySelectorAll('.sort-btn');
    }
    cfg.items.forEach(function (it, i) {
      var b = btns[i];
      b.setAttribute('data-sort', it[0]);
      b.textContent = it[1];
      b.title = state.mode === 'route'
        ? (it[0] === 'along' ? '출발지에서 도착지로 가는 순서' : '경로에서 가까운 순서')
        : (it[0] === 'rank' ? '등급 높은 곳부터, 같으면 가까운 순' : it[0] === 'name' ? '이름 가나다순' : '기준 위치에서 가까운 순서');
      var on = it[0] === cfg.active;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.disabled = cfg.disabled;
    });
    el.sortSwitch.classList.toggle('is-disabled', cfg.disabled);
  }

  function renderMarkers() {
    if (!engine) return;
    engine.clear('rest');
    markers = {};
    var rows = visible();
    var labelIds = labelPlan(rows);
    rows.forEach(function (rec) {
      var r = rec.r;
      var selected = state.selected === r.id;
      var showLabel = selected || !!labelIds[r.id];
      var node = overlayNode(pinOverlayHtml(r.tier, selected, showLabel ? r.name : ''), 'ov-rest');
      node.setAttribute('data-id', r.id);
      engine.overlay('rest', {
        lat: r.lat, lng: r.lng, node: node, zIndex: selected ? 1000 : 1,
        onClick: function () { openDetail(r.id); }
      });
      markers[r.id] = node;
    });
  }

  /* 화면에서 겹치지 않는 선에서 가게 이름 라벨을 고른다 */
  function labelPlan(rows) {
    var out = {};
    if (!engine || !rows.length) return out;
    var boxes = [];
    var pins = [];
    var maxLabels = state.mode === 'subway' ? 14 : 34;
    var placed = 0;
    var size = engine.size();
    rows.forEach(function (rec) {
      var p = engine.containerPoint({ lat: rec.r.lat, lng: rec.r.lng });
      pins.push([p.x - 10, p.y - 22, p.x + 10, p.y + 2]);
    });
    for (var i = 0; i < rows.length && placed < maxLabels; i++) {
      var r = rows[i].r;
      if (state.selected === r.id) continue;
      var pt = engine.containerPoint({ lat: r.lat, lng: r.lng });
      if (pt.x < -40 || pt.y < -20 || pt.x > size.x + 20 || pt.y > size.y + 20) continue;
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
    } else if (state.mode === 'subway') {
      var ln = subwayLine(), st = subwayStationEntry();
      parts.push(ln.name + ' ' + (st ? st[0] + '역' : '전체'));
      parts.push('역 반경 ' + fmtDist(state.subway.radius));
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
    if (state.mode === 'subway') {
      var ln = subwayLine();
      var st = subwayStationEntry();
      var sn = visible().length;
      var sortTxt = state.subway.sort === 'rank' ? '추천·인기순' : '가까운 순';
      el.summary.innerHTML =
        '<b>' + esc(ln.name) + '</b>' +
        '<span class="sum-line" style="--lt:' + ln.color + '"><i class="line-dot" style="background:' + ln.color + '"></i>' +
        (st ? esc(st[0]) + '역' : '호선 전체') + '</span>' +
        (st ? ' 역 반경 <b>' : ' 역마다 반경 <b>') + fmtDist(state.subway.radius) + '</b> 맛집 <b class="sum-n">' + sn + '곳</b><br>' +
        (st ? '이 역에서 <b class="sum-sort">' + sortTxt + '으로</b> 보여 줍니다.'
            : '노선 위 역에서 <b class="sum-sort">' + sortTxt + '으로</b> 모아 보여 줍니다.') +
        (sn === 0 ? '<br><span class="err">반경을 넓히거나 다른 역을 골라 보세요.</span>' : '') +
        '<br><span class="note">' +
        (st ? '다른 역을 누르면 그 역 기준으로 바뀝니다. 지도 위 역 점을 눌러도 됩니다.'
            : '역을 누르면 그 역 기준으로 좁혀집니다. 지도 위 역 점을 눌러도 됩니다.') +
        '</span>';
      return;
    }
    if (state.mode === 'near') {
      if (!state.near) {
        el.summary.innerHTML = '<b>내 주변 맛집</b><br>기준 위치를 정하면 반경 안의 맛집을 <b>가까운 순서</b>로 보여줍니다.<br>' +
          '<span class="note">현재 내 위치(GPS) · 장소 검색 · 지도에서 직접 찍기 중에 고르세요. 역 주변은 <b>지하철 주변</b> 탭에서 고를 수 있습니다.</span>';
        return;
      }
      var n = visible().length;
      var tags = lineTagsHtml(state.near.name);
      el.summary.innerHTML =
        '<b>' + esc(state.near.name) + '</b>' + (tags ? '<span class="sum-line">' + tags + '</span>' : '') +
        ' 반경 <b>' + fmtDist(state.nearRadius) + '</b> 맛집 <b class="sum-n">' + n + '곳</b><br>' +
        '기준 위치에서 <b class="sum-sort">' + (state.nearSort === 'rank' ? '추천·인기순으로' : '가까운 순으로') + '</b> 보여 줍니다.' +
        (n === 0 ? '<br><span class="err">반경을 넓혀 보세요(5km).</span>' : '') +
        '<br><span class="note">기준 위치는 지도 위 기준 핀입니다. 다른 지점으로 바꾸려면 검색·지도 클릭을 쓰세요. 역 주변은 <b>지하철 주변</b> 탭에서 고를 수 있습니다.</span>';
      return;
    }
    if (state.mode === 'district') {
      var n = visible().length;
      el.summary.innerHTML =
        '<b>' + esc(state.district === 'all' ? '인천 전체' : state.district) + '</b> 맛집 <b class="sum-n">' + n + '곳</b><br>' +
        '동선과 상관없이 이 지역의 맛집을 <b class="sum-sort">' +
        (state.districtSort === 'name' ? '이름순으로' : '추천·인기순으로') + '</b> 표시합니다.' +
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
      radiusTxt + ' 맛집 <b class="sum-n">' + cnt + '곳</b> · 지역구 구분 없이 표시' +
      (state.travel === 'transit' ? '<br><span class="note">대중교통 노선·환승 정보는 제공되지 않아 출발→도착을 잇는 직선 축과 주요 역·거점으로 표시합니다. 실제 경로는 카드의 지도 앱을 이용하세요.</span>' : '') +
      (route.kind === 'straight' && state.travel === 'car' ? '<br><span class="err">경로 서버 응답이 없어 직선으로 표시했습니다.</span>' : '');
  }

  /* ── 상세 ─────────────────────────────────────── */
  function focusRestaurant(r) {
    if (!engine) return;
    var narrow = window.matchMedia('(max-width: 900px)').matches;
    var z = Math.max(engine.zoom(), 16);
    var size = engine.size();
    var dx = 0, dy = 0;
    if (narrow) {
      /* 바텀시트에 가리지 않는 위쪽 영역의 중앙에 핀을 둔다 */
      dy = Math.round((sheetHeight() * 0.55) / 2 + 24);
    } else {
      dx = Math.round(Math.min(235, size.x * 0.22));
    }
    /* 화면 중심을 핀에서 (dx, dy)만큼 어긋나게 두어 핀이 패널에 가리지 않게 한다 */
    var cx = mercX(r.lng, z) + dx;
    var cy = mercY(r.lat, z) + dy;
    engine.flyTo({ lat: mercLat(cy, z), lng: mercLng(cx, z) }, z);
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
    document.body.classList.add('detail-open');

    renderMarkers();
    renderList();
    focusRestaurant(r);
  }

  function closeDetail() {
    el.detail.hidden = true;
    document.body.classList.remove('detail-open');
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
    document.body.style.overflow = '';
  }

  function renderKeyState() {
    var key = kakaoKey();
    var js = kakaoJsKey();
    if (el.kakaoKeyState) {
      el.kakaoKeyState.textContent = key ? '저장됨 · 끝 ' + key.slice(-4) : '미등록';
      el.kakaoKeyState.classList.toggle('on', !!key);
    }
    if (el.kakaoKeyClear) el.kakaoKeyClear.hidden = !key;
    if (el.kakaoKeyInput) el.kakaoKeyInput.value = '';
    if (el.kakaoJsKeyState) {
      el.kakaoJsKeyState.textContent = js ? '저장됨 · 끝 ' + js.slice(-4) : '미등록';
      el.kakaoJsKeyState.classList.toggle('on', !!js);
    }
    if (el.kakaoJsKeyClear) el.kakaoJsKeyClear.hidden = !js;
    if (el.kakaoJsKeyInput) el.kakaoJsKeyInput.value = '';
    if (el.addSearchHint) {
      el.addSearchHint.innerHTML = key
        ? '카카오 상호명 검색 사용 중 — 가게 이름(예: 윤가네바지락칼국수)만 넣고 검색하세요.'
        : '위 <b>카카오 키</b>를 한 번 넣으면 상호명으로 바로 찾습니다. 지금은 도로명주소 검색만 됩니다.';
    }
    if (el.keyOpen) el.keyOpen.classList.toggle('on', !!(key || js));
    updateEngineUi();
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

  /* JavaScript 키 저장 → 진짜 카카오맵으로 전환 (실패하면 기본 지도로 자동 폴백) */
  function saveJsKeyFromInput() {
    var v = (el.kakaoJsKeyInput.value || '').trim();
    if (!v) { toast('카카오 JavaScript 키를 붙여넣어 주세요.'); el.kakaoJsKeyInput.focus(); return; }
    if (v.length < 20) { toast('키가 너무 짧습니다. JavaScript 키(32자)를 확인해 주세요.'); el.kakaoJsKeyInput.focus(); return; }
    setKakaoJsKey(v);
    closeAddModal();
    toast('JavaScript 키를 저장했습니다. 카카오맵으로 전환합니다…', 2600);
    switchEngine('kakao');
  }

  function clearJsKey() {
    setKakaoJsKey('');
    toast('JavaScript 키를 삭제하고 기본 지도로 돌아갑니다.', 3200);
    switchEngine('leaflet');
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
    document.body.setAttribute('data-mode', mode);
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
      if (engine) { engine.clear('route'); engine.clear('hubs'); }
      drawNear();
      el.district.value = state.district;
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitDistrict();
    } else if (mode === 'near') {
      if (engine) { engine.clear('route'); engine.clear('hubs'); engine.clear('subway'); }
      nearNowText();
      drawNear();
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitNear();
    } else if (mode === 'subway') {
      if (engine) { engine.clear('route'); engine.clear('hubs'); }
      drawNear();
      renderSubway();
      drawSubway();
      renderSummary();
      renderList();
      renderMarkers();
      if (!silent) fitSubway();
    } else {
      if (engine) engine.clear('subway');
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
      if (lbl) lbl.textContent = mode === 'near' ? '반경 보기' : mode === 'subway' ? '노선 보기' : mode === 'district' ? '동네 보기' : '경로 보기';
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
    if (el.kakaoJsKeySave) {
      el.kakaoJsKeySave.addEventListener('click', saveJsKeyFromInput);
      el.kakaoJsKeyClear.addEventListener('click', clearJsKey);
      el.kakaoJsKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveJsKeyFromInput(); }
      });
    }
    if (el.kakaoZoom) {
      el.kakaoZoom.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-zoom]');
        if (!b || !engine) return;
        if (b.getAttribute('data-zoom') === 'in') engine.zoomIn();
        else engine.zoomOut();
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
    if (el.sortSwitch) {
      el.sortSwitch.addEventListener('click', function (e) {
        var b = e.target.closest('button.sort-btn');
        if (!b || b.disabled) return;
        var v = b.getAttribute('data-sort');
        if (state.mode === 'near') state.nearSort = v;
        else if (state.mode === 'district') state.districtSort = v;
        else { if (!state.route) return; state.routeSort = v; }
        renderList();
        renderMarkers();
        renderSummary();
        nearNowText();
      });
    }

    document.querySelectorAll('.seg-btn[data-swradius]').forEach(function (b) {
      b.addEventListener('click', function () {
        setSubwayRadius(parseInt(b.getAttribute('data-swradius'), 10));
      });
    });
    if (el.sortSwitch) {
      el.sortSwitch.addEventListener('click', function (e) {
        var b = e.target.closest('button.sort-btn');
        if (!b || b.disabled) return;
        var v = b.getAttribute('data-sort');
        if (state.mode === 'near') state.nearSort = v;
        else if (state.mode === 'subway') { state.subway.sort = v; saveSubway(); }
        else if (state.mode === 'district') state.districtSort = v;
        else { if (!state.route) return; state.routeSort = v; }
        renderList();
        renderMarkers();
        renderSummary();
        nearNowText();
      });
    }

    if (el.swLines) {
      el.swLines.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-line]');
        if (!b) return;
        setSubwayLine(b.getAttribute('data-line'));
      });
    }
    if (el.swStations) {
      el.swStations.addEventListener('click', function (e) {
        var all = e.target.closest('button[data-sw-all]');
        if (all) {
          state.subway.station = null;
          state.subway.sort = 'dist';
          saveSubway();
          renderSubway();
          drawSubway();
          renderSummary();
          renderList();
          renderMarkers();
          fitSubway();
          return;
        }
        var b = e.target.closest('button[data-sw-station]');
        if (!b) return;
        selectSubwayStation(b.getAttribute('data-sw-station'));
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
      else if (state.mode === 'subway') fitSubway();
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
    invalidateMap(320);
  }

  function invalidateMap(delay) {
    setTimeout(function () { if (engine) engine.invalidate(); }, delay || 80);
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
    invalidateMap(80);
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
      list: $('rest-list'), listTitle: $('list-title'), resultCount: $('result-count'), sortSwitch: $('sort-switch'),
      swLines: $('sw-lines'), swStations: $('sw-stations'), swCount: $('sw-count'),
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
      kakaoJsKeyInput: $('kakao-js-key-input'), kakaoJsKeyState: $('kakao-js-key-state'),
      kakaoJsKeySave: $('kakao-js-key-save'), kakaoJsKeyClear: $('kakao-js-key-clear'),
      mapEngineLabel: $('map-engine-label'), mapEngineNote: $('map-engine-note'),
      kakaoZoom: $('map-zoom'),
      addPick: $('add-pick'), addCoord: $('add-coord'), addName: $('add-name'), addDistrict: $('add-district'),
      addCat: $('add-cat'), addMenu: $('add-menu'), addMemo: $('add-memo'), addAddress: $('add-address'),
      addSave: $('add-save'), exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file'),
      customCount: $('custom-count')
    };

    renderHubs();
    renderSubway();
    bindEvents();
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
    /* 저장해 둔 지하철 노선·역·반경 복원 */
    var savedSw = storeGet(LS_SUBWAY, null);
    if (savedSw && LINE_BY_ID[savedSw.line]) {
      state.subway.line = savedSw.line;
      if (savedSw.station) {
        var ln0 = LINE_BY_ID[savedSw.line];
        var hasSt = ln0.stations.some(function (s) { return s[0] === savedSw.station; });
        state.subway.station = hasSt ? savedSw.station : null;
      }
      if ([500, 1000, 2000, 3000].indexOf(+savedSw.radius) >= 0) state.subway.radius = +savedSw.radius;
      if (savedSw.sort === 'rank' || savedSw.sort === 'dist') state.subway.sort = savedSw.sort;
    }
    renderSubway();
    applyViewport();

    /* 지도 엔진(카카오맵 또는 기본 지도)이 준비된 다음에 데이터를 그린다 */
    startMap().then(function () {
      applyViewport();
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
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (isMobile()) snapSheet(sheetState.idx);
        invalidateMap(0);
      }, 140);
    });
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', applyViewport);
    else if (mqMobile.addListener) mqMobile.addListener(applyViewport);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
