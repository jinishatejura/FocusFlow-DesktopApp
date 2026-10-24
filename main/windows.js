const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const store = require('./store');

let mainWindow = null;
let widgetWindow = null;
let isQuitting = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset', // Native macOS traffic lights with sleek custom header
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    const settings = store.getSettings();
    if (!isQuitting && settings.minimizeToTrayOnClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function createWidgetWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  widgetWindow = new BrowserWindow({
    width: 330,
    height: 96,
    x: width - 360,
    y: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  widgetWindow.loadFile(path.join(__dirname, '../renderer/widget.html'));

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });

  return widgetWindow;
}

function toggleWidgetWindow() {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow();
    widgetWindow.once('ready-to-show', () => {
      widgetWindow.show();
    });
    return true;
  }

  if (widgetWindow.isVisible()) {
    widgetWindow.hide();
    return false;
  } else {
    widgetWindow.show();
    return true;
  }
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.focus();
    }
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function getMainWindow() {
  return mainWindow;
}

function getWidgetWindow() {
  return widgetWindow;
}

function setQuitting(val) {
  isQuitting = val;
}

module.exports = {
  createMainWindow,
  createWidgetWindow,
  toggleMainWindow,
  toggleWidgetWindow,
  getMainWindow,
  getWidgetWindow,
  setQuitting
};
