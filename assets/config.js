/* 인천 동선 맛집 지도 — 배포용 설정 (v9)
 *
 * 여기 값은 GitHub에 올라가고 모든 방문자가 내려받습니다.
 * 그래서 "도메인 제한을 건" 공개용 키만 넣습니다.
 *   - kakaoJsKey : 카카오 JavaScript 키 (플랫폼 → Web 사이트 도메인에
 *                  https://seongkuy0427-blip.github.io 등록 필수)
 *   - firebase   : Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig
 *
 * 둘 다 비워 두면 예전과 똑같이 동작합니다.
 *   - 지도: 기본 지도(OSM), 상호명 검색: 공개 주소 검색(Nominatim)
 *   - 추천 목록: 이 브라우저(localStorage)에만 저장
 */
window.APP_CONFIG = {
  kakaoJsKey: "8a9c777ac43b2b62987a10419c673338",

  firebase: {
    apiKey: "AIzaSyAEP_53kl4z10DFkpguJpTrQ7TTdF5dFKQ",
    authDomain: "foodmap-5dd70.firebaseapp.com",
    projectId: "foodmap-5dd70",
    storageBucket: "foodmap-5dd70.firebasestorage.app",
    messagingSenderId: "301062064413",
    appId: "1:301062064413:web:de4e7fa00b4b7e20d5b9f4",
    measurementId: "G-5JCQPZX322"
  }
};
