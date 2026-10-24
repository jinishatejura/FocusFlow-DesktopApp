const { Notification } = require('electron');
const path = require('path');
const store = require('./store');

function showNotification(title, body, options = {}) {
  const settings = store.getSettings();
  if (settings.notificationsEnabled === false) {
    return;
  }

  if (!Notification.isSupported()) {
    console.warn('Native desktop notifications are not supported on this platform.');
    return;
  }

  const notification = new Notification({
    title: title || 'FocusFlow',
    body: body || '',
    silent: !settings.soundEnabled,
    urgency: options.urgency || 'normal',
    icon: options.icon || path.join(__dirname, '../renderer/assets/icon.png')
  });

  if (options.onClick) {
    notification.on('click', options.onClick);
  }

  notification.show();
  return notification;
}

function notifyFocusCompleted(taskTitle) {
  return showNotification(
    '🎉 Focus Session Completed!',
    taskTitle ? `Great job working on: "${taskTitle}"! Time to take a break.` : 'Great job! Time to take a refreshing break.'
  );
}

function notifyBreakEnded(isLongBreak = false) {
  return showNotification(
    '⏰ Break Over!',
    isLongBreak ? 'Long break completed. Ready to dive back into your next focus sprint?' : 'Short break is over. Let\'s get back in the zone!'
  );
}

function notifyTaskDueSoon(taskTitle, timeText) {
  return showNotification(
    '⏳ Task Due Soon',
    `"${taskTitle}" is due ${timeText}! Keep your focus sharp.`
  );
}

function notifyTaskOverdue(taskTitle) {
  return showNotification(
    '🚨 Task Deadline Overdue',
    `"${taskTitle}" has passed its scheduled deadline.`
  );
}

module.exports = {
  showNotification,
  notifyFocusCompleted,
  notifyBreakEnded,
  notifyTaskDueSoon,
  notifyTaskOverdue
};
