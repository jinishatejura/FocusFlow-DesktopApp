// FocusFlow Application Controller

let allTasks = [];
let allSessions = [];
let appSettings = {};
let currentViewMode = 'kanban'; // 'kanban' or 'list'
let activeFilterCategory = 'all';
let activeFilterPriority = 'all';
let activeFilterRoutine = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupWindowControls();
  setupTaskModal();
  setupFilters();
  setupTimerIntegration();
  setupSettingsView();
  setupShortcuts();

  // Load initial data from electronAPI
  await loadInitialData();
});

// --- Initial Data Load & Event Listeners ---
async function loadInitialData() {
  if (!window.focusFlowAPI) {
    console.warn('focusFlowAPI not available (running in browser mode)');
    return;
  }

  // Fetch initial state
  [allTasks, allSessions, appSettings] = await Promise.all([
    window.focusFlowAPI.tasks.get(),
    window.focusFlowAPI.sessions.get(),
    window.focusFlowAPI.settings.get()
  ]);

  // Init Timer with stored durations
  window.focusTimer.init(appSettings);

  // Render
  renderTasks();
  updateAnalyticsUI(allSessions, allTasks);
  populateSettingsUI();
  loadSystemTelemetry();

  // Realtime IPC listeners
  window.focusFlowAPI.tasks.onUpdated((tasks) => {
    allTasks = tasks;
    renderTasks();
    updateAnalyticsUI(allSessions, allTasks);
  });

  window.focusFlowAPI.sessions.onUpdated((sessions) => {
    allSessions = sessions;
    updateAnalyticsUI(allSessions, allTasks);
  });

  window.focusFlowAPI.settings.onUpdated((settings) => {
    appSettings = settings;
    window.focusTimer.init(settings);
    populateSettingsUI();
  });

  window.focusFlowAPI.shortcuts.onQuickAdd(() => {
    openTaskModal();
  });

  window.focusFlowAPI.timer.onExecuteAction((action) => {
    if (action === 'toggle') window.focusTimer.toggle();
    else if (action === 'pause') window.focusTimer.pause();
    else if (action === 'start') window.focusTimer.start();
  });
}

// --- Navigation ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      navItems.forEach(i => i.classList.remove('active'));
      viewPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const panel = document.getElementById(targetView);
      if (panel) panel.classList.add('active');

      if (targetView === 'analytics-view') {
        updateAnalyticsUI(allSessions, allTasks);
      }
    });
  });

  // Switch between Board and List
  const kanbanBtn = document.getElementById('view-mode-kanban');
  const listBtn = document.getElementById('view-mode-list');
  const kanbanContainer = document.getElementById('kanban-container');
  const listContainer = document.getElementById('list-container');

  kanbanBtn.addEventListener('click', () => {
    currentViewMode = 'kanban';
    kanbanBtn.classList.add('active');
    listBtn.classList.remove('active');
    kanbanContainer.style.display = 'grid';
    listContainer.style.display = 'none';
    renderTasks();
  });

  listBtn.addEventListener('click', () => {
    currentViewMode = 'list';
    listBtn.classList.add('active');
    kanbanBtn.classList.remove('active');
    kanbanContainer.style.display = 'none';
    listContainer.style.display = 'block';
    renderTasks();
  });
}

// --- Window Controls ---
function setupWindowControls() {
  const minBtn = document.getElementById('win-min-btn');
  const maxBtn = document.getElementById('win-max-btn');
  const closeBtn = document.getElementById('win-close-btn');
  const toggleWidgetBtn = document.getElementById('toggle-mini-widget-btn');

  if (window.focusFlowAPI) {
    minBtn.addEventListener('click', () => window.focusFlowAPI.window.minimize());
    maxBtn.addEventListener('click', () => window.focusFlowAPI.window.maximize());
    closeBtn.addEventListener('click', () => window.focusFlowAPI.window.close());
    toggleWidgetBtn.addEventListener('click', () => {
      window.focusFlowAPI.window.toggleWidget();
      showToast('📌 Toggled Mini-HUD Floating Widget');
    });
  }
}

