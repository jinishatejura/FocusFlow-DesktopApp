const store = require('./store');
const { notifyTaskDueSoon, notifyTaskOverdue } = require('./notifications');

let intervalId = null;

function parseDeadline(dueDate, dueTime) {
  if (!dueDate) return null;
  const timePart = dueTime && dueTime.includes(':') ? dueTime : '23:59';
  const isoStr = `${dueDate}T${timePart}:00`;
  const dateObj = new Date(isoStr);
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

function formatTimeRemaining(diffMs) {
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes <= 1) return 'in under a minute';
  if (totalMinutes < 60) return `in ${totalMinutes} minutes`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  if (remainingMins === 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  return `in ${hours}h ${remainingMins}m`;
}

function checkTaskDeadlines(onTasksChanged) {
  const settings = store.getSettings();
  if (settings.notificationsEnabled === false) {
    return;
  }

  const tasks = store.getTasks();
  const now = Date.now();
  let updatedAny = false;

  tasks.forEach(task => {
    if (task.status === 'done' || !task.dueDate) return;

    const deadline = parseDeadline(task.dueDate, task.dueTime);
    if (!deadline) return;

    const deadlineMs = deadline.getTime();
    const diffMs = deadlineMs - now;
    const reminderThresholdMs = (task.reminderMinutes || 60) * 60 * 1000;

    // 1. Approaching deadline alert
    if (diffMs > 0 && diffMs <= reminderThresholdMs && !task.notifiedDueSoon) {
      const timeText = formatTimeRemaining(diffMs);
      notifyTaskDueSoon(task.title, timeText);
      task.notifiedDueSoon = true;
      updatedAny = true;
      console.log(`[Reminder Service] Fired due soon alert for "${task.title}" (${timeText})`);
    }
    // 2. Overdue alert
    else if (diffMs < 0 && !task.notifiedOverdue) {
      notifyTaskOverdue(task.title);
      task.notifiedOverdue = true;
      updatedAny = true;
      console.log(`[Reminder Service] Fired overdue alert for "${task.title}"`);
    }
  });

  if (updatedAny) {
    store.saveTasks(tasks);
    if (onTasksChanged) onTasksChanged(tasks);
  }
}

function startReminderService(onTasksChanged) {
  stopReminderService();
  // Check immediately on startup
  checkTaskDeadlines(onTasksChanged);
  // Check every 30 seconds
  intervalId = setInterval(() => {
    checkTaskDeadlines(onTasksChanged);
  }, 30000);
  console.log('[Reminder Service] Task reminder & deadline watcher started.');
}

function stopReminderService() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  startReminderService,
  stopReminderService,
  checkTaskDeadlines
};
