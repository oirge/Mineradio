package com.mineradio.oirge.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;

/** The Activity observes a service-owned engine; visibility never transfers sound. */
final class NativeBackgroundPlayer {
    interface Listener { void beforePlay(); void changed(); }
    private final Context context;
    private final Listener listener;
    private final NativeAudioEngine engine;
    private final SharedPreferences preferences;
    private final AudioManager manager;
    private final PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private AudioFocusRequest focusRequest;
    private boolean owned, focusPaused;
    private long sleepDue, savedAt;
    private String sleepMode = "off";
    private float volume = 1;
    private final AudioManager.OnAudioFocusChangeListener focusListener = this::focusChanged;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!owned) return;
            if (sleepDue > 0 && System.currentTimeMillis() >= sleepDue) {
                sleepDue = 0; sleepMode = "off";
                engine.gain(0, 300); handler.postDelayed(() -> pause(), 320);
            }
            JSObject state = snapshot(false);
            lock(state.optBoolean("playing") || state.optBoolean("preparing"));
            if (System.currentTimeMillis() - savedAt >= 5000) save(false);
            listener.changed(); handler.postDelayed(this, 1000);
        }
    };
    NativeBackgroundPlayer(Context context, Listener listener) {
        this.context = context.getApplicationContext(); this.listener = listener;
        preferences = this.context.getSharedPreferences("mineradio-playback", 0);
        manager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        wakeLock = ((PowerManager) context.getSystemService(Context.POWER_SERVICE))
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mineradio:NativePlayback");
        wakeLock.setReferenceCounted(false);
        engine = new NativeAudioEngine(this.context, new NativeAudioEngine.Listener() {
            @Override public void changed() { if (owned) { save(false); listener.changed(); } }
            @Override public void completed() {
                if ("track".equals(sleepMode) && !engine.snapshot(false).optBoolean("resumePlaying")) { sleepMode = "off"; sleepDue = 0; }
                save(true);
            }
        });
    }
    boolean ownsAudio() { return owned; }
    private void lock(boolean enabled) {
        if (enabled && !wakeLock.isHeld()) wakeLock.acquire();
        else if (!enabled && wakeLock.isHeld()) wakeLock.release();
    }
    void start(JSONObject state) {
        listener.beforePlay();
        boolean wants = state.optBoolean("resumePlaying", state.optBoolean("playing", false));
        if (state.optLong("sleepDue", 0) > 0 && state.optLong("sleepDue") <= System.currentTimeMillis()) {
            wants = false;
            try { state.put("resumePlaying", false).put("sleepDue", 0).put("sleepMode", "off"); } catch (Exception ignored) {}
        }
        if (wants && !requestFocus()) throw new IllegalStateException("AUDIO_FOCUS_DENIED");
        owned = true; focusPaused = false; updateSleep(state);
        volume = (float) state.optDouble("volume", volume);
        engine.start(state); lock(wants); save(true);
        handler.removeCallbacks(tick); handler.postDelayed(tick, 1000);
    }
    private void updateSleep(JSONObject state) {
        sleepMode = state.optString("sleepMode", sleepMode); sleepDue = state.optLong("sleepDue", sleepDue);
        if ("track".equals(sleepMode)) try { state.put("stopAfterTrack", true); } catch (Exception ignored) {}
    }
    void configure(JSONObject state) {
        updateSleep(state); volume = (float) state.optDouble("volume", volume);
        engine.configure(state); save(false); listener.changed();
    }
    void updateQueue(JSONArray queue) { engine.updateQueue(queue); save(true); }
    void uiSound(int direction, boolean row, float level) { engine.uiSound(direction, row, level); }
    void gain(float target, long durationMs) { engine.gain(target, durationMs); }
    void play() { play(null); }
    void play(Float initialGain) {
        if (!owned) return;
        listener.beforePlay(); if (!requestFocus()) return;
        focusPaused = false;
        if (initialGain == null) engine.gain(volume, 80);
        engine.play(initialGain); lock(true); save(false); listener.changed();
    }
    void pause() { focusPaused = false; engine.pause(); lock(false); abandonFocus(); save(false); listener.changed(); }
    void advance(int delta, boolean manual) {
        if (!owned) return;
        listener.beforePlay(); if (!requestFocus()) return;
        focusPaused = false; engine.advance(delta); lock(true); save(true); listener.changed();
    }
    void seek(long milliseconds) { engine.seek(milliseconds / 1000.0); save(false); listener.changed(); }
    private boolean requestFocus() {
        if (Build.VERSION.SDK_INT >= 26) {
            if (focusRequest == null) focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setOnAudioFocusChangeListener(focusListener, handler).build();
            return manager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        return manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
            == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void abandonFocus() {
        if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) manager.abandonAudioFocusRequest(focusRequest);
        else manager.abandonAudioFocus(focusListener);
    }
    private void focusChanged(int focus) {
        if (!owned) return;
        if (focus == AudioManager.AUDIOFOCUS_LOSS) pause();
        else if (focus == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            focusPaused = engine.snapshot(false).optBoolean("resumePlaying"); engine.pause(); lock(false); listener.changed();
        } else if (focus == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) engine.gain(volume * .2f, 80);
        else if (focus == AudioManager.AUDIOFOCUS_GAIN) {
            engine.gain(volume, 80);
            if (focusPaused) { focusPaused = false; play(); }
        }
    }
    JSObject snapshot(boolean includeQueue) {
        return engine.snapshot(includeQueue).put("nativeActive", owned).put("sleepMode", sleepMode)
            .put("sleepDue", sleepDue).put("waitingForFocus", focusPaused).put("volume", volume);
    }
    private void save(boolean includeQueue) {
        savedAt = System.currentTimeMillis();
        JSObject state = snapshot(includeQueue); state.remove("analysis");
        SharedPreferences.Editor editor = preferences.edit().putString("state", state.toString());
        if (includeQueue) editor.putString("queue", state.optJSONArray("queue").toString());
        editor.apply();
    }
    static JSObject stored(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("mineradio-playback", 0);
        try { return new JSObject(prefs.getString("state", "{}")).put("queue", new JSONArray(prefs.getString("queue", "[]"))); }
        catch (Exception ignored) { return new JSObject().put("nativeActive", false); }
    }
    void close() { handler.removeCallbacksAndMessages(null); owned = false; engine.close(); abandonFocus(); lock(false); }
}