// --- Filters & Search ---
function setupFilters() {
  const searchInput = document.getElementById('task-search-input');
  const catSelect = document.getElementById('filter-category');
  const prioritySelect = document.getElementById('filter-priority');
  const routineSelect = document.getElementById('filter-routine');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTasks();
  });

  catSelect.addEventListener('change', (e) => {
    activeFilterCategory = e.target.value;
    renderTasks();
  });

  prioritySelect.addEventListener('change', (e) => {
    activeFilterPriority = e.target.value;
    renderTasks();
  });

  if (routineSelect) {
    routineSelect.addEventListener('change', (e) => {
      activeFilterRoutine = e.target.value;
      renderTasks();
    });
  }
}

// Helper to calculate deadline urgency & formatting
function getDeadlineStatus(task) {
  if (!task.dueDate) return { status: 'none', label: '', isOverdue: false, isDueSoon: false, isDueToday: false };
  const timePart = task.dueTime && task.dueTime.includes(':') ? task.dueTime : '23:59';
  const deadline = new Date(`${task.dueDate}T${timePart}:00`);
  if (isNaN(deadline.getTime())) return { status: 'none', label: '', isOverdue: false, isDueSoon: false, isDueToday: false };

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs < 0) {
    return { status: 'overdue', label: 'Overdue', isOverdue: true, isDueSoon: false, isDueToday: false };
  }

  const isToday = deadline.toDateString() === now.toDateString();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 2) {
    const mins = Math.max(1, Math.round(diffMs / (1000 * 60)));
    return { status: 'due-soon', label: `In ${mins}m`, isOverdue: false, isDueSoon: true, isDueToday: isToday };
  }

  if (isToday) {
    return { status: 'due-today', label: task.dueTime ? `Today at ${task.dueTime}` : 'Due Today', isOverdue: false, isDueSoon: false, isDueToday: true };
  }

  return { status: 'upcoming', label: task.dueDate, isOverdue: false, isDueSoon: false, isDueToday: false };
}

// --- Render Tasks (Kanban & List) ---
function renderTasks() {
  const filtered = allTasks.filter(task => {
    const matchesSearch = !searchQuery ||
      task.title.toLowerCase().includes(searchQuery) ||
      (task.description && task.description.toLowerCase().includes(searchQuery));
    const matchesCat = activeFilterCategory === 'all' || task.category === activeFilterCategory;
    const matchesPriority = activeFilterPriority === 'all' || task.priority === activeFilterPriority;
    
    const dStatus = getDeadlineStatus(task);
    let matchesRoutine = true;
    if (activeFilterRoutine === 'recurring') {
      matchesRoutine = task.repeat && task.repeat !== 'none';
    } else if (activeFilterRoutine === 'due-soon') {
      matchesRoutine = dStatus.isOverdue || dStatus.isDueSoon || dStatus.isDueToday;
    }

    return matchesSearch && matchesCat && matchesPriority && matchesRoutine;
  });

  // Update badge count
  const badge = document.getElementById('tasks-badge');
  if (badge) badge.textContent = allTasks.filter(t => t.status !== 'done').length;

  if (currentViewMode === 'kanban') {
    renderKanbanBoard(filtered);
  } else {
    renderListView(filtered);
  }
}

