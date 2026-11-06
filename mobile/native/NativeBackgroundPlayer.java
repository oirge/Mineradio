package com.mineradio.oirge.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;

/** Owns sound while the Activity and its WebView are hidden or destroyed. All methods run on main. */
final class NativeBackgroundPlayer {
    interface Listener { void beforePlay(); void changed(); }
    private final Context context;
    private final Listener listener;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final AudioManager audioManager;
    private final SharedPreferences preferences;
    private final PowerManager.WakeLock wakeLock;
    private MediaPlayer player;
    private AudioFocusRequest focusRequest;
    private JSONArray queue = new JSONArray();
    private int index, failures;
    private boolean owned, prepared, wanted, focusPaused, ducked, seekingStart;
    private Runnable prepareTimeout;
    private long position, duration, sleepDue, savedAt, transferAt;
    private float rate = 1, volume = 1;
    private String mode = "loop", sleepMode = "off", error = "";
    private boolean stopAfterTrack;
    private final AudioManager.OnAudioFocusChangeListener focusListener = this::focusChanged;
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!owned) return;
            updatePosition();
            if (sleepDue > 0 && System.currentTimeMillis() >= sleepDue) {
                sleepDue = 0; sleepMode = "off"; pause();
            }
            if (System.currentTimeMillis() - savedAt >= 5000) save(false);
            listener.changed();
            if (wanted || focusPaused) handler.postDelayed(this, 1000);
        }
    };

    NativeBackgroundPlayer(Context context, Listener listener) {
        this.context = context.getApplicationContext(); this.listener = listener;
        preferences = this.context.getSharedPreferences("mineradio-playback", 0);
        audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        wakeLock = ((PowerManager) context.getSystemService(Context.POWER_SERVICE))
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mineradio:NativePlayback");
        wakeLock.setReferenceCounted(false);
    }

    boolean ownsAudio() { return owned; }
    private JSONObject item() { return queue.optJSONObject(index); }
    private String text(String key) { JSONObject value = item(); return value == null ? "" : value.optString(key, ""); }
    private void lock(boolean enabled) {
        if (enabled && !wakeLock.isHeld()) wakeLock.acquire();
        else if (!enabled && wakeLock.isHeld()) wakeLock.release();
    }

    void start(JSONObject state) {
        long incoming = state.optLong("transferAt", System.currentTimeMillis());
        if (owned && incoming <= transferAt) return;
        JSONArray next = state.optJSONArray("queue");
        if (next == null || next.length() == 0) throw new IllegalArgumentException("EMPTY_NATIVE_QUEUE");
        releasePlayer(); abandonFocus();
        queue = next; index = Math.max(0, Math.min(queue.length() - 1, state.optInt("index", 0)));
        position = Math.max(0, (long) (state.optDouble("position", 0) * 1000));
        rate = (float) Math.max(.5, Math.min(2, state.optDouble("rate", 1)));
        volume = (float) Math.max(0, Math.min(1, state.optDouble("volume", 1)));
        mode = state.optString("playMode", "loop");
        sleepMode = state.optString("sleepMode", "off"); sleepDue = state.optLong("sleepDue", 0);
        stopAfterTrack = state.optBoolean("stopAfterTrack", false);
        wanted = state.optBoolean("resumePlaying", state.optBoolean("playing", false));
        owned = true; focusPaused = false; transferAt = incoming; failures = 0; error = "";
        handler.removeCallbacks(tick); handler.postDelayed(tick, 1000);
        save(true); prepare();
    }

    private void prepare() {
        releasePlayer();
        if (!owned || item() == null) return;
        listener.beforePlay(); lock(wanted);
        final MediaPlayer next = new MediaPlayer(); player = next;
        next.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
        next.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK);
        next.setOnPreparedListener(media -> {
            if (!owned || player != media) return;
            if (prepareTimeout != null) { handler.removeCallbacks(prepareTimeout); prepareTimeout = null; }
            prepared = true; duration = media.getDuration();
            long seek = Math.min(position, Math.max(0, duration - 1));
            if (seek > 0) {
                seekingStart = true;
                media.setOnSeekCompleteListener(value -> {
                    if (owned && player == value) { seekingStart = false; value.setOnSeekCompleteListener(null); begin(); }
                });
                if (Build.VERSION.SDK_INT >= 26) media.seekTo(seek, MediaPlayer.SEEK_CLOSEST);
                else media.seekTo((int) seek);
            } else begin();
        });
        next.setOnCompletionListener(media -> {
            if (!owned || player != media) return;
            position = duration;
            if (stopAfterTrack || "track".equals(sleepMode)) {
                stopAfterTrack = false; sleepMode = "off"; pause();
            } else advance(1, false);
        });
        next.setOnErrorListener((media, what, extra) -> {
            if (player == media && owned) failed("MEDIA_" + what + "_" + extra);
            return true;
        });
        try { next.setDataSource(context, Uri.parse(text("uri"))); next.prepareAsync(); }
        catch (Exception problem) { failed(problem.getClass().getSimpleName()); return; }
        prepareTimeout = () -> {
            if (owned && player == next && !prepared) failed("PREPARE_TIMEOUT");
        };
        handler.postDelayed(prepareTimeout, 20000);
        listener.changed();
    }

    private void begin() {
        if (!owned || !prepared || player == null) return;
        if (!wanted || focusPaused) { lock(false); listener.changed(); return; }
        listener.beforePlay();
        if (!requestFocus()) { wanted = false; error = "AUDIO_FOCUS_DENIED"; lock(false); listener.changed(); return; }
        try {
            player.setVolume(volume * (ducked ? .2f : 1), volume * (ducked ? .2f : 1));
            player.start();
            handler.removeCallbacks(tick); handler.postDelayed(tick, 1000);
            if (rate != 1) player.setPlaybackParams(new PlaybackParams().setSpeed(rate).setPitch(1));
            failures = 0; error = ""; lock(true); save(false); listener.changed();
        } catch (Exception problem) { failed(problem.getClass().getSimpleName()); }
    }

    private void failed(String reason) {
        error = reason; releasePlayer();
        if (++failures < Math.min(queue.length(), 8)) {
            index = (index + 1) % queue.length(); position = 0; handler.post(this::prepare);
        } else {
            wanted = false; lock(false); abandonFocus(); save(false); listener.changed();
        }
    }

    void play() {
        if (!owned) return;
        wanted = true; focusPaused = false;
        if (!prepared || player == null) prepare();
        else if (duration > 0 && position >= duration - 1) { position = 0; prepare(); }
        else begin();
    }
    void pause() {
        wanted = false; focusPaused = false; updatePosition();
        try { if (prepared && player != null && player.isPlaying()) player.pause(); } catch (Exception ignored) {}
        lock(false); abandonFocus(); save(false); listener.changed();
    }
    void advance(int delta, boolean manual) {
        if (!owned || queue.length() == 0) return;
        if (manual || !"single".equals(mode)) index = (index + delta + queue.length()) % queue.length();
        position = 0; failures = 0; wanted = true; focusPaused = false; save(false); prepare();
    }
    void seek(long milliseconds) {
        position = Math.max(0, Math.min(milliseconds, Math.max(0, duration - 1)));
        if (prepared && player != null) {
            if (Build.VERSION.SDK_INT >= 26) player.seekTo(position, MediaPlayer.SEEK_CLOSEST);
            else player.seekTo((int) position);
        }
        save(false); listener.changed();
    }

    private boolean requestFocus() {
        if (Build.VERSION.SDK_INT >= 26) {
            if (focusRequest == null) focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setOnAudioFocusChangeListener(focusListener, handler).build();
            return audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        return audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
            == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }
    private void abandonFocus() {
        if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        else audioManager.abandonAudioFocus(focusListener);
    }
    private void focusChanged(int focus) {
        if (!owned) return;
        if (focus == AudioManager.AUDIOFOCUS_LOSS) pause();
        else if (focus == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            updatePosition(); focusPaused = wanted;
            try { if (prepared && player != null && player.isPlaying()) player.pause(); } catch (Exception ignored) {}
            lock(false); listener.changed();
        } else if (focus == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            ducked = true;
            if (prepared && player != null) player.setVolume(volume * .2f, volume * .2f);
        } else if (focus == AudioManager.AUDIOFOCUS_GAIN) {
            ducked = false;
            if (prepared && player != null) player.setVolume(volume, volume);
            if (focusPaused && wanted) { focusPaused = false; begin(); }
        }
    }
    private void updatePosition() {
        try { if (prepared && player != null) position = player.getCurrentPosition(); } catch (Exception ignored) {}
    }
    JSObject snapshot(boolean includeQueue) {
        updatePosition();
        boolean audible = false;
        try { audible = prepared && player != null && player.isPlaying(); } catch (Exception ignored) {}
        JSObject value = new JSObject().put("nativeActive", owned).put("backend", owned ? "native" : "web")
            .put("playing", audible).put("preparing", owned && (!prepared || seekingStart) && player != null)
            .put("waitingForFocus", focusPaused && wanted)
            .put("resumePlaying", wanted && !focusPaused && (!prepared || seekingStart || audible))
            .put("index", index).put("uri", text("uri")).put("title", text("title")).put("artist", text("artist"))
            .put("position", position / 1000.0).put("duration", duration / 1000.0).put("rate", rate).put("volume", volume)
            .put("playMode", mode).put("sleepMode", sleepMode).put("sleepDue", sleepDue).put("stopAfterTrack", stopAfterTrack)
            .put("transferAt", transferAt).put("error", error)
            .put("audioSessionId", player == null ? 0 : player.getAudioSessionId());
        if (includeQueue) value.put("queue", queue);
        return value;
    }
    private void save(boolean includeQueue) {
        savedAt = System.currentTimeMillis();
        SharedPreferences.Editor editor = preferences.edit().putString("state", snapshot(false).toString());
        if (includeQueue) editor.putString("queue", queue.toString());
        editor.apply();
    }
    static JSObject stored(Context context) {
        SharedPreferences preferences = context.getSharedPreferences("mineradio-playback", 0);
        try {
            JSObject state = new JSObject(preferences.getString("state", "{}"));
            state.put("queue", new JSONArray(preferences.getString("queue", "[]")));
            return state;
        } catch (Exception ignored) { return new JSObject().put("nativeActive", false); }
    }
    JSObject take() {
        JSObject state = snapshot(true);
        owned = false; wanted = false; handler.removeCallbacks(tick); releasePlayer(); abandonFocus(); lock(false);
        save(false); listener.changed();
        return state;
    }
    private void releasePlayer() {
        if (prepareTimeout != null) { handler.removeCallbacks(prepareTimeout); prepareTimeout = null; }
        prepared = false; seekingStart = false;
        MediaPlayer previous = player; player = null;
        if (previous != null) { previous.setOnErrorListener(null); previous.setOnCompletionListener(null); previous.release(); }
    }
    void close() {
        handler.removeCallbacksAndMessages(null); owned = false; wanted = false;
        releasePlayer(); abandonFocus(); lock(false);
    }
}
