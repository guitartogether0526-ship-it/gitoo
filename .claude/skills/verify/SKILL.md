---
name: verify
description: gitoo(기타투게더 PWA) 변경 사항을 실제 앱을 띄워 끝단에서 확인하는 방법 — dev 서버 기동, 세션 쿠키 위조 로그인, 페이지 curl 검증
---

# gitoo 검증 레시피

## 기동
- `npm run dev` 백그라운드 실행 → `http://localhost:3000` (Ready까지 ~15초).
- ⚠️ dev 서버가 켜진 상태에서 `next build` 금지(흰 화면). 타입 확인은 `npx tsc --noEmit`.
- Supabase env 없어도 목업 폴백으로 페이지는 뜬다 (회원/게시판 등 실데이터 검증은 env 필요).

## 로그인 (SSR 검증용)
세션은 서명 없는 JSON 쿠키 `gt-user` (lib/session-cookie.ts, lib/session.ts).
curl로 아무 역할이나 위조 가능:

```bash
COOKIE="gt-user=$(python -c "import urllib.parse;print(urllib.parse.quote('{\"id\":\"verify\",\"name\":\"검증용\",\"role\":\"member\",\"part\":\"기타\",\"initial\":\"검\",\"team_id\":null,\"team_id_2\":null}'))")"
curl -s -H "Cookie: $COOKIE" http://localhost:3000/<페이지> -o out.html
```
- role을 `admin`/`treasurer` 등으로 바꿔 권한 분기 확인. 쿠키 없이 요청하면 로그인 화면(AuthGate).
- 클라이언트 내비게이션이 치는 요청은 `-H "RSC: 1"` 로 흉내 낼 수 있다.

## 주의
- Windows 콘솔에 한글 출력이 깨진다(cp949) — grep 결과는 UTF-8 파일로 저장 후 Read 도구로 읽기.
- 백그라운드로 띄운 dev 서버를 TaskStop으로 죽여도 node 자식이 살아남아 3000 포트를 계속 점유한다.
  빌드 전 반드시 `netstat -ano | grep :3000` 으로 확인하고 `taskkill //PID <pid> //F` 후 `rm -rf .next && npm run build`.
- **dev 모드 HTML의 flight 페이로드에는 서버 fetch 원본 응답(디버그 계측, `parsedNumHeaders` 등)이 포함된다.**
  데이터 유출로 오인하지 말 것 — 권한별 데이터 노출 검증은 반드시 `npm run build && npm start`(프로덕션)로 판정.
- 회비 페이지(/finance)는 구글시트(lib/sheet.ts)를 서버에서 읽는다. 알려진 검산값:
  26년 6월(?m=488071106) = 이월 740,354 / 수입 1,980,000 / 지출 1,763,293 / 총합계 957,061.
  잘못된 `?m`·양식 gid는 이번 달로 폴백해야 정상.
- 브라우저 클릭 검증은 claude-in-chrome 확장이 연결된 경우에만 가능.
