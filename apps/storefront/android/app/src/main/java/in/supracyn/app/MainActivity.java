package in.supracyn.app;

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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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
}
