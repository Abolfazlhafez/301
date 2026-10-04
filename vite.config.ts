import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// شماره نسخه از package.json خوانده می‌شود تا در بخش «تنظیمات > درباره ما»
// نمایش داده شود (بدون نیاز به هاردکد کردن یا هم‌گام نگه‌داشتن دستی دو فایل).
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // این خروجی داخل یک اپلیکیشن بسته‌بندی‌شده و بومی با Capacitor اجرا می‌شود،
      // نه به‌عنوان یک PWA در مرورگر. اگر Service Worker واقعاً ثبت و فعال شود،
      // بعد از هر بار npm run build + npx cap sync ممکن است همچنان نسخه‌ی
      // قدیمی فایل‌های JS/CSS را از کش خودش نشان دهد، نه فایل‌های تازه‌ای که در
      // APK جدید سینک شده‌اند. برای همین، تزریق اسکریپت ثبت آن غیرفعال شده
      // (فایل‌های manifest/آیکون همچنان تولید می‌شوند، فقط رجیستر نمی‌شوند).
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "icons/apple-touch-icon.png",
        "icons/favicon-32.png",
        "icons/favicon-16.png",
      ],
      manifest: {
        id: "/",
        name: "دستیار سرپرست کارگاه",
        short_name: "کارگاه‌یار",
        description: "اپلیکیشن مدیریت نیروها و محاسبه حقوق کارگاه ساختمانی",
        theme_color: "#FF7A00",
        background_color: "#121417",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "fa",
        dir: "rtl",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        categories: ["business", "productivity", "utilities"],
        shortcuts: [
          {
            name: "ثبت حضور",
            short_name: "حضور",
            url: "/attendance",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "داشبورد",
            short_name: "داشبورد",
            url: "/",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // برنامه کاملاً آفلاین است و هیچ مسیر /api ای فراخوانی نمی‌شود؛
        // قانون کش مخصوص آن (که مربوط به بک‌اند قدیمی Node.js بود) حذف شد.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
});
