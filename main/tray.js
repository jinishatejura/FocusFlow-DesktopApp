const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;
let currentTimerState = {
  isRunning: false,
  mode: 'focus',
  timeText: '25:00',
  taskTitle: 'No active task'
};

function createTrayIcon() {
  // Use a fallback transparent or 16x16 icon, or generate an icon
  const iconPath = path.join(__dirname, '../renderer/assets/tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    // 16x16 1-bit monochrome data URI icon fallback
    const fallbackSvg = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" stroke="black" stroke-width="2"/>
        <path d="M8 4V8L11 10" stroke="black" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `;
    icon = nativeImage.createFromBuffer(Buffer.from(fallbackSvg));
  }
  
  // On macOS, setTemplateImage allows the icon to adapt to Light/Dark menu bar
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

function initTray({ onToggleWindow, onToggleTimer, onToggleWidget, onQuickAdd, onQuit }) {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('FocusFlow - Task Manager & Focus Timer');

  function updateMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Status: ${currentTimerState.isRunning ? 'Active' : 'Paused'} (${currentTimerState.timeText})`,
        enabled: false
      },
      {
        label: `Task: ${currentTimerState.taskTitle.length > 25 ? currentTimerState.taskTitle.substring(0, 22) + '...' : currentTimerState.taskTitle}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: currentTimerState.isRunning ? '⏸ Pause Timer' : '▶ Resume Timer',
        click: () => {
          if (onToggleTimer) onToggleTimer();
        }
      },
      {
        label: '📌 Toggle Mini Floating HUD',
        click: () => {
          if (onToggleWidget) onToggleWidget();
        }
      },
      {
        label: '➕ Quick Add Task (Cmd+Alt+N)',
        click: () => {
          if (onQuickAdd) onQuickAdd();
        }
      },
      { type: 'separator' },
      {
        label: '🖥 Show FocusFlow Dashboard',
        click: () => {
          if (onToggleWindow) onToggleWindow();
        }
      },
      {
        label: 'Quit FocusFlow',
        click: () => {
          if (onQuit) onQuit();
          else app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  tray.on('click', () => {
    if (onToggleWindow) onToggleWindow();
  });

  updateMenu();

  return {
    updateState: (state) => {
      currentTimerState = { ...currentTimerState, ...state };
      tray.setToolTip(`FocusFlow: ${currentTimerState.timeText} [${currentTimerState.mode.toUpperCase()}]`);
      if (process.platform === 'darwin') {
        tray.setTitle(` ${currentTimerState.timeText}`);
      }
      updateMenu();
    },
    destroy: () => {
      if (tray) tray.destroy();
    }
  };
}

module.exports = {
  initTray
};
