// Exporting a text file, kept behind the same kind of seam as lib/alarm.ts.
//
// On the web, a Blob + <a download> just works. Inside a Capacitor WebView on
// Android there's no real "Downloads" UX for that — the file has to be
// written via @capacitor/filesystem and then handed to the OS share sheet
// (@capacitor/share) so the user can save it wherever they want (Drive,
// Telegram, Files app, ...).

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

async function exportWeb(filename: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportNative(filename: string, content: string): Promise<void> {
  const written = await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ url: written.uri });
}

export async function exportTextFile(filename: string, content: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await exportNative(filename, content);
  } else {
    await exportWeb(filename, content);
  }
}
