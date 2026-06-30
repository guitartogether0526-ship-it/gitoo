import {
  NOTICES,
  RESERVATIONS,
  EQUIPMENT,
  TEAMS,
  SONGS,
  MEMBERS,
  DUES,
  EXPENSES,
} from "./mock-data";
import type {
  Notice,
  Reservation,
  Equipment,
  Team,
  Song,
  Member,
  DuesPayment,
  Expense,
} from "./types";

/**
 * 데이터 접근 계층 (Data Access Layer).
 *
 * 지금은 목업 배열을 async 로 반환한다.
 * 추후 Supabase 연동 시 각 함수 본문만 아래 형태로 교체하면 된다:
 *
 *   import { createClient } from "@supabase/supabase-js";
 *   const supabase = createClient(URL, ANON_KEY);
 *   export async function getEquipment() {
 *     const { data } = await supabase.from("equipment").select("*").order("name");
 *     return data ?? [];
 *   }
 *
 * 컴포넌트는 이 인터페이스(함수 시그니처)에만 의존하므로 UI 변경이 필요 없다.
 */

// 가나다순 정렬 헬퍼 (한글 로캘)
const byKo = (a: string, b: string) => a.localeCompare(b, "ko");

export async function getNotices(): Promise<Notice[]> {
  // supabase.from("notices").select("*").order("created_at", { ascending: false })
  return [...NOTICES].sort((a, b) =>
    a.pinned === b.pinned
      ? b.created_at.localeCompare(a.created_at)
      : a.pinned
        ? -1
        : 1,
  );
}

export async function getReservations(): Promise<Reservation[]> {
  // supabase.from("reservations").select("*").order("date")
  return [...RESERVATIONS].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time_label.localeCompare(b.time_label),
  );
}

export async function getTeams(): Promise<Team[]> {
  // supabase.from("teams").select("*")
  return [...TEAMS];
}

export async function getEquipment(): Promise<Equipment[]> {
  // supabase.from("equipment").select("*").order("name")
  return [...EQUIPMENT].sort((a, b) => byKo(a.name, b.name));
}

export async function getSongs(): Promise<Song[]> {
  // supabase.from("songs").select("*, sheets(*)").order("title")
  return [...SONGS].sort((a, b) => byKo(a.title, b.title));
}

export async function getMembers(): Promise<Member[]> {
  // supabase.from("members").select("*").order("name")
  return [...MEMBERS].sort((a, b) => byKo(a.name, b.name));
}

export async function getDues(): Promise<DuesPayment[]> {
  // supabase.from("dues").select("*")
  return [...DUES];
}

export async function getExpenses(): Promise<Expense[]> {
  // supabase.from("expenses").select("*").order("date")
  return [...EXPENSES].sort((a, b) => a.date.localeCompare(b.date));
}
