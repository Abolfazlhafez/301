/**
 * matchesSearchTerm: جستجوی فهرست نیروها/انبار باید با ارقام فارسی/عربی/انگلیسی یکسان کار کند
 * و رفتار قبلی (حساس‌نبودن به حروف، عبارت خالی = همه) حفظ شود.
 */
import { matchesSearchTerm } from "../../shared/utils/format";

let failed = 0;
function check(cond: boolean, name: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else { failed++; console.log(`  ❌ ${name}`); }
}

const worker = "علی رضایی Mason 09121234567";
check(matchesSearchTerm(worker, "۰۹۱۲"), "رقم فارسی در پرس‌وجو، تلفن انگلیسی ذخیره‌شده");
check(matchesSearchTerm(worker, "٠٩١٢"), "رقم عربی در پرس‌وجو");
check(matchesSearchTerm(worker, "0912"), "رقم انگلیسی مثل قبل");
check(matchesSearchTerm("علی ۰۹۱۲۱۲۳۴۵۶۷", "09121234"), "تلفن فارسی ذخیره‌شده، پرس‌وجوی انگلیسی");
check(matchesSearchTerm(worker, "mason"), "حساس‌نبودن به حروف");
check(matchesSearchTerm(worker, "رضایی"), "جستجوی نام فارسی");
check(matchesSearchTerm(worker, "   "), "عبارت فقط‌فاصله = همه");
check(matchesSearchTerm(worker, ""), "عبارت خالی = همه");
check(!matchesSearchTerm(worker, "۹۹۹۹"), "عدم تطبیق درست");
check(matchesSearchTerm("Drill EQ-12 hammer", "eq-۱۲"), "کد قلم با رقم فارسی");
console.log(failed ? `\nناموفق: ${failed}` : "\nهمه موفق");
if (failed) process.exit(1);
