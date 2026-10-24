const { ipcMain, dialog, shell, app } = require('electron');
const fs = require('fs');
const store = require('./store');
const notifications = require('./notifications');
const { getMainWindow, getWidgetWindow, toggleWidgetWindow } = require('./windows');

function registerIpcHandlers(trayController) {
  // --- Tasks IPC ---
  ipcMain.handle('tasks:get', async () => {
    return store.getTasks();
  });

  ipcMain.handle('tasks:add', async (_event, taskData) => {
    const task = store.addTask(taskData);
    // Broadcast change to both windows
    broadcast('tasks:updated', store.getTasks());
    return task;
  });

  ipcMain.handle('tasks:update', async (_event, { id, updates }) => {
    const task = store.updateTask(id, updates);
    broadcast('tasks:updated', store.getTasks());
    return task;
  });

  ipcMain.handle('tasks:delete', async (_event, taskId) => {
    const success = store.deleteTask(taskId);
    broadcast('tasks:updated', store.getTasks());
    return success;
  });

  ipcMain.handle('tasks:incrementPomodoro', async (_event, taskId) => {
    const task = store.incrementPomodoro(taskId);
    broadcast('tasks:updated', store.getTasks());
    return task;
  });

  // --- Sessions & Analytics IPC ---
  ipcMain.handle('sessions:get', async () => {
    return store.getSessions();
  });

  ipcMain.handle('sessions:log', async (_event, sessionData) => {
    const session = store.logSession(sessionData);
    broadcast('sessions:updated', store.getSessions());
    return session;
  });

  // --- Settings IPC ---
  ipcMain.handle('settings:get', async () => {
    return store.getSettings();
  });

  ipcMain.handle('settings:save', async (_event, newSettings) => {
    const updated = store.saveSettings(newSettings);
    broadcast('settings:updated', updated);
    return updated;
  });

  // --- Notifications IPC ---
  ipcMain.handle('notifications:show', async (_event, { title, body }) => {
    return notifications.showNotification(title, body);
  });

  ipcMain.handle('notifications:focusComplete', async (_event, taskTitle) => {
    return notifications.notifyFocusCompleted(taskTitle);
  });

  ipcMain.handle('notifications:breakEnd', async (_event, isLongBreak) => {
    return notifications.notifyBreakEnded(isLongBreak);
  });

  // --- Timer Sync IPC ---
  ipcMain.on('timer:syncState', (_event, timerState) => {
    // 1. Update Tray
    if (trayController) {
      trayController.updateState(timerState);
    }

    // 2. Forward to Widget Window if open
    const widgetWin = getWidgetWindow();
    if (widgetWin && !widgetWin.isDestroyed() && _event.sender !== widgetWin.webContents) {
      widgetWin.webContents.send('timer:stateUpdate', timerState);
    }

    // 3. Forward to Main Window if originated from Widget
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed() && _event.sender !== mainWin.webContents) {
      mainWin.webContents.send('timer:stateUpdate', timerState);
    }
  });

  // Action from widget (e.g., play/pause clicked in widget)
  ipcMain.on('timer:action', (_event, action) => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('timer:executeAction', action);
    }
  });

  // --- Windows & UI Control IPC ---
  ipcMain.handle('window:toggleWidget', async () => {
    return toggleWidgetWindow();
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    if (win) win.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    if (win) win.close();
  });

  // --- Desktop Native Dialogs & Shell IPC ---
  ipcMain.handle('dialog:exportBackup', async (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'Export FocusFlow Data Backup',
      defaultPath: `focusflow-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [
        { name: 'JSON Backup (*.json)', extensions: ['json'] },
        { name: 'CSV Tasks (*.csv)', extensions: ['csv'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePath;
    if (filePath.endsWith('.csv')) {
      // Export tasks as CSV
      const tasks = store.getTasks();
      const headers = ['ID', 'Title', 'Description', 'Priority', 'Category', 'Status', 'EstimatedPomodoros', 'CompletedPomodoros', 'DueDate', 'CreatedAt'];
      const rows = tasks.map(t => [
        `"${t.id}"`,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${t.priority}"`,
        `"${t.category}"`,
        `"${t.status}"`,
        t.estimatedPomodoros,
        t.completedPomodoros,
        `"${t.dueDate}"`,
        `"${t.createdAt}"`
      ].join(','));
      const csvContent = [headers.join(','), ...rows].join('\n');
      fs.writeFileSync(filePath, csvContent, 'utf-8');
    } else {
      // Export complete JSON
      const fullData = store.getAllData();
      fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), 'utf-8');
    }

    return { success: true, filePath };
  });

  ipcMain.handle('dialog:importBackup', async (event) => {
    const win = event.sender.getOwnerBrowserWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Import FocusFlow Backup',
      filters: [{ name: 'JSON Backup (*.json)', extensions: ['json'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const parsed = JSON.parse(raw);
      store.restoreAllData(parsed);
      broadcast('tasks:updated', store.getTasks());
      broadcast('sessions:updated', store.getSessions());
      broadcast('settings:updated', store.getSettings());
      return { success: true, count: parsed.tasks?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('shell:openDataFolder', async () => {
    const dataPath = store.userDataPath;
    shell.showItemInFolder(dataPath);
    return true;
  });

  ipcMain.handle('shell:beep', async () => {
    shell.beep();
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    shell.openExternal(url);
    return true;
  });

  ipcMain.handle('system:getInfo', async () => {
    return {
      appName: 'FocusFlow',
      version: '1.0.0',
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      userDataPath: store.userDataPath
    };
  });
}

function broadcast(channel, data) {
  const mainWin = getMainWindow();
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data);
  }
  const widgetWin = getWidgetWindow();
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.webContents.send(channel, data);
  }
}

module.exports = {
  registerIpcHandlers
};
