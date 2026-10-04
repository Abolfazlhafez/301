/**
 * ارتباط بین یک پروژه و یک نیروی موجود (Worker) — طبق تصمیم صریح کاربر:
 * «نیروها ترکیبی از دو حالت»، یعنی:
 *   - خودِ Worker سراسری و مشترک باقی می‌ماند (چون یک نفر واقعی است؛ نباید
 *     به‌ازای هر پروژه یک رکورد تکراری از همان فرد ساخته شود).
 *   - این‌که «کدام نیرو الان در کدام پروژه فعال است» یک رابطهٔ جداگانه
 *     است (هر نیرو می‌تواند هم‌زمان در چند پروژه فعال باشد).
 *
 * این Entity دقیقاً همان الگوی FloorWorker (رابطهٔ طبقه↔نیرو) را برای سطح
 * پروژه تکرار می‌کند، تا با سبک موجود کد هماهنگ بماند.
 */
export interface ProjectWorker {
  id: string;
  projectId: string;
  workerId: string;
  createdAt: string;
}

export interface CreateProjectWorkerInput {
  projectId: string;
  workerId: string;
}
