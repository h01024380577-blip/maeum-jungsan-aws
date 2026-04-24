# 마이페이지 탭 설계서

- **작성일:** 2026-04-24
- **대상 저장소:** maeum-jungsan (마음정산, 앱인토스 미니앱)
- **브레인스토밍 대화:** 2026-04-24 홈탭 프로필 클릭 → 마이페이지 신설 요구
- **레퍼런스:** [wwit.design / mypage 패턴](https://wwit.design/pattern/mypage)

---

## 1. 목적

홈탭 헤더의 프로필 요소를 탭하면 `/mypage` 라우트로 이동하는 **마이페이지**를 추가한다. 기존 홈탭 설정 바텀시트(알림·테마·FAQ·피드백·버전·로그아웃)를 별도 페이지로 승격하면서 **프로필 카드**와 **크레딧 현황**을 상단 hero로 배치한다.

### 왜 페이지로 승격하나

- 바텀시트는 임시 모달 느낌이라 설정·크레딧·계정 같은 **영속적 사용자 영역**을 담기에 정보 위계가 약함
- 향후 계정 관리·결제·IAP 같은 섹션 확장이 필요하면 페이지 구조가 필수
- 프로필 영역이 현재 비-클릭 정적 pill — 사용자에게 "내 정보" 진입점이 없음

---

## 2. 확정 결정 사항 (브레인스토밍 결과)

| 질문 | 결정 |
|---|---|
| 마이페이지 구성 방향 | **B + 헤더 확장** — 기존 설정 바텀시트를 페이지로 승격 + 프로필/크레딧 헤더 추가. 활동 요약은 생략(통계 탭에 이미 있음) |
| 진입 경로와 기존 설정 버튼 | **A** — 설정 버튼 제거, 프로필 클릭만 진입점 |
| 비로그인(게스트) 처리 | **B** — 헤더에 "토스 로그인" 버튼만 노출, 마이페이지는 로그인 사용자 전용 |
| 페이지 구성 접근 | **A** — 그룹화된 리스트 (wwit.design 표준 패턴) |

---

## 3. 라우팅 & 진입 흐름

### 신규 라우트

```
app/
  mypage/
    page.tsx         // 'use client' 엔트리, <MyPageTab /> 렌더
```

### HomeTab 헤더 변경

| 상태 | 헤더 구성 |
|---|---|
| **로그인** | `[👤 프로필 pill (클릭 가능, ChevronRight)] [AI pill]` |
| **비로그인** | `[🔐 토스 로그인 버튼] [AI pill]` |

- 기존 `⚙️ 설정 버튼` **완전 제거**
- 로그인 프로필 pill은 `onClick={() => router.push('/mypage')}` — 마이페이지로 이동
- 호버/프레스 상태: `active:scale-[0.97]`, 배경 `bg-gray-50 → hover:bg-gray-100` 전환
- "탭 가능" 시그널: pill 오른쪽에 `ChevronRight` 14px 아이콘 추가
- 비로그인 버튼은 기존 tossAuth 로그인 플로우 재사용 (intro 또는 inline)

### 접근 방어

`/mypage` 직접 URL 접근 시 `tossUserId`가 없으면:
- 클라이언트에서 `useEffect`로 감지 → `router.replace('/')`
- 서버/SSR 렌더는 이미 clientComponent라 제약 없음

---

## 4. 마이페이지 본문 레이아웃

### 4.1 상단 헤더 (페이지 내)

```
[← 뒤로가기]  마이페이지
```
- 뒤로가기: `router.back()` 또는 `router.push('/')` (back stack 없을 시)
- 모바일 top-bar 패턴, 430px max-width shell 안에서 sticky 필요 없음

### 4.2 섹션 구성

```
① 프로필 카드
  ├─ 아바타 (사용자 이름 이니셜 원형 or User 아이콘)
  ├─ 이름 (없으면 "토스 사용자")
  └─ 메타: "토스 계정 연결 · 2026.04.23" (createdAt 포맷)

② 내 크레딧 (그룹 제목 "내 크레딧")
  ┌─ AI 분석 ──┬─ CSV 가져오기 ─┐
  │ ✨ 아이콘   │ 📤 아이콘        │
  │ 남은 5회    │ 남은 1회         │
  │ cap 10      │ cap 3            │
  │ (잔고 0이면)│ (잔고 0이면)     │
  │ [광고+1]    │ [광고+1]         │
  └────────────┴──────────────────┘

③ 앱 설정 (그룹 제목 "앱 설정")
  🔔 푸시 알림          [허용됨]   ← 클릭 시 제자리 토글
  🎨 화면 테마         [시스템] ▸  ← 바텀시트 열기

④ 지원 (그룹 제목 "지원")
  ❓ 자주 묻는 질문              ▸  ← 바텀시트
  💬 개발자에게 의견 보내기      ▸  ← 바텀시트
  ℹ️  버전 정보        v1.0.0        비활성

⑤ 계정 액션 (구분선 후)
  🚪 로그아웃 (빨간 텍스트)      ← 기존 확인 모달
```

### 4.3 스타일 가이드

- **그룹 제목:** `text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1`
- **그룹 컨테이너:** `rounded-2xl bg-white border border-gray-100 divide-y divide-gray-100`
- **리스트 행:** `flex items-center justify-between px-4 py-3.5`
- **아이콘 박스:** `w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center`
- **그룹 간격:** 그룹 사이 `mb-6`
- **페이지 배경:** 기존 화이트 배경 유지, 다크모드 시 기존 theme 토큰 사용

---

## 5. 클릭 상호작용 명세

### 5.1 푸시 알림 (제자리 토글)

- 현재 상태에 따라 우측 pill 표시: "허용됨" (green-100) / "허용하기" (blue-500)
- 클릭 → 기존 `toggleNotification()` 로직 재사용 (HomeTab에서 분리)
- 로딩 중 disabled, 실패 시 기존 토스트 재사용
- `notificationsEnabled === null` 또는 `!tossUserId` 시 disabled

### 5.2 화면 테마 (`ThemePickerSheet`)

- 우측: 현재 모드 텍스트 ("시스템 · 현재 다크" 등)
- 클릭 → 바텀시트 오픈
- 바텀시트 내용: 라이트/다크/시스템 3개 segmented 버튼 (기존 HomeTab에 있던 UI 그대로 이관)
- 선택 시 `setThemeMode()` 호출, 바텀시트 자동 닫힘

### 5.3 자주 묻는 질문 (`FaqSheet`)

- 클릭 → 바텀시트 오픈
- 기존 4개 질문 아코디언 구조 그대로 이관 (`openFaqIndex` state 내부 관리)

### 5.4 개발자에게 의견 (`FeedbackSheet`)

- 클릭 → 바텀시트 오픈
- textarea + 전송 버튼 (기존 `/api/feedback` 호출 그대로)
- mailto fallback 로직 유지
- 전송 성공 시 토스트 + 바텀시트 닫힘

### 5.5 버전 정보 — 정적 (클릭 비활성)

### 5.6 로그아웃 (`LogoutConfirmDialog`)

- 클릭 → 기존 확인 모달 재사용 ("로그아웃하시겠습니까?" → 취소/확인)
- 확인 시: `clearData()` + localStorage onboarding-seen 제거 + `router.replace('/')`

---

## 6. 비로그인 접근 차단

```ts
// MyPageTab.tsx 진입부
useEffect(() => {
  if (isLoaded && !tossUserId) {
    router.replace('/');
  }
}, [isLoaded, tossUserId, router]);

if (!tossUserId) return null; // 리다이렉트 전까지 빈 화면
```

- `isLoaded` 대기 후 판정 (store 초기 로딩 중 깜박임 방지)
- HomeTab 헤더의 로그인 버튼이 공식 진입점이므로 직접 URL 접근 방어는 최소 수준

---

## 7. 장례(SOLEMN) 성역 원칙

- 마이페이지는 이벤트 컨텍스트 없는 전역 페이지 → SOLEMN 분기 불필요
- 크레딧 섹션의 광고 CTA는 **잔고 0 시에만 노출**: 기존 `CreditPill` 로직 재사용
  - 혹은 2열 그리드 안에서 `AI 0회 → 광고 버튼 모핑 / CSV 1회 → 배지 표시` 식의 독립 pill
- 배너는 마이페이지 **노출 X** (통계 탭 한 곳 유지 방침 고수)

---

## 8. 파일 계획

### 신규 파일 (9개)

| 파일 | 역할 |
|---|---|
| `app/mypage/page.tsx` | 'use client' 엔트리, `<MyPageTab />` 렌더 |
| `src/tabs/MyPageTab.tsx` | 페이지 본문 조합, 비로그인 방어, 뒤로가기 헤더 |
| `src/components/mypage/ProfileCard.tsx` | 프로필 아바타 + 이름 + 메타 |
| `src/components/mypage/CreditOverview.tsx` | AI/CSV 2열 카드 (배지/광고 CTA 모핑) |
| `src/components/mypage/SettingsRow.tsx` | 공용 리스트 행 (icon, label, trailing, onClick) |
| `src/components/mypage/ThemePickerSheet.tsx` | 테마 선택 바텀시트 |
| `src/components/mypage/FaqSheet.tsx` | FAQ 아코디언 바텀시트 |
| `src/components/mypage/FeedbackSheet.tsx` | 피드백 폼 바텀시트 |
| `src/components/mypage/LogoutConfirmDialog.tsx` | 로그아웃 확인 다이얼로그 |

### 수정 파일

| 파일 | 변경 |
|---|---|
| `src/tabs/HomeTab.tsx` | 헤더 리팩터링 (설정 버튼 제거, 프로필 클릭 가능화, 비로그인 시 로그인 버튼). 바텀시트 관련 state/JSX 200+줄 **제거** |

### 의존성

- 새 npm 패키지 없음
- 기존 `lucide-react`, `framer-motion`, `sonner`, `next/navigation`만 사용

---

## 9. 테스트 전략

### 단위 테스트 (Vitest)

- 없음 (UI 컴포넌트 위주, 기존 프로젝트는 util/library 중심 테스트만 운영)

### 회귀 검증

- `npx vitest run` 전 70건 통과 확인
- `npx tsc --noEmit` 프로젝트 에러 0 유지

### 실기 검증 체크리스트

- [ ] HomeTab 로그인 상태: 프로필 pill 클릭 → `/mypage` 이동
- [ ] 마이페이지 각 섹션 렌더: 프로필 / AI·CSV 크레딧 / 3그룹 / 로그아웃
- [ ] 잔고 0 상태에서 해당 카드가 광고 버튼으로 모핑
- [ ] 테마 바텀시트 선택 → 즉시 반영
- [ ] FAQ 바텀시트 아코디언 동작
- [ ] 피드백 바텀시트 전송 → 성공 토스트
- [ ] 알림 제자리 토글 → API 호출
- [ ] 로그아웃 → 확인 모달 → 홈으로 리다이렉트
- [ ] 비로그인 `/mypage` 직접 접근 → 홈 리다이렉트
- [ ] 비로그인 HomeTab 헤더에 "토스 로그인" 버튼 노출

---

## 10. 범위 외 (Out of Scope)

이번 설계가 **다루지 않는 것**:

- 유료 충전/결제 페이지 (Phase 4 후속)
- 활동 통계 요약 (통계 탭에 이미 존재)
- 계정 삭제/탈퇴 플로우 (별도 프로세스 필요)
- 배너 광고를 마이페이지로 확장
- 다국어 대응
- 접근성(screen reader label) 별도 보강

---

## 11. 배포 영향

- 서버 코드 변경 없음 (API 추가/변경 없음)
- AIT 번들 재빌드 필요 (클라이언트 파일 수정·추가)
- 기존 `/api/feedback`, `/api/notification-consent` 재사용
- EC2 Next.js는 라우트 추가로 재빌드 필요하지만 `deploy.sh`가 자동 처리

---

## 12. 롤아웃

1. 구현 완료 후 로컬 dev 서버에서 UX 검증
2. 커밋 → `bash scripts/deploy.sh`
3. AIT 번들 재빌드 (deploy.sh가 클라이언트 변경 감지해 자동)
4. `npx ait deploy -m "마이페이지 탭 도입"` (본인 수행)
5. 앱인토스 콘솔에서 새 버전 배포
6. 실기 검증 체크리스트 수행

롤백 시: 이전 AIT 번들로 되돌리면 HomeTab 바텀시트 복구, 서버 API 영향 없음.
