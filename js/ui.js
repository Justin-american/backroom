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

    this.thought        = document.getElementById('thought');
    this.interactPrompt = document.getElementById('interact-prompt');
    this.interactName   = document.getElementById('interact-name');
    this.interactAction = document.getElementById('interact-action');
    this.fade           = document.getElementById('fade');

    this._thoughtTimer = null;
    this._thoughtHideTimer = null;
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
    this.hideInteract();
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

  // -------------------------------------------------------------------------
  // Subtitle-style "thought" line: fades in, holds briefly, fades out.
  // -------------------------------------------------------------------------
  /**
   * @param {string} text  the thought to display
   * @param {number} [hold] seconds to stay fully visible (default 3.4)
   */
  showThought(text, hold = 3.4) {
    if (!this.thought) return;
    clearTimeout(this._thoughtTimer);
    clearTimeout(this._thoughtHideTimer);

    this.thought.textContent = text;
    this.thought.classList.remove('hidden');
    // force reflow so the fade-in transition always runs
    // eslint-disable-next-line no-unused-expressions
    this.thought.offsetHeight;
    this.thought.classList.add('show');

    this._thoughtTimer = setTimeout(() => {
      this.thought.classList.remove('show');           // fade out
      this._thoughtHideTimer = setTimeout(() => {
        this.thought.classList.add('hidden');
      }, 900);
    }, hold * 1000);
  }

  hideThought() {
    if (!this.thought) return;
    clearTimeout(this._thoughtTimer);
    clearTimeout(this._thoughtHideTimer);
    this.thought.classList.remove('show');
    this.thought.classList.add('hidden');
  }

  // -------------------------------------------------------------------------
  // Interaction prompt: object name + an action line ([E] Pick Up / Locked).
  // -------------------------------------------------------------------------
  showInteract(name, action, locked = false) {
    if (!this.interactPrompt) return;
    this.interactName.textContent = name;
    this.interactAction.innerHTML = action;
    this.interactAction.classList.toggle('locked', !!locked);
    this.interactPrompt.classList.remove('hidden');
  }

  hideInteract() {
    if (this.interactPrompt) this.interactPrompt.classList.add('hidden');
  }

  // -------------------------------------------------------------------------
  // Fullscreen fade, used for level transitions. Returns a Promise that
  // resolves once the transition has visually completed.
  // -------------------------------------------------------------------------
  fadeOut() {
    return new Promise((resolve) => {
      if (!this.fade) return resolve();
      this.fade.classList.add('show');
      setTimeout(resolve, 1150);
    });
  }

  fadeIn() {
    return new Promise((resolve) => {
      if (!this.fade) return resolve();
      this.fade.classList.remove('show');
      setTimeout(resolve, 1150);
    });
  }

  showComplete() {
    this.complete.classList.remove('hidden');
    this.crosshair.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideExitPrompt();
    this.hideInteract();
    this.hideThought();
  }

  /** Update the level-complete screen's title / flavor / button text. */
  setComplete(title, flavor, buttonLabel) {
    const t = this.complete.querySelector('.complete-title');
    const f = this.complete.querySelector('.flavor');
    if (t && title) t.innerHTML = title;
    if (f && flavor) f.innerHTML = flavor;
    if (this.restartButton && buttonLabel) this.restartButton.textContent = buttonLabel;
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
