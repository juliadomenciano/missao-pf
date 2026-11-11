import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();
const NOTIF_ID = 1;
let webTimer = null;
let ready = false;

export async function setupNative(onBack) {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0e1117' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {}
  try {
    await LocalNotifications.createChannel({ id: 'pomodoro', name: 'Pomodoro', description: 'Fim das etapas do pomodoro', importance: 5, vibration: true, visibility: 1 });
  } catch (e) {}
  App.addListener('backButton', () => onBack(() => App.exitApp()));
}

export async function askPermission() {
  if (ready) return;
  ready = true;
  try {
    if (isNative) {
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') await LocalNotifications.requestPermissions();
    } else if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (e) {}
}

export async function scheduleAlert(at, title, body) {
  await cancelAlert();
  if (at <= Date.now()) return;
  if (isNative) {
    try {
      await LocalNotifications.schedule({ notifications: [{ id: NOTIF_ID, title, body, channelId: 'pomodoro', schedule: { at: new Date(at), allowWhileIdle: true } }] });
    } catch (e) { console.warn('notif', e); }
  } else {
    webTimer = setTimeout(() => {
      try {
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'icons/icon-192.png' });
      } catch (e) {}
    }, at - Date.now());
  }
}

export async function cancelAlert() {
  clearTimeout(webTimer);
  if (isNative) {
    try { await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }); } catch (e) {}
  }
}
