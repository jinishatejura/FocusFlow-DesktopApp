# FocusFlow ⏱️⚡
> **Pro Desktop Task Manager, Pomodoro Focus Hub & System Companion**  
> *Built with Electron, focusing on Desktop APIs, Multi-Window Architecture, Inter-Process Communication (IPC), and System-Level Interactions.*

---

## 🌟 Features Overview

### 1. 📋 Task Management (Kanban Board & List Views)
- **Kanban Board**: Drag & organize tasks across **To Do**, **In Progress**, and **Completed** columns.
- **List View**: Dense, table-oriented view with quick check-off actions.
- **Rich Task Metadata**: Categorization (`Project`, `Study`, `DevOps`, `General`), Priorities (`Urgent`, `High`, `Medium`, `Low`), estimated vs. completed Pomodoros, and due dates.
- **Direct Focus Action**: Click **"Focus"** on any task to immediately lock the countdown timer onto that task and track time against it.
- **Live Search & Filter**: Filter in real-time by keyword, priority, and category.

### 2. ⏱️ Pomodoro Focus Timer
- **Work & Rest Intervals**: 25 min Focus sprints, 5 min Short Breaks, 15 min Long Breaks (durations customizable in Settings).
- **Smooth SVG Circular Gauge**: Real-time animated SVG stroke with gradient cues for focus vs. breaks.
- **Audio Feedback**: Melodic chime on completion generated via the Web Audio API with native OS beep fallback.
- **Auto-Logging**: Finished cycles automatically log duration and task associations into productivity analytics.

### 3. 🪟 Multi-Window Architecture
- **Main Dashboard Window**: Sleek glassmorphism dark mode UI (`titleBarStyle: 'hiddenInset'`), responsive tab navigation, and custom controls.
- **Floating Mini-HUD Widget**:
  - Transparent, frameless, draggable pill widget.
  - Set to `alwaysOnTop: true` and `skipTaskbar: true`.
  - Stays pinned over IDEs, code editors, or browser windows while working.
  - Real-time countdown clock, active task title, play/pause toggle, and quick expand button.

### 4. ⚡ System-Level Interactions & Desktop APIs
- **Native Desktop Notifications**:
  - Triggers native OS notifications when focus sprints finish or breaks end using Electron's `Notification` API.
  - Test button in Settings to verify notifications on your machine.
- **System Tray Integration**:
  - Persistent tray icon in the macOS menu bar / Windows system tray.
  - Dynamic status tooltip (e.g. `FocusFlow: 23:45 [FOCUS]`).
  - Interactive Tray Menu: Start/Pause timer, toggle Mini-HUD, Quick Add Task, show/hide dashboard.
  - Left-click tray icon toggles dashboard visibility.
- **Global Keyboard Shortcuts (`globalShortcut`)**:
  - Registered globally across the entire operating system:
    - `CommandOrControl+Alt+F`: Toggle Timer (Play / Pause from any app)
    - `CommandOrControl+Alt+W`: Toggle Floating Mini-HUD Widget
    - `CommandOrControl+Alt+N`: Bring app forward & open Quick Add Task modal
- **Power Monitor (`powerMonitor`)**:
  - Auto-pauses active focus timers when your computer goes to sleep or screen locks, preserving focus analytics accuracy.
- **Native File Dialogs & Shell (`dialog` & `shell`)**:
  - `dialog.showSaveDialog`: Export full data backups in JSON or CSV format.
  - `dialog.showOpenDialog`: Import and restore backups safely.
  - `shell.showItemInFolder`: One-click button to reveal local user storage in macOS Finder / Windows Explorer.

### 5. 💾 Local Data Persistence
- Stored as structured JSON files in the operating system's standard user data folder (`app.getPath('userData')`).
- Completely offline, private, and durable across app launches.

---

## 🏗️ Architecture & Security Model

