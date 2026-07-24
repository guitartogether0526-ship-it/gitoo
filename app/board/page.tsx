import { getBoards, getPosts } from "@/lib/db";
import { getSession } from "@/lib/session";
import BoardView from "@/components/BoardView";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [session, boards, posts] = await Promise.all([getSession(), getBoards(), getPosts()]);

  // 건의사항(익명 게시판) 글은 작성자 정보를 서버에서 가린다 — 클라이언트로 author_id가
  // 그대로 나가면 회원 id·이름 매핑과 조합해 익명 작성자를 특정할 수 있다.
  // 본인 글만 author_id 유지(본인 수정 권한 판별용 — 자기 id는 이미 아는 값).
  const anonBoardIds = new Set(boards.filter((b) => b.name === "건의사항").map((b) => b.id));
  const safePosts = posts.map((p) =>
    anonBoardIds.has(p.board_id)
      ? { ...p, author: "익명", author_id: p.author_id === session?.id ? p.author_id : null }
      : p,
  );
  return (
    <>
      <div className="page-head">
        <h1>게시판</h1>
        <p>공지사항 · 자유게시판 · 운영진이 게시판 추가 가능</p>
      </div>
      <BoardView boards={boards} posts={safePosts} />
    </>
  );
}
