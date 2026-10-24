const { app, BrowserWindow, powerMonitor } = require('electron');
const path = require('path');
const { createMainWindow, createWidgetWindow, toggleMainWindow, toggleWidgetWindow, getMainWindow, setQuitting } = require('./windows');
const { initTray } = require('./tray');
const { registerGlobalShortcuts, unregisterGlobalShortcuts } = require('./shortcuts');
const { registerIpcHandlers } = require('./ipcHandlers');
const { startReminderService, stopReminderService } = require('./reminders');

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let trayController = null;

  app.on('second-instance', () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });

  app.whenReady().then(() => {
    // 1. Initialize Main Window
    const mainWin = createMainWindow();

    // 2. Initialize System Tray
    trayController = initTray({
      onToggleWindow: toggleMainWindow,
      onToggleTimer: () => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('timer:executeAction', 'toggle');
        }
      },
      onToggleWidget: toggleWidgetWindow,
      onQuickAdd: () => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.show();
          mainWin.focus();
          mainWin.webContents.send('action:openQuickAdd');
        }
      },
      onQuit: () => {
        setQuitting(true);
        app.quit();
      }
    });

    // 3. Register IPC Handlers
    registerIpcHandlers(trayController);

    // 4. Register Global Keyboard Shortcuts
    registerGlobalShortcuts({
      onToggleTimer: () => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('timer:executeAction', 'toggle');
        }
      },
      onToggleWidget: () => {
        toggleWidgetWindow();
      },
      onQuickAdd: () => {
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.show();
          mainWin.focus();
          mainWin.webContents.send('action:openQuickAdd');
        }
      }
    });

    // 5. System-Level Interaction: Power Monitor
    // If computer suspends / locks, auto-pause active focus timer to prevent lost focus accuracy
    powerMonitor.on('suspend', () => {
      console.log('System is suspending: auto-pausing focus timer.');
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('timer:executeAction', 'pause');
      }
    });

    powerMonitor.on('lock-screen', () => {
      console.log('Screen locked: auto-pausing focus timer.');
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('timer:executeAction', 'pause');
      }
    });

    // 6. System-Level Interaction: Task Reminders & Deadline Alerts
    startReminderService((updatedTasks) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('tasks:updated', updatedTasks);
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      }
    });
  });

  app.on('before-quit', () => {
    setQuitting(true);
  });

  app.on('will-quit', () => {
    unregisterGlobalShortcuts();
    stopReminderService();
    if (trayController) {
      trayController.destroy();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
