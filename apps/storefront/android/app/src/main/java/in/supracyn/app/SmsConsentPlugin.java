package in.supracyn.app;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.phone.SmsRetriever;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Status;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Android SMS User Consent API — listens for an incoming SMS containing a
 * numeric code, then shows a one-tap consent dialog quoting the message.
 *
 * No SMS permission required (that's the whole point of this API vs the older
 * SMS Retriever API). Works with any SMS body containing a 4-10 digit code
 * from any sender, so it does NOT require us to register a new DLT template
 * with the special `<#> ... <hash>` suffix that SMS Retriever needs.
 *
 * JS flow:
 *   1. JS calls `startListening()` when the OTP verify step opens.
 *   2. Plugin tells Play Services to watch SMS for 5 minutes.
 *   3. SMS arrives → BroadcastReceiver fires → consent dialog launched.
 *   4. User taps "Allow" → @ActivityCallback parses the code → JS gets
 *      the `smsReceived` event with `{ code, message }`.
 *
 * Failure modes (all bubble back as `denied` / `timeout` events so the JS
 * side knows to stop showing a "waiting for SMS" hint):
 *   - User taps "Deny" on the consent dialog.
 *   - 5-minute window elapses with no matching SMS.
 *   - Multiple SIMs / dual-app scenarios where the SMS isn't routed here.
 */
@CapacitorPlugin(name = "SmsConsent")
public class SmsConsentPlugin extends Plugin {
    private static final String TAG = "SmsConsentPlugin";

    // Match 4-8 digit codes — covers our 6-digit OTPs plus any future variation.
    // Word boundaries prevent grabbing parts of order numbers or phone digits.
    private static final Pattern CODE_PATTERN = Pattern.compile("\\b(\\d{4,8})\\b");

    private String savedCallId;
    private BroadcastReceiver smsReceiver;

    @PluginMethod
    public void startListening(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        // Tear down any prior session before starting a new one (re-tries within
        // the same OTP screen, or after a previous code was consumed).
        cleanupReceiver();
        releaseSavedCall();

        // Keep the call alive so the @ActivityCallback can resolve through it
        // after the user reacts to the consent dialog.
        call.setKeepAlive(true);
        bridge.saveCall(call);
        savedCallId = call.getCallbackId();

        SmsRetriever.getClient(activity)
            .startSmsUserConsent(null /* any sender — Indian DLT doesn't expose a stable sender phone */)
            .addOnSuccessListener(v -> {
                registerReceiver();
                JSObject ret = new JSObject();
                ret.put("listening", true);
                call.resolve(ret);
            })
            .addOnFailureListener(e -> {
                Log.w(TAG, "startSmsUserConsent failed", e);
                releaseSavedCall();
                call.reject("startSmsUserConsent failed: " + e.getMessage());
            });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        cleanupReceiver();
        releaseSavedCall();
        call.resolve();
    }

    private void registerReceiver() {
        if (smsReceiver != null) return;
        smsReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                if (!SmsRetriever.SMS_RETRIEVED_ACTION.equals(intent.getAction())) return;
                Bundle extras = intent.getExtras();
                if (extras == null) return;
                Status status = (Status) extras.get(SmsRetriever.EXTRA_STATUS);
                if (status == null) return;

                switch (status.getStatusCode()) {
                    case CommonStatusCodes.SUCCESS: {
                        Intent consentIntent = extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT);
                        if (consentIntent != null) {
                            launchConsent(consentIntent);
                        }
                        break;
                    }
                    case CommonStatusCodes.TIMEOUT: {
                        notifyListeners("timeout", new JSObject(), false);
                        cleanupReceiver();
                        releaseSavedCall();
                        break;
                    }
                    default:
                        // Unknown — bail out cleanly so JS doesn't hang on the listener.
                        Log.w(TAG, "Unexpected SmsRetriever status: " + status.getStatusCode());
                        cleanupReceiver();
                        releaseSavedCall();
                        break;
                }
            }
        };

        IntentFilter filter = new IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION);
        Context context = getContext();
        // Permission ensures only Google Play Services can dispatch this broadcast
        // — a malicious app on the device can't spoof an OTP into our listener.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 14+ requires explicit export flag for runtime-registered
            // receivers that handle broadcasts from other apps (Play Services).
            context.registerReceiver(
                smsReceiver,
                filter,
                SmsRetriever.SEND_PERMISSION,
                null,
                Context.RECEIVER_EXPORTED
            );
        } else {
            context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null);
        }
    }

    private void cleanupReceiver() {
        if (smsReceiver == null) return;
        try {
            getContext().unregisterReceiver(smsReceiver);
        } catch (IllegalArgumentException ignored) {
            // Already unregistered — fine.
        }
        smsReceiver = null;
    }

    private void releaseSavedCall() {
        if (savedCallId == null) return;
        bridge.releaseCall(savedCallId);
        savedCallId = null;
    }

    private void launchConsent(Intent consentIntent) {
        if (savedCallId == null) return;
        PluginCall call = bridge.getSavedCall(savedCallId);
        if (call == null) return;
        try {
            startActivityForResult(call, consentIntent, "smsConsentResult");
        } catch (Exception e) {
            Log.w(TAG, "Failed to launch consent dialog", e);
            cleanupReceiver();
            releaseSavedCall();
        }
    }

    @ActivityCallback
    private void smsConsentResult(PluginCall call, ActivityResult result) {
        cleanupReceiver();

        JSObject ret = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String message = result.getData().getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE);
            if (message != null) {
                ret.put("message", message);
                Matcher m = CODE_PATTERN.matcher(message);
                if (m.find()) {
                    ret.put("code", m.group(1));
                }
            }
            notifyListeners("smsReceived", ret, false);
        } else {
            // User tapped "Deny" or dismissed the dialog. Retain=false prevents
            // a stale "denied" from being delivered to the next OTP session if
            // JS unmounted between native dispatch and JS receipt.
            notifyListeners("denied", ret, false);
        }

        releaseSavedCall();
    }

    @Override
    protected void handleOnDestroy() {
        cleanupReceiver();
        releaseSavedCall();
        super.handleOnDestroy();
    }
}
