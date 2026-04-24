# Keep line numbers for crash-reporting (Firebase Crashlytics / Sentry / Play Console)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- Capacitor core ----
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PluginMethod <methods>;
}

# Capacitor plugins use JS-bridged classes via reflection
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }
-keep class * extends com.getcapacitor.WebViewListener { *; }

# ---- Cordova shim (Capacitor includes capacitor-cordova-android-plugins) ----
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }

# ---- Firebase / Google Play Services ----
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ---- WebView JS interfaces ----
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class androidx.webkit.** { *; }
-dontwarn androidx.webkit.**

# ---- Misc library warnings ----
-dontwarn com.getcapacitor.**
-dontwarn okhttp3.**
-dontwarn okio.**
