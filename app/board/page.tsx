import { getBoards, getPosts } from "@/lib/db";
import BoardView from "@/components/BoardView";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [boards, posts] = await Promise.all([getBoards(), getPosts()]);
  return (
    <>
      <div className="page-head">
        <h1>게시판</h1>
        <p>공지사항 · 자유게시판 · 운영진이 게시판 추가 가능</p>
      </div>
      <BoardView boards={boards} posts={posts} />
    </>
  );
}
