// Native-only seam for user-defined daily reminder notifications (see
// NotificationsCard / repo/notifications.ts) — separate from lib/alarm.ts
// (the Timer's one-shot/weekly OS notifications) and lib/clockAlarm.ts (the
// full-screen ringing clock alarm) because this feature's whole point is a
// notification with tappable action buttons, which neither of those needs.
//
// Two action types cover every notification this app creates:
//  - "confirm_open_clock": بله/خیر — بله opens the device's clock app. Used
//    only by the built-in nightly "want an alarm for tomorrow?" reminder.
//  - "ok_dismiss": a single acknowledge button. Used by everything the user
//    creates themselves in the card — see NotificationsCard.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { openClockApp } from './openApp';

export type NotificationKind = 'confirm_open_clock' | 'ok';

const ACTION_TYPE_CONFIRM = 'confirm_open_clock';
const ACTION_TYPE_OK = 'ok_dismiss';

function actionTypeIdFor(kind: NotificationKind): string {
  return kind === 'confirm_open_clock' ? ACTION_TYPE_CONFIRM : ACTION_TYPE_OK;
}

// Registering action types is cheap and idempotent — safe to call every app
// start rather than tracking whether it already ran.
export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE_CONFIRM,
        actions: [
          { id: 'yes', title: 'بله' },
          { id: 'no', title: 'خیر' },
        ],
      },
      {
        id: ACTION_TYPE_OK,
        actions: [{ id: 'ok', title: 'باشه' }],
      },
    ],
  });
  await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const kind = action.notification.extra?.kind as NotificationKind | undefined;
    if (kind === 'confirm_open_clock' && action.actionId === 'yes') {
      openClockApp();
    }
  });
}

export interface DailyNotification {
  id: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  kind: NotificationKind;
}

export async function scheduleDailyNotification(n: DailyNotification): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.requestPermissions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: n.id,
        title: n.title,
        body: n.body,
        actionTypeId: actionTypeIdFor(n.kind),
        extra: { kind: n.kind },
        schedule: { on: { hour: n.hour, minute: n.minute }, allowWhileIdle: true },
      },
    ],
  });
}

export async function cancelNotification(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}
