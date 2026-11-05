package com.mineradio.oirge.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class PlaybackService extends Service {
    public static volatile boolean running;
    private MediaSession session;
    private PowerManager.WakeLock lock;
    @Override public void onCreate() {
        super.onCreate(); running = true;
        lock = ((PowerManager) getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Mineradio:Playback");
        session = new MediaSession(this, "Mineradio");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { MineradioLibraryPlugin.control("play"); }
            @Override public void onPause() { MineradioLibraryPlugin.control("pause"); }
            @Override public void onSkipToNext() { MineradioLibraryPlugin.control("next"); }
            @Override public void onSkipToPrevious() { MineradioLibraryPlugin.control("previous"); }
            @Override public void onSeekTo(long position) { MineradioLibraryPlugin.seek(position); }
        });
        if (Build.VERSION.SDK_INT >= 26) {
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(
                new NotificationChannel("playback", "音乐播放", NotificationManager.IMPORTANCE_LOW));
        }
    }
    private PendingIntent action(String name, int request) {
        return PendingIntent.getService(this, request, new Intent(this, PlaybackService.class).setAction(name), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (intent.getAction() != null) { MineradioLibraryPlugin.control(intent.getAction()); return START_NOT_STICKY; }
        boolean playing = intent.getBooleanExtra("playing", false);
        String title = intent.getStringExtra("title"), artist = intent.getStringExtra("artist");
        long position = (long) (intent.getDoubleExtra("position", 0) * 1000);
        long duration = (long) (intent.getDoubleExtra("duration", 0) * 1000);
        session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist).putLong(MediaMetadata.METADATA_KEY_DURATION, duration).build());
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SEEK_TO)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, position, playing ? 1 : 0).build());
        session.setActive(playing);
        PendingIntent content = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder notification = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, "playback") : new Notification.Builder(this);
        notification.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle(title).setContentText(artist)
            .setContentIntent(content).setOnlyAlertOnce(true).setOngoing(playing)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "上一首", action("previous", 1))
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "暂停" : "播放", action(playing ? "pause" : "play", 2))
            .addAction(android.R.drawable.ic_media_next, "下一首", action("next", 3))
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        if (playing) {
            startForeground(7, notification.build());
            if (!lock.isHeld()) lock.acquire(6 * 60 * 60 * 1000L);
        } else {
            stopForeground(false);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(7, notification.build());
            stopSelf();
        }
        return START_NOT_STICKY;
    }
    @Override public void onTaskRemoved(Intent root) { MineradioLibraryPlugin.control("pause"); stopSelf(); }
    @Override public void onDestroy() {
        running = false;
        if (lock != null && lock.isHeld()) lock.release();
        if (session != null) session.release();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