function renderKanbanBoard(tasks) {
  const todoList = document.getElementById('list-todo');
  const inprogressList = document.getElementById('list-inprogress');
  const doneList = document.getElementById('list-done');

  todoList.innerHTML = '';
  inprogressList.innerHTML = '';
  doneList.innerHTML = '';

  const groups = { todo: [], 'in-progress': [], done: [] };
  tasks.forEach(task => {
    if (groups[task.status]) groups[task.status].push(task);
  });

  document.getElementById('count-todo').textContent = groups.todo.length;
  document.getElementById('count-inprogress').textContent = groups['in-progress'].length;
  document.getElementById('count-done').textContent = groups.done.length;

  Object.keys(groups).forEach(status => {
    const container = status === 'todo' ? todoList : (status === 'in-progress' ? inprogressList : doneList);
    if (groups[status].length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 20px 0;">No tasks here</div>`;
      return;
    }
    groups[status].forEach(task => {
      container.appendChild(createTaskCard(task));
    });
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  const isActiveFocus = window.focusTimer.activeTask && window.focusTimer.activeTask.id === task.id;
  card.className = `task-card ${isActiveFocus ? 'active-focus' : ''}`;

  const pomodoros = task.completedPomodoros || 0;
  const estimated = task.estimatedPomodoros || 1;

  // Recurring routine badge
  let repeatBadgeHtml = '';
  if (task.repeat && task.repeat !== 'none') {
    const repMap = { daily: '🔁 Daily', weekdays: '🔁 Mon-Fri', weekly: '🔁 Weekly' };
    const repLabel = repMap[task.repeat] || '🔁 Repeat';
    const streakHtml = (task.routineStreak || 0) > 0 ? `<span class="streak-pill" title="Routine Streak">🔥 ${task.routineStreak}</span>` : '';
    repeatBadgeHtml = `<span class="badge badge-repeat" title="Recurring Routine">${repLabel}</span> ${streakHtml}`;
  }

  // Deadline urgency badge
  const dStatus = getDeadlineStatus(task);
  let deadlineBadgeHtml = '';
  if (task.status !== 'done') {
    if (dStatus.status === 'overdue') {
      deadlineBadgeHtml = `<span class="badge badge-overdue" title="Deadline Missed">🚨 Overdue</span>`;
    } else if (dStatus.status === 'due-soon') {
      deadlineBadgeHtml = `<span class="badge badge-due-soon" title="Due in < 2 hours">⏳ ${dStatus.label}</span>`;
    } else if (dStatus.status === 'due-today') {
      deadlineBadgeHtml = `<span class="badge badge-due-today">📅 ${dStatus.label}</span>`;
    }
  }

  // Due date & time row
  let deadlineRowHtml = '';
  if (task.dueDate) {
    deadlineRowHtml = `
      <div class="task-deadline-row">
        <span>🗓️</span>
        <span>Due: ${task.dueDate}${task.dueTime ? ' at ' + task.dueTime : ''}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-card-title">${escapeHtml(task.title)}</div>
    </div>
    ${task.description ? `<div class="task-card-desc">${escapeHtml(task.description)}</div>` : ''}
    ${deadlineRowHtml}
    <div class="task-card-meta">
      <div class="task-badges">
        <span class="badge badge-${task.priority}">${task.priority}</span>
        <span class="badge badge-cat">${task.category}</span>
        ${repeatBadgeHtml}
        ${deadlineBadgeHtml}
      </div>
      <div class="task-pomodoros" title="Completed / Estimated Pomodoros">
        <span>🍅</span> ${pomodoros}/${estimated}
      </div>
    </div>
    <div class="task-card-actions">
      <button class="focus-now-btn" data-action="focus">
        ${isActiveFocus ? '🎯 Focusing' : '▶ Focus'}
      </button>
      <div class="card-action-btns">
        <button class="icon-btn" data-action="status" title="Move Stage">
          ${task.status === 'todo' ? '➔ In Progress' : (task.status === 'in-progress' ? '✓ Mark Done' : '↺ Reopen')}
        </button>
        <button class="icon-btn" data-action="edit" title="Edit">✎</button>
        <button class="icon-btn" data-action="delete" title="Delete">🗑</button>
      </div>
    </div>
  `;

  // Attach card event listeners
  card.querySelector('[data-action="focus"]').addEventListener('click', (e) => {
    e.stopPropagation();
    setFocusOnTask(task);
  });

  card.querySelector('[data-action="status"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    let nextStatus = 'in-progress';
    if (task.status === 'in-progress') nextStatus = 'done';
    else if (task.status === 'done') nextStatus = 'todo';
    const updated = await window.focusFlowAPI.tasks.update(task.id, { status: nextStatus });

    if (nextStatus === 'done' && task.repeat && task.repeat !== 'none') {
      showToast(`🎉 Routine completed! Scheduled next for: ${updated.dueDate} (🔥 Streak: ${updated.routineStreak})`);
    } else {
      showToast(`Task moved to ${nextStatus}`);
    }
  });

  card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openTaskModal(task);
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm(`Delete task "${task.title}"?`)) {
      await window.focusFlowAPI.tasks.delete(task.id);
      showToast('Task deleted');
    }
  });

  return card;
}

