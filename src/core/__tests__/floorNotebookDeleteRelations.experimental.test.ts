import "fake-indexeddb/auto";

import { db } from "../db";
import { floorService } from "../services/floorService";
import { photoService } from "../services/photoService";

async function main() {
  const floor = await floorService.create({ name: "طبقهٔ تست حذف روابط", usageType: "residential" });
  const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
  const file = new File([blob], "test.jpg", { type: "image/jpeg" });

  const photo = await photoService.upload({
    file,
    relatedType: "floor",
    relatedId: floor.id,
    floorId: floor.id,
    stageId: (await db.floorStages.where({ floorId: floor.id }).first())?.id ?? null,
    phase: "before",
    date: "2026-01-01",
  });

  await floorService.remove(floor.id);

  const preserved = await db.photos.get(photo.id);
  if (!preserved) throw new Error("عکس مرتبط با طبقه بعد از حذف Floor حفظ نشد.");
  if (preserved.floorId !== null || preserved.stageId !== null || preserved.taskId !== null) {
    throw new Error("روابط عکس هنگام حذف Floor به‌درستی Unlink نشدند.");
  }

  console.log("✅ حذف Floor عکس/Blob را حذف نمی‌کند و همهٔ Relationهای Floor/Stage/Task را Unlink می‌کند.");
}

main().catch((err) => {
  console.error(err);
  throw err;
});
