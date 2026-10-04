import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ir.karegahyar.app",
  appName: "کارگاه‌یار",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      // آیکون پیش‌فرض نوار وضعیت برای همه نوتیفیکیشن‌ها (باید در res/drawable باشد،
      // نه res/mipmap — آیکون‌های لانچر در mipmap توسط این پلاگین قابل‌شناسایی نیستند).
      smallIcon: "ic_stat_notify",
      // رنگ آیکون/نوار نوتیفیکیشن، هماهنگ با رنگ اصلی برند اپ (نارنجی ایمنی کارگاهی).
      iconColor: "#FF7A00",
    },
  },
};

export default config;
