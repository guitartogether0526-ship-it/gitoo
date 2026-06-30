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

## Supabase 연동 (추후)

`lib/db.ts` 의 각 함수는 현재 목업 배열을 반환합니다. 실제 연동 시:

```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function getEquipment() {
  const { data } = await supabase.from("equipment").select("*").order("name");
  return data ?? [];
}
```

테이블 스키마는 `lib/types.ts` 의 인터페이스를 참고하세요.

## Vercel 배포

이 저장소를 GitHub에 푸시한 뒤 [Vercel](https://vercel.com/new)에서 import 하면 별도 설정 없이 자동 배포됩니다. (Next.js 자동 감지)

```bash
git init && git add . && git commit -m "init: GUITAR TOGETHER PWA"
# GitHub 푸시 후 Vercel import → Deploy
```
