# 🎸 GUITAR TOGETHER

기타 밴드 동호회 전용 **모바일 PWA**. 어두운 무대/연습실 분위기의 다크 테마 + 따뜻한 앰버/골드 포인트 컬러로 구성했습니다.

## 기능

| 화면 | 설명 |
|------|------|
| 🏠 대시보드 | 최신 공지사항 카드 + 다음 예약 · 장부 잔액 요약 |
| 📅 연습실 예약 | 어두운 무대 도면 위 슬롯을 터치해 앰버 마커로 예약 |
| 📦 장비/비품 | 대분류 필터 · 가나다순 · 대여/반납/고장 신고 |
| 🎼 셋리스트 | 곡명·아티스트·파트별 악보 다운로드 + 앰버 좋아요/투표 |
| 👥 회원/관리자 | 프로필·기수·상태 + 운영진/총무 권한 앰버 토글 |
| 💳 회비/장부 | 납부 현황 + 지출 내역(영수증 첨부), 총 잔액 앰버 강조 |

## 기술 스택

- **Next.js (App Router) + TypeScript**
- **PWA**: `app/manifest.ts` + `public/sw.js` (오프라인 앱 셸 캐싱)
- **데이터**: 목업 (Supabase 테이블 구조 모방) — `lib/db.ts` 의 함수만 교체하면 실제 연동

## 개발

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드 (Vercel 호환)
```

모바일 화면으로 보려면 브라우저 개발자도구의 디바이스 툴바를 사용하세요.

## Supabase 연동

이미 코드에 연결되어 있습니다. `lib/db.ts` 는 환경변수가 설정되면 Supabase 에서 읽고,
없으면 목업 데이터로 폴백합니다(앱이 항상 동작). 쓰기(예약/투표/대여/권한)는 `lib/supabase.ts` 의
브라우저 클라이언트로 실제 저장됩니다.

**설정 3단계:**

1. **테이블 생성**: Supabase 대시보드 → SQL Editor → [`supabase/schema.sql`](./supabase/schema.sql) 전체를 붙여넣고 Run
   (테이블 + RLS 정책 + 시드 데이터까지 한 번에 생성)
2. **환경변수**: `.env.example` 을 참고해 `.env.local` 에 키 입력 (로컬용, git 제외)
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # 서버 전용
   ```
3. **재시작**: `npm run dev` → 이제 DB 의 데이터를 읽고 씁니다.

> ⚠️ 현재는 로그인(Auth)이 없어 RLS 정책이 anon 에게 읽기/쓰기를 모두 허용합니다.
> 공개 운영 전에는 Supabase Auth 를 붙이고 정책을 사용자 기준으로 조이세요.
> `service_role` 키는 모든 보안을 우회하므로 **브라우저/깃에 절대 노출 금지**입니다.

## Vercel 배포

1. 이 저장소를 GitHub 에 푸시
2. [Vercel](https://vercel.com/new) 에서 해당 repo import (Next.js 자동 감지 — 별도 빌드 설정 불필요)
3. **Environment Variables** 에 위 3개 키 추가 후 Deploy
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. 이후 `git push` 할 때마다 자동 재배포됩니다.
