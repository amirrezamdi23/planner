package com.amirrezamdi23.planner;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // MusicPlayerPlugin/AlarmRingPlugin/OpenAppPlugin live directly in
        // this app (not installed Capacitor plugin packages), so they need
        // explicit registration before the bridge starts up.
        registerPlugin(MusicPlayerPlugin.class);
        registerPlugin(AlarmRingPlugin.class);
        registerPlugin(OpenAppPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
