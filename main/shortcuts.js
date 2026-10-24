const { globalShortcut } = require('electron');

let registeredShortcuts = [];

function registerGlobalShortcuts({ onToggleTimer, onToggleWidget, onQuickAdd }) {
  // Clear any existing shortcuts
  unregisterGlobalShortcuts();

  // Shortcut 1: Toggle Focus Timer (Play/Pause)
  const timerShortcut = 'CommandOrControl+Alt+F';
  if (globalShortcut.register(timerShortcut, () => {
    if (onToggleTimer) onToggleTimer();
  })) {
    registeredShortcuts.push(timerShortcut);
  }

  // Shortcut 2: Toggle Mini Floating Widget
  const widgetShortcut = 'CommandOrControl+Alt+W';
  if (globalShortcut.register(widgetShortcut, () => {
    if (onToggleWidget) onToggleWidget();
  })) {
    registeredShortcuts.push(widgetShortcut);
  }

  // Shortcut 3: Bring window forward and open Quick Add modal
  const addShortcut = 'CommandOrControl+Alt+N';
  if (globalShortcut.register(addShortcut, () => {
    if (onQuickAdd) onQuickAdd();
  })) {
    registeredShortcuts.push(addShortcut);
  }

  console.log('Registered global shortcuts:', registeredShortcuts);
}

function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
  registeredShortcuts = [];
}

module.exports = {
  registerGlobalShortcuts,
  unregisterGlobalShortcuts
};
