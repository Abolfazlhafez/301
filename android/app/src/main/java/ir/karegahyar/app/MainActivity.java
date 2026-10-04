package ir.karegahyar.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "KaregahYar";
    // حلقهٔ بی‌نهایت بازسازی را قطع می‌کند: اگر در بازهٔ کوتاه چندبار پشت‌سرهم رندرر مُرد، دیگر تلاش نمی‌کنیم.
    private static final long WINDOW_MS = 15_000L;
    private static final int MAX_RECOVERIES_IN_WINDOW = 3;
    private static long windowStart = 0L;
    private static int recoveries = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // اگر پردازهٔ رندر WebView بمیرد (کرش یا کشته‌شدن توسط سیستم به‌خاطر کمبود حافظه) و هیچ‌کس
        // آن را «هندل‌شده» اعلام نکند، خودِ اپ هم کرش می‌کند — همان پیام «WebView باعث کرش اپ شد».
        // با برگرداندن true می‌گوییم هندل کردیم؛ اپ زنده می‌ماند و Activity (با WebView تازه) بازسازی می‌شود.
        // داده‌ها در SQLite نیتیو و فایل هستند و با هر تغییر فوراً ذخیره شده‌اند، پس چیزی از دست نمی‌رود.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                Log.w(TAG, "WebView render process gone; didCrash="
                        + (detail != null && detail.didCrash()));
                long now = System.currentTimeMillis();
                if (now - windowStart > WINDOW_MS) {
                    windowStart = now;
                    recoveries = 0;
                }
                recoveries++;
                if (recoveries > MAX_RECOVERIES_IN_WINDOW) {
                    Log.e(TAG, "Too many WebView failures in a short time; finishing activity.");
                    runOnUiThread(() -> finish());
                    return true;
                }
                runOnUiThread(() -> {
                    try {
                        recreate();
                    } catch (Exception e) {
                        Log.e(TAG, "recreate failed", e);
                    }
                });
                return true;
            }
        });
    }
}
