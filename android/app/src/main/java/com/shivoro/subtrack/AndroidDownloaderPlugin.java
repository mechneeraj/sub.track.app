package com.shivoro.subtrack;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "AndroidDownloader")
public class AndroidDownloaderPlugin extends Plugin {

    @PluginMethod
    public void downloadToPublicFolder(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        if (fileName == null || base64Data == null) {
            call.reject("File name and base64 data are required");
            return;
        }

        try {
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Context context = getContext();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+): MediaStore.Downloads (No extra permissions needed)
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
                if (uri == null) {
                    call.reject("Could not create entry in Downloads");
                    return;
                }

                try (OutputStream outputStream = context.getContentResolver().openOutputStream(uri)) {
                    if (outputStream == null) {
                        call.reject("Could not open stream for writing");
                        return;
                    }
                    outputStream.write(fileBytes);
                    outputStream.flush();
                }

                contentValues.clear();
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                context.getContentResolver().update(uri, contentValues, null, null);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("path", uri.toString());
                ret.put("message", "File saved to Downloads folder");
                call.resolve(ret);
            } else {
                // Pre-Android 10: Environment.DIRECTORY_DOWNLOADS
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File file = new File(downloadsDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("path", file.getAbsolutePath());
                ret.put("message", "File saved to Downloads folder");
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Error saving file: " + e.getMessage(), e);
        }
    }
}
