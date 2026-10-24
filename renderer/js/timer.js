// Focus Timer Logic & State Machine

class FocusTimer {
  constructor() {
    this.mode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
    this.durations = {
      focus: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60
    };
    this.timeLeft = this.durations.focus;
    this.isRunning = false;
    this.intervalId = null;
    this.activeTask = null; // { id, title, description }
    this.audioContext = null;

    // Callbacks
    this.onTick = null;
    this.onComplete = null;
    this.onStateChange = null;
  }

  init(settings = {}) {
    if (settings.focusDuration) this.durations.focus = settings.focusDuration * 60;
    if (settings.shortBreakDuration) this.durations.shortBreak = settings.shortBreakDuration * 60;
    if (settings.longBreakDuration) this.durations.longBreak = settings.longBreakDuration * 60;
    this.timeLeft = this.durations[this.mode];
  }

  setMode(mode) {
    if (this.isRunning) this.pause();
    this.mode = mode;
    this.timeLeft = this.durations[mode] || (25 * 60);
    this.notifyState();
  }

  setActiveTask(task) {
    this.activeTask = task;
    this.notifyState();
  }

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
    this.notifyState();
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.notifyState();
  }

  reset() {
    this.pause();
    this.timeLeft = this.durations[this.mode];
    this.notifyState();
  }

  skip() {
    this.pause();
    if (this.mode === 'focus') {
      this.setMode('shortBreak');
    } else {
      this.setMode('focus');
    }
  }

  tick() {
    if (this.timeLeft > 0) {
      this.timeLeft--;
      if (this.onTick) this.onTick(this.getState());
      this.broadcastToMain();
    } else {
      this.completeSession();
    }
  }

  completeSession() {
    this.pause();
    this.playChime();

    const completedMode = this.mode;
    const task = this.activeTask;

    if (this.onComplete) {
      this.onComplete({
        mode: completedMode,
        task: task,
        durationMinutes: Math.floor(this.durations[completedMode] / 60)
      });
    }

    // Auto switch next mode
    if (completedMode === 'focus') {
      this.setMode('shortBreak');
    } else {
      this.setMode('focus');
    }
  }

  playChime() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      const ctx = this.audioContext;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
      });
    } catch (e) {
      console.warn('Audio chime fallback:', e);
      if (window.focusFlowAPI && window.focusFlowAPI.shell) {
        window.focusFlowAPI.shell.beep();
      }
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  getState() {
    const total = this.durations[this.mode];
    const progress = total > 0 ? (total - this.timeLeft) / total : 0;
    return {
      mode: this.mode,
      timeLeft: this.timeLeft,
      timeText: this.formatTime(this.timeLeft),
      totalDuration: total,
      progress: progress,
      isRunning: this.isRunning,
      taskTitle: this.activeTask ? this.activeTask.title : 'Free Focus Sprint',
      taskId: this.activeTask ? this.activeTask.id : null
    };
  }

  notifyState() {
    const state = this.getState();
    if (this.onStateChange) this.onStateChange(state);
    if (this.onTick) this.onTick(state);
    this.broadcastToMain();
  }

  broadcastToMain() {
    if (window.focusFlowAPI && window.focusFlowAPI.timer) {
      window.focusFlowAPI.timer.syncState(this.getState());
    }
  }
}

window.focusTimer = new FocusTimer();