```
focusflow/
├── main/                       # Electron Main Process (Node.js runtime)
│   ├── main.js                 # App lifecycle, single instance lock, power monitor
│   ├── windows.js              # Main & Mini-HUD window management
│   ├── tray.js                 # System Tray icon & context menu
│   ├── shortcuts.js            # Global OS hotkey registration
│   ├── store.js                # Local filesystem JSON storage (userData)
│   ├── notifications.js        # Native OS desktop notification dispatch
│   └── ipcHandlers.js          # Bidirectional IPC controller
├── preload/
│   └── preload.js              # Secure ContextBridge exposing window.focusFlowAPI
├── renderer/                   # Electron Renderer Process (Sandboxed UI)
│   ├── index.html              # Main dashboard view
│   ├── css/style.css           # Glassmorphism dark theme styling
│   ├── js/
│   │   ├── app.js              # Application state, task CRUD & view router
│   │   ├── timer.js            # Focus state machine & audio synthesis
│   │   └── analytics.js        # Productivity insights & streak metrics
│   ├── widget.html             # Mini-HUD Floating Window
│   ├── widget.css
│   ├── widget.js
│   └── assets/                 # App and Tray icons
└── package.json
```

### IPC Security Standards
FocusFlow strictly follows Electron security recommendations:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false` (preload with controlled bridge)
- All main process capabilities are exposed exclusively through `contextBridge.exposeInMainWorld('focusFlowAPI', {...})`.

### IPC Channels Reference

| Channel | Method | Description |
|---|---|---|
| `tasks:get` | `ipcRenderer.invoke` | Fetch all tasks from local storage |
| `tasks:add` | `ipcRenderer.invoke` | Add new task and broadcast to windows |
| `tasks:update` | `ipcRenderer.invoke` | Update task fields (status, priority, etc.) |
| `tasks:delete` | `ipcRenderer.invoke` | Remove task by ID |
| `tasks:incrementPomodoro`| `ipcRenderer.invoke` | Increment pomodoro counter on active task |
| `sessions:get` / `log` | `ipcRenderer.invoke` | Store and retrieve completed focus sessions |
| `settings:get` / `save`| `ipcRenderer.invoke` | Retrieve / update user settings |
| `timer:syncState` | `ipcRenderer.send` | Sync timer state across Main, Tray & Mini-HUD |
| `timer:action` | `ipcRenderer.send` | Relay play/pause action from Mini-HUD to Main |
| `window:toggleWidget` | `ipcRenderer.invoke` | Show/hide floating always-on-top HUD |
| `dialog:exportBackup` | `ipcRenderer.invoke` | Native file save dialog for JSON/CSV backup |
| `dialog:importBackup` | `ipcRenderer.invoke` | Native file picker to restore backup data |
| `shell:openDataFolder` | `ipcRenderer.invoke` | Opens local `userData` folder in Finder |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```bash
# Clone the repository
git clone <your-repo-link>
cd isdDesktopApp

# Install dependencies
npm install
```

### Run in Development
```bash
npm start
```

### Build & Package Executables
```bash
# Package unpackaged macOS application bundle
npm run pack

# Build distributable macOS installer (.dmg and .zip)
npm run dist
```
The compiled executables will be output to the `dist/` folder.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Scope | Action |
|---|---|---|
| <kbd>⌥ Option</kbd> + <kbd>⌘ Cmd</kbd> + <kbd>F</kbd> | **Global** (Any App) | Start / Pause Focus Timer |
| <kbd>⌥ Option</kbd> + <kbd>⌘ Cmd</kbd> + <kbd>W</kbd> | **Global** (Any App) | Toggle Floating Mini-HUD |
| <kbd>⌥ Option</kbd> + <kbd>⌘ Cmd</kbd> + <kbd>N</kbd> | **Global** (Any App) | Quick Add Task |
| <kbd>Space</kbd> | In-App | Toggle Focus Timer |
| <kbd>⌘ Cmd</kbd> + <kbd>N</kbd> | In-App | Open New Task modal |

---

## 📄 Submission Checklist

- [x] **Repository**: Full source code with modular structure.
- [x] **Desktop APIs**: Native Notifications, System Tray, Global Shortcuts, Power Monitor, Dialogs, Shell.
- [x] **Windows**: Multi-window architecture (Main Window + Always-On-Top Mini-HUD).
- [x] **IPC**: Secure `contextBridge` communication with full CRUD.
- [x] **System-Level Interactions**: Local JSON storage in OS `userData`, Finder reveal, OS sleep detection.
- [x] **Executable**: Packaged app bundle built via `electron-builder`.
