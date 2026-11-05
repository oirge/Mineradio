package com.mineradio.oirge.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "MineradioLibrary")
public class MineradioLibraryPlugin extends Plugin {
    private static WeakReference<MineradioLibraryPlugin> current = new WeakReference<>(null);
    private static final int LIMIT = 10000;
    @Override public void load() { current = new WeakReference<>(this); }
    public static void control(String action) {
        MineradioLibraryPlugin plugin = current.get();
        if (plugin != null) plugin.getActivity().runOnUiThread(() -> {
            plugin.notifyListeners(action.equals("back") ? "back" : "mediaControl", new JSObject().put("action", action));
        });
    }
    public static void seek(long milliseconds) {
        MineradioLibraryPlugin plugin = current.get();
        if (plugin != null) plugin.getActivity().runOnUiThread(() -> plugin.notifyListeners("mediaControl",
            new JSObject().put("action", "seek").put("position", milliseconds / 1000.0)));
    }
    private android.content.SharedPreferences preferences() {
        return getContext().getSharedPreferences("mineradio-library", 0);
    }
    private JSONArray saved() {
        try { return new JSONArray(preferences().getString("files", "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
    private boolean supported(String name) {
        return name != null && name.toLowerCase(java.util.Locale.ROOT).matches(".*\\.(mp3|mp2|flac|wav|ogg|oga|m4a|m4b|aac|opus|webm|weba|aif|aiff|aifc|ape|dsf|lrc|txt|srt|vtt|ass|ssa|yrc|krc|qrc|ttml|jpg|jpeg|png|webp|avif|gif|bmp|svg)$");
    }
    private JSONObject entry(Uri uri, String relative) throws Exception {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return null;
            String name = cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME));
            if (!supported(name)) return null;
            int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
            int modifiedIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
            return new JSONObject().put("name", name).put("fullPath", uri.toString())
                .put("relativePath", relative.isEmpty() ? name : relative)
                .put("size", sizeIndex < 0 || cursor.isNull(sizeIndex) ? 0 : cursor.getLong(sizeIndex))
                .put("lastModified", modifiedIndex < 0 || cursor.isNull(modifiedIndex) ? 0 : cursor.getLong(modifiedIndex));
        }
    }
    private void persistGrant(Uri uri, int flags) {
        try { getContext().getContentResolver().takePersistableUriPermission(uri, flags & Intent.FLAG_GRANT_READ_URI_PERMISSION); }
        catch (SecurityException ignored) { /* Some providers grant access only for this session. */ }
    }
    private void walk(Uri tree, String document, String directory, LinkedHashMap<String, JSONObject> files, int depth) throws Exception {
        if (depth > 24 || files.size() >= LIMIT) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, document);
        try (Cursor cursor = getContext().getContentResolver().query(children, new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED }, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext() && files.size() < LIMIT) {
                String id = cursor.getString(0), name = cursor.getString(1), mime = cursor.getString(2);
                String relative = directory.isEmpty() ? name : directory + "/" + name;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) walk(tree, id, relative, files, depth + 1);
                else if (supported(name)) {
                    Uri uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                    files.put(uri.toString(), new JSONObject().put("name", name).put("fullPath", uri.toString())
                        .put("relativePath", relative).put("size", cursor.isNull(3) ? 0 : cursor.getLong(3))
                        .put("lastModified", cursor.isNull(4) ? 0 : cursor.getLong(4)));
                }
            }
        }
    }
    private LinkedHashMap<String, JSONObject> fileMap() throws Exception {
        LinkedHashMap<String, JSONObject> files = new LinkedHashMap<>();
        JSONArray previous = saved();
        for (int i = 0; i < previous.length(); i++) {
            JSONObject value = previous.getJSONObject(i);
            files.put(value.getString("fullPath"), value);
        }
        return files;
    }
    private void finishImport(PluginCall call, LinkedHashMap<String, JSONObject> files) {
        JSONArray values = new JSONArray(files.values());
        preferences().edit().putString("files", values.toString()).apply();
        call.resolve(new JSObject().put("files", values).put("canceled", false));
    }
    @PluginMethod public void pickFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE)
            .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "filesPicked");
    }
    @ActivityCallback private void filesPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) { call.resolve(new JSObject().put("canceled", true)); return; }
        bridge.execute(() -> {
            try {
                LinkedHashMap<String, JSONObject> files = fileMap();
                int count = data.getClipData() == null ? 1 : data.getClipData().getItemCount();
                for (int i = 0; i < count && files.size() < LIMIT; i++) {
                    Uri uri = data.getClipData() == null ? data.getData() : data.getClipData().getItemAt(i).getUri();
                    if (uri == null) continue;
                    persistGrant(uri, data.getFlags());
                    JSONObject value = entry(uri, "");
                    if (value != null) files.put(uri.toString(), value);
                }
                finishImport(call, files);
            } catch (Exception error) { call.reject("无法读取选择的音乐", error); }
        });
    }
    @PluginMethod public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }
    @ActivityCallback private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) { call.resolve(new JSObject().put("canceled", true)); return; }
        bridge.execute(() -> {
            try {
                Uri tree = data.getData(); persistGrant(tree, data.getFlags());
                LinkedHashMap<String, JSONObject> files = fileMap();
                walk(tree, DocumentsContract.getTreeDocumentId(tree), "", files, 0);
                finishImport(call, files);
            } catch (Exception error) { call.reject("无法读取音乐文件夹", error); }
        });
    }
    @PluginMethod public void list(PluginCall call) {
        call.resolve(new JSObject().put("files", saved()));
    }
    @PluginMethod public void readRange(PluginCall call) {
        String value = call.getString("uri", "");
        bridge.execute(() -> {
            try {
                // Only URIs selected through SAF are readable through this bridge.
                if (!fileMap().containsKey(value)) { call.reject("未授权的音乐文件"); return; }
                // JSON offsets normally arrive as Integer; PluginCall.getLong accepts only Long.
                long start = Math.max(0, call.getData().optLong("start", 0L));
                long end = call.getData().optLong("end", 0L);
                int length = (int) Math.min(8 * 1024 * 1024, end > start ? end - start : 8 * 1024 * 1024);
                ByteArrayOutputStream bytes = new ByteArrayOutputStream(Math.min(length, 65536));
                try (InputStream input = getContext().getContentResolver().openInputStream(Uri.parse(value))) {
                    if (input == null) throw new java.io.IOException("无法打开文件");
                    long remaining = start;
                    while (remaining > 0) {
                        long skipped = input.skip(remaining);
                        if (skipped == 0) { if (input.read() == -1) break; skipped = 1; }
                        remaining -= skipped;
                    }
                    byte[] buffer = new byte[32768];
                    int read;
                    while (bytes.size() < length && (read = input.read(buffer, 0, Math.min(buffer.length, length - bytes.size()))) != -1) bytes.write(buffer, 0, read);
                }
                byte[] data = bytes.toByteArray();
                JSArray chunks = new JSArray();
                for (int offset = 0; offset < data.length; offset += 32768) chunks.put(Base64.encodeToString(data, offset, Math.min(32768, data.length - offset), Base64.NO_WRAP));
                call.resolve(new JSObject().put("ok", true).put("base64Chunks", chunks).put("byteLength", data.length));
            } catch (Exception error) { call.reject("文件读取失败", error); }
        });
    }
    @PluginMethod public void updatePlayback(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class)
            .putExtra("playing", call.getBoolean("playing", false))
            .putExtra("title", call.getString("title", "Mineradio"))
            .putExtra("artist", call.getString("artist", ""))
            .putExtra("position", call.getDouble("position", 0.0))
            .putExtra("duration", call.getDouble("duration", 0.0));
        try {
            if (call.getBoolean("playing", false) && Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
            else if (PlaybackService.running) getContext().startService(intent);
            call.resolve();
        } catch (Exception error) { call.reject("通知栏控制暂不可用", error); }
    }
    @PluginMethod public void minimize(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true)); call.resolve();
    }
}
