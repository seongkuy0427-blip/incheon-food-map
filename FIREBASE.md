# 🔥 공용 DB (Firebase Firestore) 설정·운영

친구들이 서로의 맛집 추천을 실시간으로 보려면 `assets/config.js`의 `firebase` 설정이 필요합니다.
현재 저장된 프로젝트는 **`foodmap-5dd70`**, 컬렉션은 **`shared_places`** 입니다.

## 지금 상태 (2026-11-27)

| 항목 | 값 |
| --- | --- |
| 프로젝트 | `foodmap-5dd70` |
| Firestore 위치 | `asia-northeast3 (서울)` — 콘솔에서 만든 위치 기준 |
| 컬렉션 | `shared_places` |
| 읽기 | 누구나 (앱이 실시간 구독) |
| 쓰기 | 누구나 (추천 등록·삭제) |
| 로그인 | 없음 — 이름은 사용자가 직접 적는 닉네임 |

`assets/config.js`의 `firebase` 값은 **공개되어도 되는 웹 앱 설정**입니다(비밀번호가 아님). 실제 접근은 Firestore **보안 규칙**이 결정합니다.

## ⚠️ 먼저 확인: 테스트 모드 만료

Firebase 콘솔에서 **“테스트 모드로 시작”** 을 골랐다면 규칙이 `allow read, write: if request.time < …` 형태로 **30일 뒤 자동으로 잠깁니다**(대략 2026-12-27 전후).
그때가 되면 친구 등록이 `permission-denied`로 실패하고 앱은 “공용 DB에 저장하지 못했습니다” 안내를 띄웁니다. **아래 규칙으로 바꿔 두면 계속 쓸 수 있습니다.**

## 권장 규칙 (지금 방식 유지: 누구나 읽기·등록·삭제)

Firebase 콘솔 → **Firestore Database → 규칙**에 붙여넣고 **게시**합니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shared_places/{docId} {
      allow read: if true;
      allow create: if isRec();
      allow update: if false;
      allow delete: if true;

      function isRec() {
        let d = request.resource.data;
        return d.keys().hasOnly(['name','lat','lng','address','district','category','phone','note','recommender','placeRef','createdAt'])
          && d.name is string && d.name.size() > 0 && d.name.size() <= 60
          && d.recommender is string && d.recommender.size() > 0 && d.recommender.size() <= 12
          && d.note is string && d.note.size() <= 80
          && d.lat is number && d.lat > 37.0 && d.lat < 37.9
          && d.lng is number && d.lng > 126.2 && d.lng < 126.9;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- `update: false` — 한 번 올린 추천을 몰래 바꾸지 못하게 합니다.
- `delete: true` — 앱의 **내 추천 삭제**가 동작하려면 필요합니다. 대신 문서 ID를 아는 사람은 지울 수 있습니다(아래 한계 참고).
- `isRec()` — 정해진 필드·길이·인천 좌표 범위만 허용해 쓰레기 문서를 줄입니다.

### 더 엄격하게 하려면 (선택)

- **삭제도 막기**: `allow delete: if false;` 로 바꾸면 앱의 삭제 버튼이 실패합니다. 대신 콘솔에서만 정리할 수 있습니다.
- **입장코드**: 앱에 코드 입력을 추가하고 `allow create: if request.resource.data.pass == '…'` 처럼 검사할 수 있지만, 코드가 공개 페이지에 들어가므로 실질적인 보호는 아닙니다.
- **진짜 본인 확인**: Firebase **익명/구글 로그인**을 붙이고 `request.auth != null && request.auth.uid == resource.data.uid` 로 제한하는 방식이 가장 안전합니다. 지금은 “입장코드 없이 가볍게” 쓰기로 했으므로 넣지 않았습니다.

## 한계 (알고 쓰면 되는 것)

- **닉네임은 자기 신고**입니다. 같은 이름을 쓰면 다른 사람 추천도 삭제 버튼이 보일 수 있습니다. 친구끼리 쓰는 용도로만 권장합니다.
- **주소가 공개**됩니다. 링크를 아는 사람은 누구나 목록을 읽고 등록할 수 있습니다.
- **개인정보를 적지 마세요.** 한 줄 평에 전화번호·집주소 같은 내용을 넣지 않도록 안내했습니다.
- **연결이 막혔을 때**: 앱은 추천을 `localStorage`에 보관하고(`incheonFoodMap.pending.v1`), 연결이 돌아오면 자동으로 Firestore에 올립니다. 규칙 만료로 잠깐 막혀도 친구들이 쓴 추천이 사라지지 않습니다.
- Firestore 무료(Spark) 한도: 하루 읽기 5만·쓰기 2만·삭제 2만 건. 친구 몇 명이 쓰는 규모에서는 충분합니다.

## 앱이 쓰는 문서 모양

```json
{
  "name": "부평소머리국밥",
  "lat": 37.50486785,
  "lng": 126.72276004,
  "address": "인천 부평구 …",
  "district": "부평구",
  "category": "국밥",
  "phone": "032-…",
  "note": "국물이 진해요",
  "recommender": "성규",
  "placeRef": "k1975979696",
  "createdAt": "2026-11-27T01:23:45.000Z"
}
```

- `placeRef`는 기본 256곳의 `id`(또는 친구가 만든 가게의 합성 id)입니다. 같은 집에 여러 명이 추천하면 앱이 **한 곳으로 합쳐** 보여 줍니다.
- 문서 ID는 Firestore가 자동 생성합니다. 앱은 ID를 화면에 노출하지 않습니다.

## 콘솔에서 확인·정리

1. <https://console.firebase.google.com/> → `foodmap-5dd70` → **Firestore Database → 데이터**
2. `shared_places` 컬렉션에서 문서를 보고 지울 수 있습니다.
3. 사용량은 **사용 및 결제 → 사용량**에서 확인합니다.

## 다른 프로젝트로 바꾸려면

1. Firebase 콘솔에서 새 프로젝트·Firestore를 만들고 **웹 앱 등록**
2. 나오는 `firebaseConfig`를 `assets/config.js`의 `firebase`에 붙여넣기
3. 위 보안 규칙 게시
4. `assets/config.js` 커밋 → `git push origin master:main`
5. 앱을 열어 `＋ 맛집 추천` 모달의 안내가 **“🌐 공용 DB 연결됨”** 인지 확인

## 카카오 JavaScript 키

- `assets/config.js`의 `kakaoJsKey`는 **도메인 제한**이 걸린 공개 키입니다.
- 카카오 디벨로퍼스 → **플랫폼 → Web 사이트 도메인**에 `https://seongkuy0427-blip.github.io` 가 있어야 지도·상호명 검색이 뜹니다.
- `localhost`는 등록되어 있지 않으면 로컬 테스트에서 기본 지도(OSM)로 폴백합니다(정상 동작).
- 브라우저의 `🔑 카카오 키`에 넣은 값이 있으면 그 값이 `config.js`보다 우선합니다.
