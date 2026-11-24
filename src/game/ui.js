// The run's interface: score, lives, the prism counter, the thumb controls and
// the card that starts and ends a run. All of it is DOM sitting over the canvas,
// because Three has no text and no way to press a button in the world.

import { addText, addButton, clearHUD } from '../hud.js';
import { PRISM_NEED, TOUCH } from './config.js';

export class GameHUD {
  /// `handlers` is { primary, pause, jump, turn(dir, down) }.
  constructor(handlers) {
    this.h = handlers;
    this.lastScore = -1;
    this.lastBest = -1;
    this.lastShards = -1;
    this.lastLives = -1;
    this.surged = false;

    const hud = document.getElementById('hud');

    this.scoreEl = addText('0', {
      top: '12px',
      left: '18px',
      fontSize: '30px',
      letterSpacing: '2px',
      color: 'var(--pr-cyan)',
      textShadow: '0 0 14px rgba(56, 240, 255, 0.55)'
    });

    this.bestEl = addText('BEST 0', {
      top: '46px',
      left: '19px',
      fontSize: '12px',
      letterSpacing: '1px',
      color: 'var(--pr-dim)'
    });

    this.pauseBtn = addButton({
      icon: 'pause',
      label: 'Pause',
      onPress: () => this.h.pause(),
      style: {
        position: 'absolute',
        top: '14px',
        right: '16px',
        width: '42px',
        height: '42px',
        backgroundSize: '44%'
      }
    });

    this.livesEl = document.createElement('div');
    this.livesEl.className = 'pr-lives';
    this.livesEl.style.top = '66px';
    this.livesEl.style.right = '18px';
    hud.appendChild(this.livesEl);
    this.pips = [];
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('i');
      pip.className = 'pr-pip';
      this.livesEl.appendChild(pip);
      this.pips.push(pip);
    }

    this.shardEl = addText(`PRISM 0/${PRISM_NEED}`, {
      top: '90px',
      right: '18px',
      fontSize: '12px',
      letterSpacing: '1px',
      color: 'var(--pr-amber)'
    });

    if (TOUCH) this.buildPad(hud);
    this.buildOverlay(hud);
    this.setLives(3);
    this.setShards(0, PRISM_NEED);
    this.setScore(0);
  }

  buildPad(hud) {
    const pad = document.createElement('div');
    pad.className = 'pr-pad';
    hud.appendChild(pad);

    const left = addButton({
      icon: 'rotate-ccw',
      label: 'Spin left',
      onPress: () => this.h.turn(-1, true),
      onRelease: () => this.h.turn(-1, false),
      style: { position: 'absolute', bottom: '26px', left: '22px', width: '78px', height: '78px' }
    });
    const right = addButton({
      icon: 'rotate-cw',
      label: 'Spin right',
      onPress: () => this.h.turn(1, true),
      onRelease: () => this.h.turn(1, false),
      style: { position: 'absolute', bottom: '26px', left: '112px', width: '78px', height: '78px' }
    });
    const jump = addButton({
      icon: 'arrow-up',
      label: 'Leap',
      onPress: () => this.h.jump(),
      style: {
        position: 'absolute',
        bottom: '26px',
        right: '22px',
        width: '92px',
        height: '92px',
        backgroundSize: '40%'
      }
    });

    pad.append(left, right, jump);
    this.pad = pad;
  }

  buildOverlay(hud) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pr-overlay';

    this.card = document.createElement('div');
    this.card.className = 'pr-card';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'pr-title';

    this.subEl = document.createElement('div');
    this.subEl.className = 'pr-sub';

    this.hintsEl = document.createElement('div');
    this.hintsEl.className = 'pr-hints';

    this.playBtn = addButton({
      icon: 'play',
      label: 'Start',
      onPress: () => this.h.primary(),
      style: { width: '92px', height: '92px', marginTop: '4px', backgroundSize: '36%' }
    });

    this.card.append(this.titleEl, this.subEl, this.playBtn, this.hintsEl);
    this.overlay.appendChild(this.card);
    // The card's button has its own handler, so only the backdrop itself is a
    // second way in — otherwise one press would fire twice.
    this.overlay.addEventListener('pointerdown', (event) => {
      if (event.target === this.overlay) this.h.primary();
    });

    hud.appendChild(this.overlay);
  }

  setScore(n) {
    if (n === this.lastScore) return;
    this.lastScore = n;
    this.scoreEl.textContent = String(n);
  }

  setBest(n) {
    if (n === this.lastBest) return;
    this.lastBest = n;
    this.bestEl.textContent = `BEST ${n}`;
  }

  setShards(n, need) {
    if (n === this.lastShards) return;
    this.lastShards = n;
    this.shardEl.textContent = `PRISM ${n}/${need}`;
  }

  setLives(n) {
    if (n === this.lastLives) return;
    this.lastLives = n;
    for (let i = 0; i < this.pips.length; i++) {
      this.pips[i].classList.toggle('off', i >= n);
    }
  }

  setSurge(on) {
    if (on === this.surged) return;
    this.surged = on;
    this.scoreEl.classList.toggle('surge', on);
    this.shardEl.classList.toggle('surge', on);
  }

  showTitle(best) {
    this.setBest(best);
    this.titleEl.textContent = 'PRISM RUN';
    this.subEl.textContent = 'SPIN THE TUBE. DODGE, LEAP, COLLECT.';
    this.hintsEl.textContent = TOUCH
      ? 'DRAG TO SPIN\nTAP TO LEAP\nMAGENTA IS SOLID. GOLD YOU HOP.'
      : 'A / D TO SPIN\nSPACE TO LEAP\nMAGENTA IS SOLID. GOLD YOU HOP.';
    this.playBtn.style.backgroundImage = 'var(--icon-play)';
    this.playBtn.setAttribute('aria-label', 'Start');
    this.reveal();
  }

  showGameOver(score, best) {
    this.setBest(best);
    this.titleEl.textContent = 'RUN OVER';
    this.subEl.textContent = `SCORE ${score}`;
    this.hintsEl.textContent = `BEST ${best}\n${TOUCH ? 'TAP' : 'PRESS R OR SPACE'} TO RUN AGAIN`;
    this.playBtn.style.backgroundImage = 'var(--icon-refresh-ccw)';
    this.playBtn.setAttribute('aria-label', 'Run again');
    this.reveal();
  }

  showPause() {
    this.titleEl.textContent = 'PAUSED';
    this.subEl.textContent = `SCORE ${Math.max(0, this.lastScore)}`;
    this.hintsEl.textContent = TOUCH ? 'TAP TO RESUME' : 'PRESS P TO RESUME';
    this.playBtn.style.backgroundImage = 'var(--icon-play)';
    this.playBtn.setAttribute('aria-label', 'Resume');
    this.reveal();
  }

  reveal() {
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }

  dispose() {
    // Everything above lives in #hud, so emptying it is the whole teardown.
    clearHUD();
  }
}
