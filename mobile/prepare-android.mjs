import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(root, '..');
const web = path.join(root, 'www');
const android = path.join(root, 'android');
const cap = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');
fs.mkdirSync(web, { recursive: true });
fs.cpSync(path.join(source, 'public'), web, { recursive: true });
for (const name of ['LICENSE', 'THIRD-PARTY-NOTICES.md', 'NOTICE.md']) {
  fs.copyFileSync(path.join(source, name), path.join(web, name));
}
if (!fs.existsSync(android)) execFileSync(process.execPath, [cap, 'add', 'android'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [cap, 'sync', 'android'], { cwd: root, stdio: 'inherit' });

const java = path.join(android, 'app/src/main/java/com/mineradio/oirge/mobile');
fs.mkdirSync(java, { recursive: true });
fs.cpSync(path.join(root, 'native'), java, { recursive: true });
const manifestPath = path.join(android, 'app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:name=".PlaybackService"')) {
manifest = manifest.replace('<application', '<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>\n<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>\n<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>\n<uses-permission android:name="android.permission.WAKE_LOCK"/>\n<application');
manifest = manifest.replace('</application>', '<service android:name=".PlaybackService" android:exported="false" android:foregroundServiceType="mediaPlayback" android:stopWithTask="true"/>\n</application>');
manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
}
fs.writeFileSync(manifestPath, manifest);

const gradlePath = path.join(android, 'app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle.replace(/versionCode \d+/, 'versionCode 10000').replace(/versionName "[^"]+"/, 'versionName "1.0.0"');
if (!gradle.includes('MOBILE_KEYSTORE_PATH')) {
gradle = gradle.replace('buildTypes {', `signingConfigs {
        release {
            def signingFile = System.getenv('MOBILE_KEYSTORE_PATH')
            if (signingFile) {
                storeFile file(signingFile)
                storePassword System.getenv('MOBILE_KEYSTORE_PASSWORD')
                keyAlias 'mineradio'
                keyPassword System.getenv('MOBILE_KEYSTORE_PASSWORD')
            }
        }
    }
    buildTypes {`);
gradle = gradle.replace('release {\n            minifyEnabled', 'release {\n            signingConfig signingConfigs.release\n            minifyEnabled');
}
fs.writeFileSync(gradlePath, gradle);
for (const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']) {
  const directory = path.join(android, 'app/src/main/res', 'mipmap-' + density);
  fs.mkdirSync(directory, { recursive: true });
  for (const file of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png']) {
    fs.copyFileSync(path.join(source, 'build/icon.png'), path.join(directory, file));
  }
}
console.log('Android sources prepared with offline assets and native music import.');
