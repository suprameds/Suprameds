package in.supracyn.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Notification channel IDs. FCM payloads should set "channel_id" to one of
     * these values so the notification respects user-configured importance and
     * mute settings. The "orders" channel is also wired as the default fallback
     * via meta-data in AndroidManifest.xml.
     */
    private static final String CHANNEL_ORDERS = "orders";
    private static final String CHANNEL_PRESCRIPTIONS = "prescriptions";
    private static final String CHANNEL_PROMOTIONS = "promotions";
    private static final String CHANNEL_ACCOUNT = "account";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Create notification channels before any FCM message can arrive.
        createNotificationChannels();

        // ---- Native-feel tweaks ----
        WebView webView = this.bridge.getWebView();

        // Kill the blue edge glow on overscroll ("this is a webview" tell).
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Disable remote Chrome DevTools on release builds. Defense-in-depth:
        // Capacitor already gates this on BuildConfig.DEBUG, but keep explicit.
        // if (!BuildConfig.DEBUG) {
        //    WebView.setWebContentsDebuggingEnabled(false);
        // }

        // ---- Edge-to-edge + inset handling for Android 15 (targetSdk 36) ----
        // System bars draw over the web content; Capacitor's StatusBar.setOverlaysWebView(false)
        // flips this back for screens that opt in. We also manually pad via WindowInsetsCompat
        // as a belt-and-suspenders for rotation + keyboard inset events.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.parseColor("#0D1B2A"));
        getWindow().setNavigationBarColor(Color.parseColor("#0D1B2A"));

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(
                systemBars.left,
                systemBars.top,
                systemBars.right,
                Math.max(systemBars.bottom, ime.bottom)
            );
            return WindowInsetsCompat.CONSUMED;
        });

        // Android 11+ keyboard as IME inset (replaces deprecated SOFT_INPUT_ADJUST_RESIZE).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }
    }

    /**
     * Register notification channels for Android 8+ (API 26+). Channels let
     * users mute categories independently from the system Settings app.
     * Re-creation is a no-op once a channel exists, so this is safe to call
     * on every app launch.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel orders = new NotificationChannel(
            CHANNEL_ORDERS,
            getString(R.string.notif_channel_orders_name),
            NotificationManager.IMPORTANCE_HIGH);
        orders.setDescription(getString(R.string.notif_channel_orders_desc));
        orders.enableVibration(true);
        orders.setShowBadge(true);

        NotificationChannel prescriptions = new NotificationChannel(
            CHANNEL_PRESCRIPTIONS,
            getString(R.string.notif_channel_prescriptions_name),
            NotificationManager.IMPORTANCE_HIGH);
        prescriptions.setDescription(getString(R.string.notif_channel_prescriptions_desc));
        prescriptions.enableVibration(true);
        prescriptions.setShowBadge(true);

        NotificationChannel promotions = new NotificationChannel(
            CHANNEL_PROMOTIONS,
            getString(R.string.notif_channel_promotions_name),
            NotificationManager.IMPORTANCE_LOW);
        promotions.setDescription(getString(R.string.notif_channel_promotions_desc));
        promotions.enableVibration(false);
        promotions.setShowBadge(false);

        NotificationChannel account = new NotificationChannel(
            CHANNEL_ACCOUNT,
            getString(R.string.notif_channel_account_name),
            NotificationManager.IMPORTANCE_HIGH);
        account.setDescription(getString(R.string.notif_channel_account_desc));
        account.enableVibration(true);
        account.setShowBadge(true);

        nm.createNotificationChannel(orders);
        nm.createNotificationChannel(prescriptions);
        nm.createNotificationChannel(promotions);
        nm.createNotificationChannel(account);
    }
}
