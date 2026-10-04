// hook رفع تداخل CJS/ESM آیکون‌های MUI فقط در تست‌های Node (Vite در build/dev مشکلی ندارد):
// `@mui/icons-material/X` را به نسخهٔ ESM آن (`esm/X.js`) هدایت می‌کند.
export async function resolve(specifier, context, nextResolve) {
  const m = /^@mui\/icons-material\/([A-Za-z0-9]+)$/.exec(specifier);
  if (m) return nextResolve(`@mui/icons-material/esm/${m[1]}.js`, context);
  return nextResolve(specifier, context);
}
