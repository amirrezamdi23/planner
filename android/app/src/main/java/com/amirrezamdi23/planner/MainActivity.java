package com.amirrezamdi23.planner;

import android.content.Intent;
import android.os.Bundle;
import android.provider.AlarmClock;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // @capacitor/local-notifications tags the intent its action buttons launch
    // this activity with (LocalNotificationManager.ACTION_INTENT_KEY). "yes" is
    // the بله button of the nightly alarm reminder — the app's only
    // confirm-style notification.
    private static final String NOTIFICATION_ACTION_EXTRA = "LocalNotificationUserAction";
    private static final String CONFIRM_YES = "yes";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // MusicPlayerPlugin/AlarmRingPlugin live directly in this app (not
        // installed Capacitor plugin packages), so they need explicit
        // registration before the bridge starts up.
        registerPlugin(MusicPlayerPlugin.class);
        registerPlugin(AlarmRingPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Tapping a notification action always launches this activity, so opening
    // the clock has to happen here rather than from a JS
    // localNotificationActionPerformed listener: on a cold start the WebView
    // isn't up yet when the action arrives, so the JS never got to run and the
    // tap only ever brought up this app.
    //
    // BridgeActivity funnels its own launch intent through onNewIntent at the
    // end of onCreate, so this single override covers a killed app and a
    // backgrounded one alike.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent != null && CONFIRM_YES.equals(intent.getStringExtra(NOTIFICATION_ACTION_EXTRA))) {
            openClockApp();
        }
    }

    // The system ACTION_SHOW_ALARMS contract rather than a hardcoded package
    // name (com.android.deskclock, com.sec.android.app.clockpackage, ...) so
    // this opens whichever clock app the OEM ships. Needs the <queries> entry
    // in AndroidManifest.xml to resolve at all on Android 11+.
    private void openClockApp() {
        try {
            startActivity(new Intent(AlarmClock.ACTION_SHOW_ALARMS));
        } catch (Exception ignored) {
            // No clock app handles the standard intent — there's nothing
            // sensible to fall back to, and the reminder has done its job.
        }
    }
}
