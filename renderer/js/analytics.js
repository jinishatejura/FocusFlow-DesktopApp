// Analytics & Productivity Insights

function updateAnalyticsUI(sessions, tasks) {
  const totalMinutesEl = document.getElementById('stat-total-minutes');
  const totalSessionsEl = document.getElementById('stat-total-sessions');
  const tasksDoneEl = document.getElementById('stat-tasks-done');
  const streakEl = document.getElementById('stat-streak');
  const sessionsListEl = document.getElementById('sessions-list');

  if (!sessions) sessions = [];
  if (!tasks) tasks = [];

  // Focus sessions count & minutes
  const focusSessions = sessions.filter(s => s.type === 'focus' || !s.type);
  const totalMinutes = focusSessions.reduce((acc, s) => acc + (s.durationMinutes || 25), 0);
  const tasksDone = tasks.filter(t => t.status === 'done').length;

  // Streak calculation (days with at least 1 session)
  const uniqueDays = new Set(
    sessions.map(s => (s.completedAt || '').split('T')[0]).filter(Boolean)
  );
  const streak = uniqueDays.size > 0 ? `${uniqueDays.size} Day${uniqueDays.size > 1 ? 's' : ''}` : '0 Days';

  if (totalMinutesEl) totalMinutesEl.textContent = totalMinutes;
  if (totalSessionsEl) totalSessionsEl.textContent = focusSessions.length;
  if (tasksDoneEl) tasksDoneEl.textContent = tasksDone;
  if (streakEl) streakEl.textContent = streak;

  // Render recent sessions list
  if (sessionsListEl) {
    if (sessions.length === 0) {
      sessionsListEl.innerHTML = '<div class="empty-state">No focus sessions logged yet. Hit Start Focus to begin!</div>';
      return;
    }

    sessionsListEl.innerHTML = sessions.slice(0, 10).map(s => {
      const date = new Date(s.completedAt);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const isFocus = s.type === 'focus' || !s.type;

      return `
        <div class="session-row">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span>${isFocus ? '🎯' : '☕'}</span>
            <div>
              <div style="font-weight: 600; color: var(--text-primary);">${s.taskTitle || 'Free Focus Sprint'}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${dateStr} at ${timeStr}</div>
            </div>
          </div>
          <div style="font-family: var(--font-mono); font-weight: 700; color: ${isFocus ? 'var(--accent-cyan)' : 'var(--accent-emerald)'};">
            +${s.durationMinutes || 25} min
          </div>
        </div>
      `;
    }).join('');
  }
}

window.updateAnalyticsUI = updateAnalyticsUI;
