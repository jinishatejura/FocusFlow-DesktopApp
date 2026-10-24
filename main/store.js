const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function calculateNextDueDate(currentDueDateStr, repeatPattern) {
  let baseDate = currentDueDateStr ? new Date(currentDueDateStr + 'T00:00:00') : new Date();
  if (isNaN(baseDate.getTime())) baseDate = new Date();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (baseDate < today) {
    baseDate = today;
  }

  const nextDate = new Date(baseDate);

  if (repeatPattern === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (repeatPattern === 'weekdays') {
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
  } else if (repeatPattern === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  }

  return nextDate.toISOString().split('T')[0];
}

class DataStore {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), '.data');
    this.tasksFile = path.join(this.userDataPath, 'focusflow_tasks.json');
    this.sessionsFile = path.join(this.userDataPath, 'focusflow_sessions.json');
    this.settingsFile = path.join(this.userDataPath, 'focusflow_settings.json');
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
  }

  readJson(filePath, defaultValue) {
    try {
      if (!fs.existsSync(filePath)) {
        this.writeJson(filePath, defaultValue);
        return defaultValue;
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err);
      return defaultValue;
    }
  }

  writeJson(filePath, data) {
    try {
      this.ensureDir();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error(`Error writing ${filePath}:`, err);
      return false;
    }
  }

  // --- Task Operations ---
  getTasks() {
    const defaultTasks = [
      {
        id: 'task-1',
        title: 'Daily Code Standup & Routine Review',
        description: 'Review pending pull requests, tickets, and priorities for the day.',
        priority: 'high',
        category: 'Project',
        status: 'todo',
        estimatedPomodoros: 1,
        completedPomodoros: 0,
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '10:00',
        repeat: 'weekdays',
        reminderMinutes: 30,
        notifiedDueSoon: false,
        notifiedOverdue: false,
        routineStreak: 3,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task-2',
        title: 'Weekly Systems & Project Backup',
        description: 'Run full data backup export and verify archives.',
        priority: 'medium',
        category: 'DevOps',
        status: 'todo',
        estimatedPomodoros: 2,
        completedPomodoros: 0,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        dueTime: '18:00',
        repeat: 'weekly',
        reminderMinutes: 60,
        notifiedDueSoon: false,
        notifiedOverdue: false,
        routineStreak: 1,
        createdAt: new Date().toISOString()
      },
      {
        id: 'task-3',
        title: 'Desktop Application Presentation',
        description: 'Review IPC architecture, notifications, reminders, and multi-window design.',
        priority: 'urgent',
        category: 'Study',
        status: 'in-progress',
        estimatedPomodoros: 3,
        completedPomodoros: 1,
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        dueTime: '15:00',
        repeat: 'none',
        reminderMinutes: 120,
        notifiedDueSoon: false,
        notifiedOverdue: false,
        routineStreak: 0,
        createdAt: new Date().toISOString()
      }
    ];
    return this.readJson(this.tasksFile, defaultTasks);
  }

  saveTasks(tasks) {
    return this.writeJson(this.tasksFile, tasks);
  }

  addTask(taskData) {
    const tasks = this.getTasks();
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      priority: taskData.priority || 'medium', // low, medium, high, urgent
      category: taskData.category || 'General',
      status: taskData.status || 'todo', // todo, in-progress, done
      estimatedPomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1,
      completedPomodoros: 0,
      dueDate: taskData.dueDate || '',
      dueTime: taskData.dueTime || '',
      repeat: taskData.repeat || 'none', // none, daily, weekdays, weekly
      reminderMinutes: parseInt(taskData.reminderMinutes, 10) || 60,
      notifiedDueSoon: false,
      notifiedOverdue: false,
      routineStreak: 0,
      createdAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);
    return newTask;
  }

  updateTask(taskId, updates) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    let updatedTask = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };

    // If task was marked 'done' and has a recurring repeat schedule:
    if (updates.status === 'done' && updatedTask.repeat && updatedTask.repeat !== 'none') {
      const nextDue = calculateNextDueDate(updatedTask.dueDate, updatedTask.repeat);
      updatedTask = {
        ...updatedTask,
        status: 'todo',
        dueDate: nextDue,
        completedPomodoros: 0,
        notifiedDueSoon: false,
        notifiedOverdue: false,
        lastCompletedAt: new Date().toISOString(),
        routineStreak: (updatedTask.routineStreak || 0) + 1,
        isRecurringAdvancement: true
      };
    }

    // Reset notification flags if user updated the deadline
    if (updates.dueDate !== undefined || updates.dueTime !== undefined) {
      updatedTask.notifiedDueSoon = false;
      updatedTask.notifiedOverdue = false;
    }

    tasks[index] = updatedTask;
    this.saveTasks(tasks);
    return updatedTask;
  }

  deleteTask(taskId) {
    let tasks = this.getTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    this.saveTasks(tasks);
    return true;
  }

  incrementPomodoro(taskId) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completedPomodoros = (task.completedPomodoros || 0) + 1;
      if (task.status === 'todo') {
        task.status = 'in-progress';
      }
      this.saveTasks(tasks);
      return task;
    }
    return null;
  }

  // --- Focus Sessions / Analytics ---
  getSessions() {
    return this.readJson(this.sessionsFile, []);
  }

  logSession(session) {
    const sessions = this.getSessions();
    const newSession = {
      id: 'session_' + Date.now(),
      taskId: session.taskId || null,
      taskTitle: session.taskTitle || 'Free Focus',
      durationMinutes: session.durationMinutes || 25,
      type: session.type || 'focus', // 'focus', 'shortBreak', 'longBreak'
      completedAt: new Date().toISOString()
    };
    sessions.unshift(newSession);
    this.writeJson(this.sessionsFile, sessions);
    return newSession;
  }

  // --- Settings ---
  getSettings() {
    const defaultSettings = {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      autoStartBreaks: false,
      notificationsEnabled: true,
      soundEnabled: true,
      theme: 'dark',
      minimizeToTrayOnClose: true,
      launchAtStartup: false
    };
    return this.readJson(this.settingsFile, defaultSettings);
  }

  saveSettings(newSettings) {
    const current = this.getSettings();
    const merged = { ...current, ...newSettings };
    this.writeJson(this.settingsFile, merged);
    return merged;
  }

  // --- Backup / Export ---
  getAllData() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      tasks: this.getTasks(),
      sessions: this.getSessions(),
      settings: this.getSettings()
    };
  }

  restoreAllData(data) {
    if (!data || !data.tasks) {
      throw new Error('Invalid backup file format');
    }
    this.saveTasks(data.tasks);
    if (data.sessions) this.writeJson(this.sessionsFile, data.sessions);
    if (data.settings) this.saveSettings(data.settings);
    return true;
  }
}

module.exports = new DataStore();