function renderListView(tasks) {
  const tbody = document.getElementById('tasks-table-body');
  if (!tbody) return;

  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No matching tasks found.</td></tr>`;
    return;
  }

  tbody.innerHTML = tasks.map(task => {
    const isDone = task.status === 'done';
    const dStatus = getDeadlineStatus(task);

    let repeatHtml = '-';
    if (task.repeat && task.repeat !== 'none') {
      const repMap = { daily: '🔁 Daily', weekdays: '🔁 Mon-Fri', weekly: '🔁 Weekly' };
      repeatHtml = `<span class="badge badge-repeat">${repMap[task.repeat] || task.repeat}</span> ${(task.routineStreak || 0) > 0 ? `🔥${task.routineStreak}` : ''}`;
    }

    let deadlineBadge = '';
    if (!isDone) {
      if (dStatus.status === 'overdue') deadlineBadge = `<span class="badge badge-overdue">Overdue</span>`;
      else if (dStatus.status === 'due-soon') deadlineBadge = `<span class="badge badge-due-soon">${dStatus.label}</span>`;
      else if (dStatus.status === 'due-today') deadlineBadge = `<span class="badge badge-due-today">Today</span>`;
    }

    return `
      <tr>
        <td>
          <input type="checkbox" ${isDone ? 'checked' : ''} data-toggle-id="${task.id}" style="accent-color: var(--accent-cyan); cursor: pointer;">
        </td>
        <td>
          <div style="font-weight: 600; text-decoration: ${isDone ? 'line-through' : 'none'}; color: ${isDone ? 'var(--text-muted)' : 'var(--text-primary)'}">
            ${escapeHtml(task.title)}
          </div>
          ${deadlineBadge ? `<div style="margin-top: 4px;">${deadlineBadge}</div>` : ''}
        </td>
        <td><span class="badge badge-cat">${task.category}</span></td>
        <td><span class="badge badge-${task.priority}">${task.priority}</span></td>
        <td>${repeatHtml}</td>
        <td style="font-family: var(--font-mono);">${task.completedPomodoros || 0}/${task.estimatedPomodoros || 1} 🍅</td>
        <td style="color: var(--text-secondary); font-size: 12px;">${task.dueDate || '-'}${task.dueTime ? ' ' + task.dueTime : ''}</td>
        <td style="text-align: right;">
          <button class="focus-now-btn" data-list-focus="${task.id}">Focus</button>
          <button class="icon-btn" data-list-delete="${task.id}">🗑</button>
        </td>
      </tr>
    `;
  }).join('');

  // Row action handlers
  tbody.querySelectorAll('[data-toggle-id]').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-toggle-id');
      await window.focusFlowAPI.tasks.update(id, { status: e.target.checked ? 'done' : 'in-progress' });
    });
  });

  tbody.querySelectorAll('[data-list-focus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-list-focus');
      const task = allTasks.find(t => t.id === id);
      if (task) setFocusOnTask(task);
    });
  });

  tbody.querySelectorAll('[data-list-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-list-delete');
      if (confirm('Delete this task?')) {
        await window.focusFlowAPI.tasks.delete(id);
      }
    });
  });
}

function setFocusOnTask(task) {
  window.focusTimer.setActiveTask(task);
  renderTasks();

  // Switch to timer view
  const timerNav = document.querySelector('[data-view="timer-view"]');
  if (timerNav) timerNav.click();

  showToast(`Locked focus onto: ${task.title}`);
}

// --- Focus Timer UI Integration ---
function setupTimerIntegration() {
  const playBtn = document.getElementById('timer-play-btn');
  const resetBtn = document.getElementById('timer-reset-btn');
  const skipBtn = document.getElementById('timer-skip-btn');
  const timeDisplay = document.getElementById('timer-time-display');
  const modeLabel = document.getElementById('timer-mode-label');
  const gaugeProgress = document.getElementById('gauge-progress');
  const sidebarTime = document.getElementById('sidebar-timer-time');
  const sidebarStatus = document.getElementById('sidebar-timer-status');
  const currentTaskName = document.getElementById('current-task-name');
  const currentTaskDesc = document.getElementById('current-task-desc');
  const playIcon = document.getElementById('timer-play-icon');
  const playLabel = document.getElementById('timer-play-label');

  const modePills = document.querySelectorAll('.mode-pill');
  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      window.focusTimer.setMode(pill.getAttribute('data-mode'));
    });
  });

  playBtn.addEventListener('click', () => {
    window.focusTimer.toggle();
  });

  resetBtn.addEventListener('click', () => {
    window.focusTimer.reset();
  });

  skipBtn.addEventListener('click', () => {
    window.focusTimer.skip();
  });

  // Ticking UI updates
  window.focusTimer.onTick = (state) => {
    timeDisplay.textContent = state.timeText;
    sidebarTime.textContent = state.timeText;
    sidebarStatus.textContent = state.isRunning ? state.mode.toUpperCase() : 'PAUSED';

    // SVG dashoffset calculation: circumference = 2 * PI * 140 ~= 879.6
    const circumference = 879.6;
    const offset = circumference * (1 - state.progress);
    gaugeProgress.style.strokeDashoffset = offset;

    // Change gradient for breaks
    if (state.mode === 'focus') {
      gaugeProgress.style.stroke = 'url(#timer-gradient)';
      modeLabel.textContent = 'FOCUS SESSION';
    } else {
      gaugeProgress.style.stroke = 'url(#break-gradient)';
      modeLabel.textContent = state.mode === 'shortBreak' ? 'SHORT BREAK' : 'LONG BREAK';
    }
  };

  window.focusTimer.onStateChange = (state) => {
    if (state.isRunning) {
      playIcon.textContent = '⏸';
      playLabel.textContent = 'Pause';
      playBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else {
      playIcon.textContent = '▶';
      playLabel.textContent = state.timeLeft < state.totalDuration ? 'Resume' : 'Start Focus';
      playBtn.style.background = 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))';
    }

    if (state.taskTitle) {
      currentTaskName.textContent = state.taskTitle;
      const t = allTasks.find(x => x.id === state.taskId);
      currentTaskDesc.textContent = t && t.description ? t.description : 'Active sprint in progress.';
    } else {
      currentTaskName.textContent = 'Free Focus Sprint';
      currentTaskDesc.textContent = 'No task locked. Completed pomodoros count toward general focus.';
    }
  };

  window.focusTimer.onComplete = async ({ mode, task, durationMinutes }) => {
    // 1. Log Session
    await window.focusFlowAPI.sessions.log({
      taskId: task ? task.id : null,
      taskTitle: task ? task.title : 'Free Focus Sprint',
      durationMinutes: durationMinutes,
      type: mode
    });

    // 2. Increment task pomodoros if focus
    if (mode === 'focus') {
      if (task) {
        await window.focusFlowAPI.tasks.incrementPomodoro(task.id);
      }
      // Native desktop notification
      await window.focusFlowAPI.notifications.focusComplete(task ? task.title : null);
      showToast('🎉 Focus sprint completed! Take a break.');
    } else {
      // Break notification
      await window.focusFlowAPI.notifications.breakEnd(mode === 'longBreak');
      showToast('⏰ Break finished! Ready to focus again?');
    }
  };
}

// --- Task Create / Edit Modal ---
function setupTaskModal() {
  const modal = document.getElementById('task-modal');
  const openBtn = document.getElementById('open-new-task-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-task-btn');
  const form = document.getElementById('task-form');

  openBtn.addEventListener('click', () => openTaskModal());
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  cancelBtn.addEventListener('click', () => modal.classList.remove('active'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('task-form-id').value;
    const taskData = {
      title: document.getElementById('task-form-title').value.trim(),
      description: document.getElementById('task-form-description').value.trim(),
      category: document.getElementById('task-form-category').value,
      priority: document.getElementById('task-form-priority').value,
      estimatedPomodoros: parseInt(document.getElementById('task-form-pomodoros').value, 10) || 1,
      dueDate: document.getElementById('task-form-due').value,
      dueTime: document.getElementById('task-form-due-time').value,
      repeat: document.getElementById('task-form-repeat').value,
      reminderMinutes: parseInt(document.getElementById('task-form-reminder').value, 10) || 60
    };

    if (id) {
      await window.focusFlowAPI.tasks.update(id, taskData);
      showToast('Task updated successfully');
    } else {
      await window.focusFlowAPI.tasks.add(taskData);
      showToast('New task created');
    }

    modal.classList.remove('active');
  });
}

function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('task-form');

  form.reset();
  if (task) {
    title.textContent = 'Edit Task';
    document.getElementById('task-form-id').value = task.id;
    document.getElementById('task-form-title').value = task.title;
    document.getElementById('task-form-description').value = task.description || '';
    document.getElementById('task-form-category').value = task.category || 'General';
    document.getElementById('task-form-priority').value = task.priority || 'medium';
    document.getElementById('task-form-pomodoros').value = task.estimatedPomodoros || 2;
    document.getElementById('task-form-due').value = task.dueDate || '';
    document.getElementById('task-form-due-time').value = task.dueTime || '';
    document.getElementById('task-form-repeat').value = task.repeat || 'none';
    document.getElementById('task-form-reminder').value = task.reminderMinutes || '60';
  } else {
    title.textContent = 'New Task';
    document.getElementById('task-form-id').value = '';
    document.getElementById('task-form-pomodoros').value = 2;
    document.getElementById('task-form-repeat').value = 'none';
    document.getElementById('task-form-reminder').value = '60';
    document.getElementById('task-form-due-time').value = '';
  }

  modal.classList.add('active');
  document.getElementById('task-form-title').focus();
}

// --- Settings View & Desktop Native Actions ---
function setupSettingsView() {
  const focusDurInput = document.getElementById('setting-focus-duration');
  const shortDurInput = document.getElementById('setting-short-break');
  const longDurInput = document.getElementById('setting-long-break');
  const notifToggle = document.getElementById('setting-notifications-toggle');
  const soundToggle = document.getElementById('setting-sound-toggle');
  const trayToggle = document.getElementById('setting-tray-close-toggle');

  const saveSettingsHandler = async () => {
    const updated = {
      focusDuration: parseInt(focusDurInput.value, 10) || 25,
      shortBreakDuration: parseInt(shortDurInput.value, 10) || 5,
      longBreakDuration: parseInt(longDurInput.value, 10) || 15,
      notificationsEnabled: notifToggle.checked,
      soundEnabled: soundToggle.checked,
      minimizeToTrayOnClose: trayToggle.checked
    };
    await window.focusFlowAPI.settings.save(updated);
    showToast('Settings saved');
  };

  [focusDurInput, shortDurInput, longDurInput].forEach(inp => {
    inp.addEventListener('change', saveSettingsHandler);
  });
  [notifToggle, soundToggle, trayToggle].forEach(t => {
    t.addEventListener('change', saveSettingsHandler);
  });

  // Desktop notification test button
  document.getElementById('test-notification-btn').addEventListener('click', async () => {
    await window.focusFlowAPI.notifications.show(
      'FocusFlow System Alert',
      'Desktop notifications and audio cues are working properly!'
    );
  });

  // Native File Dialogs (Export / Import)
  document.getElementById('export-backup-btn').addEventListener('click', async () => {
    const res = await window.focusFlowAPI.dialog.exportBackup();
    if (res.success) {
      showToast(`Backup exported to: ${res.filePath}`);
    }
  });

  document.getElementById('import-backup-btn').addEventListener('click', async () => {
    const res = await window.focusFlowAPI.dialog.importBackup();
    if (res.success) {
      showToast(`Restored ${res.count} tasks from backup file!`);
    } else if (!res.canceled) {
      showToast(`Import failed: ${res.error}`);
    }
  });

  // Reveal data directory in Finder / File Explorer
  document.getElementById('open-data-dir-btn').addEventListener('click', async () => {
    await window.focusFlowAPI.shell.openDataFolder();
  });
}

function populateSettingsUI() {
  if (!appSettings) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };

  setVal('setting-focus-duration', appSettings.focusDuration || 25);
  setVal('setting-short-break', appSettings.shortBreakDuration || 5);
  setVal('setting-long-break', appSettings.longBreakDuration || 15);
  setChk('setting-notifications-toggle', appSettings.notificationsEnabled !== false);
  setChk('setting-sound-toggle', appSettings.soundEnabled !== false);
  setChk('setting-tray-close-toggle', appSettings.minimizeToTrayOnClose !== false);
}

async function loadSystemTelemetry() {
  const box = document.getElementById('system-info-container');
  if (!box || !window.focusFlowAPI) return;

  const info = await window.focusFlowAPI.system.getInfo();
  box.textContent = [
    `Application: FocusFlow v${info.version}`,
    `Platform:    ${info.platform} (${info.arch})`,
    `Electron:    v${info.electronVersion}`,
    `Node.js:     v${info.nodeVersion}`,
    `Chromium:    v${info.chromeVersion}`,
    `Data Dir:    ${info.userDataPath}`
  ].join('\n');
}

// --- Keyboard Shortcuts ---
function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Spacebar toggles timer when not typing in an input
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      window.focusTimer.toggle();
    }
    // Cmd+N opens task modal
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      openTaskModal();
    }
  });
}

// --- Utility Helpers ---
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>⚡</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}
