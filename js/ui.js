/* ============================================================
   ui.js
   Lightweight UI controller. Wraps the DOM overlays so the
   rest of the game can show/hide HUD elements without touching
   the DOM directly.
   ============================================================ */

export class UI {
  constructor() {
    this.crosshair    = document.getElementById('crosshair');
    this.hud          = document.getElementById('hud');
    this.exitPrompt   = document.getElementById('exit-prompt');
    this.notice       = document.getElementById('notice');
    this.overlay      = document.getElementById('overlay');
    this.complete     = document.getElementById('complete-screen');
    this.startButton  = document.getElementById('start-button');
    this.restartButton = document.getElementById('restart-button');
    this.loadingNote  = document.getElementById('loading-note');
  }

  /** Enable the start button once the scene is ready. */
  setReady() {
    if (this.loadingNote) this.loadingNote.classList.add('hidden');
    if (this.startButton) this.startButton.disabled = false;
  }

  /** Called when gameplay begins (pointer locked). */
  enterGameplay() {
    this.overlay.classList.add('hidden');
    this.complete.classList.add('hidden');
    this.crosshair.classList.remove('hidden');
    this.hud.classList.remove('hidden');
  }

  /** Show the start overlay (e.g. after releasing the pointer). */
  showOverlay() {
    this.overlay.classList.remove('hidden');
    this.crosshair.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideExitPrompt();
  }

  showExitPrompt() {
    this.exitPrompt.classList.remove('hidden');
  }

  /** Replace the prompt text (accepts HTML, e.g. for the bold key hint). */
  setExitPrompt(html) {
    if (this.exitPrompt) this.exitPrompt.innerHTML = html;
  }

  hideExitPrompt() {
    this.exitPrompt.classList.add('hidden');
  }

  /** Show a transient on-screen notice (HTML allowed). */
  showNotice(html) {
    if (!this.notice) return;
    this.notice.innerHTML = html;
    this.notice.classList.remove('hidden');
  }

  hideNotice() {
    if (this.notice) this.notice.classList.add('hidden');
  }

  showComplete() {
    this.complete.classList.remove('hidden');
    this.crosshair.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideExitPrompt();
  }

  hideComplete() {
    this.complete.classList.add('hidden');
  }

  onStart(handler) {
    if (this.startButton) this.startButton.addEventListener('click', handler);
  }

  onRestart(handler) {
    if (this.restartButton) this.restartButton.addEventListener('click', handler);
  }
}
