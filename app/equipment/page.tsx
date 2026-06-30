import { getEquipment } from "@/lib/db";
import EquipmentList from "@/components/EquipmentList";

export default async function EquipmentPage() {
  const items = await getEquipment();
  return (
    <>
      <div className="page-head">
        <h1>공용 장비 / 비품</h1>
        <p>대분류 필터 · 가나다순 정렬 · 대여 / 반납 / 고장 신고</p>
      </div>
      <EquipmentList initial={items} />
    </>
  );
}
