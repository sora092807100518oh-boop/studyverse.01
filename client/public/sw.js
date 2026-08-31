self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'StudyVerse', body: event.data?.text() || '' }; }
  const title = data.title || 'StudyVerse';
  const options = {
    body: data.body || '今日の単語を確認しましょう。',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'studyverse-smart-notification',
    renotify: true,
    data,
    actions: [{ action: 'show-answer', title: '答えを見る' }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === 'show-answer') {
    event.waitUntil(self.registration.showNotification('答え', { body: data.answer || '答えを確認できませんでした。', tag: `${data.tag || 'smart'}-answer`, data }));
    return;
  }
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const url = new URL('/', self.location.origin);
    url.searchParams.set('smartAnswer', data.answer || '');
    for (const client of list) if ('focus' in client) return client.focus();
    return clients.openWindow(url.toString());
  }));
});
