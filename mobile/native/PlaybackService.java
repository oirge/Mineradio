package com.mineradio.oirge.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.FileDescriptor;
import java.io.PrintWriter;

/** Foreground session for both the visible WebAudio engine and the independent background player. */
public class PlaybackService extends Service {
    public static volatile boolean running;
    private static volatile PlaybackService instance;
    private static volatile JSONObject webState = new JSONObject();
    private static volatile JSONArray webQueue = new JSONArray();
    private static volatile long webUpdatedAt;
    private MediaSession session;
    private NativeBackgroundPlayer nativePlayer;
    private PowerManager.WakeLock webLock;
    private String notificationSignature = "", metadataSignature = "";
    private volatile String diagnostic = "{}";
    private boolean foreground, taking;
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { route("pause"); }
    };

    static PlaybackService current() { return instance; }
    static void cacheQueue(Context context, JSONArray queue) {
        webQueue = queue;
        if (instance != null && instance.nativePlayer.ownsAudio()) instance.nativePlayer.updateQueue(queue);
        context.getSharedPreferences("mineradio-playback", 0).edit().putString("webQueue", queue.toString()).apply();
    }
    static void cacheWeb(Context context, JSONObject state) {
        try { webState = new JSONObject(state.toString()).put("nativeActive", false).put("backend", "web"); }
        catch (Exception ignored) { return; }
        webUpdatedAt = SystemClock.elapsedRealtime();
        if (instance != null && instance.nativePlayer.ownsAudio()) instance.nativePlayer.configure(state);
        context.getSharedPreferences("mineradio-playback", 0).edit().putString("webState", webState.toString()).apply();
    }
    private static JSONObject webSnapshot(Context context) {
        try {
            if (webQueue.length() == 0) webQueue = new JSONArray(context.getSharedPreferences("mineradio-playback", 0).getString("webQueue", "[]"));
            if (webState.length() == 0) webState = new JSONObject(context.getSharedPreferences("mineradio-playback", 0).getString("webState", "{}"));
            JSONObject state = new JSONObject(webState.toString());
            if (webUpdatedAt > 0 && state.optBoolean("playing", false)) state.put("position", state.optDouble("position", 0)
                + Math.max(0, SystemClock.elapsedRealtime() - webUpdatedAt) / 1000.0 * state.optDouble("rate", 1));
            state.put("queue", webQueue).put("transferAt", System.currentTimeMillis());
            return state;
        } catch (Exception ignored) { return new JSONObject(); }
    }
    static void hostDestroyed(Context context) { /* The audio engine belongs to this service. */ }

    @Override public void onCreate() {
        super.onCreate(); running = true; instance = this;
        webLock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mineradio:WebPlayback");
        webLock.setReferenceCounted(false);
        nativePlayer = new NativeBackgroundPlayer(this, new NativeBackgroundPlayer.Listener() {
            @Override public void beforePlay() { ensureForeground(); }
            @Override public void changed() { if (!taking) publish(); }
        });
        session = new MediaSession(this, "Mineradio");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { route("play"); }
            @Override public void onPause() { route("pause"); }
            @Override public void onSkipToNext() { route("next"); }
            @Override public void onSkipToPrevious() { route("previous"); }
            @Override public void onSeekTo(long position) {
                if (nativePlayer.ownsAudio()) nativePlayer.seek(position);
                else MineradioLibraryPlugin.seek(position);
            }
            @Override public void onStop() { route("stop"); }
        });
        if (Build.VERSION.SDK_INT >= 26) ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(
            new NotificationChannel("playback", "音乐播放", NotificationManager.IMPORTANCE_LOW));
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(noisy, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
    }

    JSObject state() {
        return nativePlayer.ownsAudio() ? nativePlayer.snapshot(true) : new JSObject().put("nativeActive", false).put("backend", "web");
    }
    void startNative(JSONObject state) {
        if (webLock.isHeld()) webLock.release();
        nativePlayer.start(state);
    }
    void configureNative(JSONObject value) { if (nativePlayer.ownsAudio()) nativePlayer.configure(value); }
    void playNative(Float initialGain) { nativePlayer.play(initialGain); }
    void commandNative(String action, long position) {
        if ("seek".equals(action)) nativePlayer.seek(position);
        else route(action);
    }
    void uiSound(int direction, boolean row, float volume) { nativePlayer.uiSound(direction, row, volume); }
    void gainNative(float target, long duration) { nativePlayer.gain(target, duration); }

    private void route(String action) {
        if ("stop".equals(action)) {
            if (nativePlayer.ownsAudio()) nativePlayer.pause();
            else MineradioLibraryPlugin.control("pause");
            stopForeground(true); foreground = false; stopSelf(); return;
        }
        if (nativePlayer.ownsAudio()) {
            if ("play".equals(action)) nativePlayer.play();
            else if ("pause".equals(action)) nativePlayer.pause();
            else if ("next".equals(action)) nativePlayer.advance(1, true);
            else if ("previous".equals(action)) nativePlayer.advance(-1, true);
        } else if (!MineradioLibraryPlugin.hasHost() && ("play".equals(action) || "next".equals(action) || "previous".equals(action))) {
            JSObject stored = NativeBackgroundPlayer.stored(this);
            JSONArray queue = stored.optJSONArray("queue");
            if (queue != null && queue.length() > 0) {
                stored.put("resumePlaying", true); startNative(stored);
                if ("next".equals(action)) nativePlayer.advance(1, true);
                else if ("previous".equals(action)) nativePlayer.advance(-1, true);
            }
        } else MineradioLibraryPlugin.control(action);
    }
    private PendingIntent action(String name, int request) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(name);
        return Build.VERSION.SDK_INT >= 26
            ? PendingIntent.getForegroundService(this, request, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)
            : PendingIntent.getService(this, request, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    private Notification notification(JSONObject value) {
        boolean playing = value.optBoolean("playing", false) || value.optBoolean("preparing", false);
        PendingIntent content = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "playback") : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(value.optString("title", "Mineradio"))
            .setContentText(value.optString("artist", "")).setContentIntent(content).setOnlyAlertOnce(true).setOngoing(playing)
            .setVisibility(Notification.VISIBILITY_PUBLIC).setDeleteIntent(action("stop", 4))
            .addAction(android.R.drawable.ic_media_previous, "上一首", action("previous", 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "暂停" : "播放", action(playing ? "pause" : "play", 2))
            .addAction(android.R.drawable.ic_media_next, "下一首", action("next", 3))
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2)).build();
    }
    private JSONObject activeState() { return nativePlayer.ownsAudio() ? nativePlayer.snapshot(false) : webState; }
    private void ensureForeground() {
        if (!foreground) { startForeground(7, notification(activeState())); foreground = true; }
    }
    private void publish() {
        JSONObject value = activeState();
        boolean playing = value.optBoolean("playing", false), preparing = value.optBoolean("preparing", false);
        boolean waitingForFocus = value.optBoolean("waitingForFocus", false);
        long position = (long) (value.optDouble("position", 0) * 1000), duration = (long) (value.optDouble("duration", 0) * 1000);
        String title = value.optString("title", "Mineradio"), artist = value.optString("artist", "");
        String metadata = title + "|" + artist + "|" + duration;
        if (!metadata.equals(metadataSignature)) {
            metadataSignature = metadata;
            session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist).putLong(MediaMetadata.METADATA_KEY_DURATION, duration).build());
        }
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_STOP)
            .setState(playing ? PlaybackState.STATE_PLAYING : preparing ? PlaybackState.STATE_BUFFERING : PlaybackState.STATE_PAUSED,
                position, playing ? (float) value.optDouble("rate", 1) : 0).build());
        session.setActive(nativePlayer.ownsAudio() || playing);
        String signature = metadata + "|" + playing + "|" + preparing + "|" + nativePlayer.ownsAudio();
        if (playing || preparing || waitingForFocus) ensureForeground();
        else if (foreground) { stopForeground(false); foreground = false; }
        if (!signature.equals(notificationSignature)) {
            notificationSignature = signature;
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(7, notification(value));
        }
        if (!nativePlayer.ownsAudio() && playing && !webLock.isHeld()) webLock.acquire();
        else if ((!playing || nativePlayer.ownsAudio()) && webLock.isHeld()) webLock.release();
        diagnostic = value.toString();
    }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if (intent == null) {
            JSObject saved = NativeBackgroundPlayer.stored(this);
            if (saved.optBoolean("nativeActive", false) && saved.optBoolean("resumePlaying", false)) startNative(saved);
            else { stopSelf(); return START_NOT_STICKY; }
        } else {
            String command = intent.getAction();
            if ("bootstrap".equals(command)) ensureForeground();
            else if (command == null || "web".equals(command)) {
                if (!nativePlayer.ownsAudio()) publish();
            } else { ensureForeground(); route(command); }
        }
        return START_STICKY;
    }
    @Override public void onTaskRemoved(Intent root) {
        if (!nativePlayer.ownsAudio()) hostDestroyed(this);
        if (!nativePlayer.ownsAudio() && !webState.optBoolean("playing", false)) stopSelf();
    }
    @Override protected void dump(FileDescriptor fd, PrintWriter writer, String[] args) {
        // Notification publication is throttled. Diagnostics need the current media
        // position and the timestamp from the same snapshot, including while locked.
        String value = nativePlayer != null && nativePlayer.ownsAudio() ? nativePlayer.snapshot(false).toString() : diagnostic;
        writer.println("MINERADIO_PLAYBACK " + value);
    }
    @Override public void onDestroy() {
        instance = null; running = false;
        nativePlayer.close();
        if (webLock.isHeld()) webLock.release();
        unregisterReceiver(noisy); session.release();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
