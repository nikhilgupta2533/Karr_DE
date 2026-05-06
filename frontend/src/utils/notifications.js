export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function sendAppNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    } catch {
      // Fallback to window Notification API below.
    }
  }

  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
