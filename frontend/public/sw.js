const notifiedTaskIds = new Set();

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  const payload = event.data || {};
  if (payload.type !== 'CHECK_TASKS') return;
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const task of tasks) {
    if (!task || task.status !== 'pending' || !task.due_time) continue;
    if (notifiedTaskIds.has(task.id)) continue;

    const taskDay = new Date(task.addedAt);
    const isToday =
      taskDay.getFullYear() === now.getFullYear() &&
      taskDay.getMonth() === now.getMonth() &&
      taskDay.getDate() === now.getDate();
    if (!isToday) continue;

    const [hh, mm] = String(task.due_time).split(':');
    const dueMinutes = Number(hh) * 60 + Number(mm);
    if (Number.isNaN(dueMinutes)) continue;
    if (nowMinutes < dueMinutes) continue;

    notifiedTaskIds.add(task.id);
    await self.registration.showNotification('Kar De ⚡', {
      body: task.title || task.raw || 'Task reminder',
      icon: '/favicon.svg'
    });
  }
});
