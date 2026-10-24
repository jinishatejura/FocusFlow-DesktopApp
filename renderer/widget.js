// Mini-HUD Floating Widget Controller

let isRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  const taskNameEl = document.getElementById('hud-task-name');
  const timerTextEl = document.getElementById('hud-timer-text');
  const indicatorEl = document.getElementById('hud-indicator');
  const playBtn = document.getElementById('hud-play-btn');
  const expandBtn = document.getElementById('hud-expand-btn');
  const closeBtn = document.getElementById('hud-close-btn');

  if (window.focusFlowAPI) {
    // Listen for live timer sync updates from main
    window.focusFlowAPI.timer.onStateUpdate((state) => {
      timerTextEl.textContent = state.timeText;
      taskNameEl.textContent = state.taskTitle || 'Free Focus';
      isRunning = state.isRunning;

      if (isRunning) {
        indicatorEl.classList.add('active');
        playBtn.textContent = '⏸';
      } else {
        indicatorEl.classList.remove('active');
        playBtn.textContent = '▶';
      }
    });

    // Controls
    playBtn.addEventListener('click', () => {
      window.focusFlowAPI.timer.sendAction('toggle');
    });

    expandBtn.addEventListener('click', () => {
      // Toggle widget hides it, and opens/focuses main window
      window.focusFlowAPI.window.toggleWidget();
    });

    closeBtn.addEventListener('click', () => {
      window.focusFlowAPI.window.toggleWidget();
    });
  }
});
