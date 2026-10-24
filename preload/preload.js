const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusFlowAPI', {
  // Tasks
  tasks: {
    get: () => ipcRenderer.invoke('tasks:get'),
    add: (taskData) => ipcRenderer.invoke('tasks:add', taskData),
    update: (id, updates) => ipcRenderer.invoke('tasks:update', { id, updates }),
    delete: (id) => ipcRenderer.invoke('tasks:delete', id),
    incrementPomodoro: (id) => ipcRenderer.invoke('tasks:incrementPomodoro', id),
    onUpdated: (callback) => {
      const handler = (_event, tasks) => callback(tasks);
      ipcRenderer.on('tasks:updated', handler);
      return () => ipcRenderer.removeListener('tasks:updated', handler);
    }
  },

  // Sessions & Analytics
  sessions: {
    get: () => ipcRenderer.invoke('sessions:get'),
    log: (sessionData) => ipcRenderer.invoke('sessions:log', sessionData),
    onUpdated: (callback) => {
      const handler = (_event, sessions) => callback(sessions);
      ipcRenderer.on('sessions:updated', handler);
      return () => ipcRenderer.removeListener('sessions:updated', handler);
    }
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (newSettings) => ipcRenderer.invoke('settings:save', newSettings),
    onUpdated: (callback) => {
      const handler = (_event, settings) => callback(settings);
      ipcRenderer.on('settings:updated', handler);
      return () => ipcRenderer.removeListener('settings:updated', handler);
    }
  },

  // Timer IPC
  timer: {
    syncState: (state) => ipcRenderer.send('timer:syncState', state),
    sendAction: (action) => ipcRenderer.send('timer:action', action),
    onExecuteAction: (callback) => {
      const handler = (_event, action) => callback(action);
      ipcRenderer.on('timer:executeAction', handler);
      return () => ipcRenderer.removeListener('timer:executeAction', handler);
    },
    onStateUpdate: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on('timer:stateUpdate', handler);
      return () => ipcRenderer.removeListener('timer:stateUpdate', handler);
    }
  },

  // Window Controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleWidget: () => ipcRenderer.invoke('window:toggleWidget')
  },

  // Desktop Notifications
  notifications: {
    show: (title, body) => ipcRenderer.invoke('notifications:show', { title, body }),
    focusComplete: (taskTitle) => ipcRenderer.invoke('notifications:focusComplete', taskTitle),
    breakEnd: (isLongBreak) => ipcRenderer.invoke('notifications:breakEnd', isLongBreak)
  },

  // Native File Dialogs (Local backup & restore)
  dialog: {
    exportBackup: () => ipcRenderer.invoke('dialog:exportBackup'),
    importBackup: () => ipcRenderer.invoke('dialog:importBackup')
  },

  // Shell & System
  shell: {
    openDataFolder: () => ipcRenderer.invoke('shell:openDataFolder'),
    beep: () => ipcRenderer.invoke('shell:beep'),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },

  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo')
  },

  // Shortcuts & Global Triggers
  shortcuts: {
    onQuickAdd: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('action:openQuickAdd', handler);
      return () => ipcRenderer.removeListener('action:openQuickAdd', handler);
    }
  }
});
