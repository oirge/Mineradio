package com.mineradio.oirge.mobile;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(MineradioLibraryPlugin.class);
        super.onCreate(state);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { MineradioLibraryPlugin.control("back"); }
        });
    }
    @Override public void onDestroy() {
        boolean removed = isFinishing() && !isChangingConfigurations();
        super.onDestroy();
        if (removed) PlaybackService.hostDestroyed(getApplicationContext());
    }
}
