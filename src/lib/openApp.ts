// Native-only seam for launching another app on the device — currently just
// the system clock/alarm app, from the "بله" button on the nightly alarm-
// reminder notification. See android/app/.../OpenAppPlugin.kt.
import { Capacitor, registerPlugin } from '@capacitor/core';

interface OpenAppNativePlugin {
  openClock(): Promise<void>;
}

const OpenApp = registerPlugin<OpenAppNativePlugin>('OpenApp');

export async function openClockApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await OpenApp.openClock();
}
