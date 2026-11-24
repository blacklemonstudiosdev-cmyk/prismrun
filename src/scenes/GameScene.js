// PRISM RUN — the whole game.
//
// The player is a cube stuck to the inside of an endless voxel tunnel. The tube
// scrolls at the camera, wedges of voxels grow in from the walls, and the only
// moves are spin around the tube and leap away from the wall. Everything the
// world is drawn from is a cube, and everything it collides with is an angle and
// a radius, so the run stays honest at any frame rate.

import * as THREE from 'three';
import { Scene } from '../scene.js';
import { Tunnel } from '../game/tunnel.js';
import { Player } from '../game/player.js';
import { ObstacleField, ShardField } from '../game/field.js';
import { GameHUD } from '../game/ui.js';
import { haptic } from '../haptics.js';
import {
  CAM_BACK,
  SPAWN_Z,
  BASE_SPEED,
  MAX_SPEED,
  SPEED_GAIN,
  PRISM_NEED,
  SURGE_TIME
} from '../game/config.js';

const BEST_KEY = 'prismrun.best';
const VOID = 0x05060f;

function wrap(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export class GameScene extends Scene {
  create() {
    const camera = this.game.camera;
    camera.fov = 62;
    camera.near = 0.1;
    camera.far = 240;
    camera.position.set(0, 0, CAM_BACK);
    camera.up.set(0, 1, 0);
    camera.updateProjectionMatrix();

    this.root.background = new THREE.Color(VOID);
    // Fog hides the far mouth of the tube, where new obstacles are born.
    this.root.fog = new THREE.Fog(VOID, 17, 56);

    this.root.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xc9e9ff, 1.8);
    key.position.set(2.5, 5, 9);
    this.root.add(key);

    this.tunnel = new Tunnel(this.root);
    this.obstacles = new ObstacleField(this.root);
    this.shards = new ShardField(this.root);
    this.player = new Player(this.root);

    this.tintColor = new THREE.Color();
    this.turnState = { buttons: 0, drag: 0 };
    this.keys = new Set();
    this.pointerId = null;
    this.dragged = false;
    this.time = 0;

    this.hud = new GameHUD({
      primary: () => this.primary(),
      pause: () => this.togglePause(),
      jump: () => this.requestJump(),
      turn: (dir, down) => {
        if (down) this.turnState.buttons = dir;
        else if (this.turnState.buttons === dir) this.turnState.buttons = 0;
      }
    });

    this.bindKeys();
    this.bindCanvas();

    this.state = 'title';
    this.resetRun();
    this.hud.showTitle(this.best());
  }

  // ---------------------------------------------------------------- lifecycle

  resetRun() {
    this.speed = BASE_SPEED;
    this.distance = 0;
    this.score = 0;
    this.lives = 3;
    this.shardCount = 0;
    this.invuln = 0;
    this.surge = 0;
    this.hitFlash = 0;
    this.shake = 0;
    this.deadTimer = 0;
    this.overlayShown = false;
    this.spawnAccum = 0;
    this.nextGap = 16;
    this.lastFree = this.player.theta;

    this.obstacles.clear();
    this.shards.clear();
    this.player.reset();

    this.hud.setScore(0);
    this.hud.setLives(3);
    this.hud.setShards(0, PRISM_NEED);
    this.hud.setSurge(false);
  }

  begin() {
    this.resetRun();
    this.state = 'playing';
    this.hud.hide();

    // Seed the first few gates so the run starts with something to read
    // instead of a four-second empty tunnel.
    this.emitPattern(-18);
    this.emitPattern(-33);
    this.emitPattern(-47);
    this.spawnAccum = 0;
    this.nextGap = this.gapFor();
  }

  primary() {
    if (this.state === 'title') {
      this.begin();
    } else if (this.state === 'dead') {
      this.game.start(GameScene);
    } else if (this.state === 'paused') {
      this.togglePause();
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.hide();
    }
  }

  die() {
    this.state = 'dead';
    this.deadTimer = 0;
    this.overlayShown = false;
    this.score = Math.floor(this.score);
    const best = this.best();
    if (this.score > best) this.saveBest(this.score);
    haptic('crash');
  }

  best() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // A private window refuses storage; the run still happens.
    }
  }

  // ------------------------------------------------------------------- frame

  update(dt) {
    this.time += dt;
    if (this.state === 'paused') return;

    const state = this.state;
    // Death is slow motion for a beat, so the player sees what caught them.
    const sdt = state === 'dead' ? dt * 0.3 : dt;
    const playing = state === 'playing';

    if (playing) {
      this.speed = Math.min(MAX_SPEED, this.speed + SPEED_GAIN * sdt);
    }
    const surgeBoost = this.surge > 0 ? 1.3 : 1;
    const speed = state === 'title' ? 9 : this.speed * surgeBoost;

    this.tunnel.update(sdt, speed);
    this.obstacles.update(sdt, speed);
    this.shards.update(sdt, speed);

    if (playing) {
      this.distance += speed * sdt;
      this.score += speed * sdt * (this.surge > 0 ? 1.8 : 0.9);
      this.hud.setScore(Math.floor(this.score));

      this.player.update(sdt, this.turnInput());

      const got = this.shards.take(this.player.theta, 0.3);
      if (got > 0) this.collect(got);

      if (this.invuln > 0) this.invuln -= sdt;
      if (this.surge > 0) {
        this.surge -= sdt;
        if (this.surge <= 0) this.hud.setSurge(false);
      }

      const hit = this.obstacles.hit(this.player.theta, this.player.r, speed * sdt);
      if (hit && this.invuln <= 0 && this.surge <= 0) this.damage();

      this.spawn(sdt, speed);
    } else {
      this.player.update(sdt, 0);
    }

    if (state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer > 0.55 && !this.overlayShown) {
        this.overlayShown = true;
        this.hud.showGameOver(this.score, Math.max(this.best(), this.score));
      }
    }

    if (this.hitFlash > 0) this.hitFlash -= dt;

    this.updateLook(sdt);
    this.applyCamera(dt);
  }

  collect(count) {
    this.shardCount += count;
    this.score += count * 14 * (this.surge > 0 ? 2 : 1);
    haptic('pickup');
    if (this.shardCount >= PRISM_NEED) {
      this.shardCount -= PRISM_NEED;
      this.surge = SURGE_TIME;
      this.hud.setSurge(true);
      haptic('power');
    }
    this.hud.setShards(this.shardCount, PRISM_NEED);
  }

  damage() {
    this.lives -= 1;
    this.hud.setLives(this.lives);
    this.invuln = 1.5;
    this.shake = 0.5;
    this.hitFlash = 0.45;
    haptic('impact');
    if (this.lives <= 0) this.die();
  }

  // ------------------------------------------------------------------ world

  gapFor() {
    const t = Math.min(1, this.distance / 900);
    return Math.max(8, this.speed * (1.3 - 0.45 * t)) + Math.random() * 4;
  }

  spawn(dt, speed) {
    this.spawnAccum += speed * dt;
    let guard = 0;
    while (this.spawnAccum >= this.nextGap && guard++ < 3) {
      this.spawnAccum -= this.nextGap;
      this.emitPattern(SPAWN_Z);
      this.nextGap = this.gapFor();
    }
  }

  /// One gate, built around an opening the player can actually reach from where
  /// the last one left them.
  emitPattern(z) {
    const t = Math.min(1, this.distance / 1100);
    const safe = wrap(this.lastFree + (Math.random() * 2 - 1) * 1.15);
    this.lastFree = safe;

    const tall = (angle, half) =>
      this.obstacles.add({
        angle: wrap(angle),
        half,
        height: 1.44,
        depth: 0.86,
        kind: 'tall',
        z
      });

    const roll = Math.random();
    if (roll < 0.3) {
      // A doorway: a ring with a gap in it.
      const gapHalf = 0.95 - 0.25 * t;
      const arcHalf = (Math.PI - gapHalf) / 2;
      tall(safe + gapHalf + arcHalf, arcHalf);
      tall(safe - gapHalf - arcHalf, arcHalf);
      this.shardLine(safe, z + 2.4, 2);
    } else if (roll < 0.56) {
      // One pillar, always opposite the opening the last gate offered.
      tall(safe + Math.PI, 0.36 + 0.12 * t);
      this.shardLine(safe, z + 2.6, 3);
    } else if (roll < 0.76) {
      // A gold bar across the floor: hop it.
      this.obstacles.add({
        angle: safe,
        half: 0.85,
        height: 0.72,
        depth: 0.86,
        kind: 'low',
        z
      });
      this.shardLine(safe, z + 2.6, 2);
    } else if (roll < 0.9) {
      // Two pillars, with one gap between them.
      tall(safe + 1.75, 0.45);
      tall(safe - 1.75, 0.45);
      this.shardLine(safe, z + 2.4, 3);
    } else {
      // A single narrow spike: a small, precise move.
      tall(safe, 0.15);
      this.shardLine(wrap(safe + 0.42), z + 2, 2);
    }
  }

  shardLine(angle, z, count) {
    for (let i = 0; i < count; i++) this.shards.spawn(angle, z + i * 1.7);
  }

  // ------------------------------------------------------------------ input

  turnInput() {
    let turn = 0;
    if (this.keys.has('left')) turn -= 1;
    if (this.keys.has('right')) turn += 1;
    if (turn !== 0) return turn;
    if (this.turnState.buttons !== 0) return this.turnState.buttons;
    return this.turnState.drag;
  }

  requestJump() {
    if (this.state !== 'playing') {
      this.primary();
      return;
    }
    if (this.player.jump()) haptic('hop');
  }

  bindKeys() {
    this.onKeyDown = (event) => {
      const code = event.code;
      const used = [
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
        'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyP', 'KeyR', 'Escape', 'Enter'
      ];
      if (used.includes(code)) event.preventDefault();
      if (event.repeat) return;

      switch (code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.add('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.add('right');
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          this.requestJump();
          break;
        case 'KeyR':
        case 'Enter':
          if (this.state !== 'playing') this.primary();
          break;
        case 'KeyP':
        case 'Escape':
          this.togglePause();
          break;
      }
    };

    this.onKeyUp = (event) => {
      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.keys.delete('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.keys.delete('right');
          break;
      }
    };

    // A key held while the window loses focus never sends its keyup, and the
    // cube would spin forever.
    this.onBlur = () => {
      this.keys.clear();
      this.turnState.buttons = 0;
      this.turnState.drag = 0;
      this.pointerId = null;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /// Drag anywhere on the world to spin; a tap leaps. Pointer events cover a
  /// finger and a mouse alike.
  bindCanvas() {
    const canvas = this.game.renderer.domElement;
    canvas.style.touchAction = 'none';

    this.onPointerDown = (event) => {
      if (this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.downX = event.clientX;
      this.downAt = performance.now();
      this.dragged = false;
      this.turnState.drag = 0;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best effort; the drag still works without it.
      }
    };

    this.onPointerMove = (event) => {
      if (event.pointerId !== this.pointerId) return;
      const dx = event.clientX - this.downX;
      if (Math.abs(dx) > 12) {
        this.dragged = true;
        this.turnState.drag = Math.sign(dx);
      } else {
        this.turnState.drag = 0;
      }
    };

    this.onPointerUp = (event) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.turnState.drag = 0;
      if (!this.dragged && performance.now() - this.downAt < 260) {
        this.requestJump();
      }
    };

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  // ------------------------------------------------------------------ camera

  /// The camera rolls with the player, so they always sit at the bottom of the
  /// screen and "right" always means right. The whole tunnel turns instead.
  applyCamera(dt) {
    const camera = this.game.camera;
    const theta = this.player.theta;
    camera.up.set(-Math.cos(theta), -Math.sin(theta), 0);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.7);
      const m = this.shake * 0.32;
      camera.position.set(
        (Math.random() - 0.5) * m,
        (Math.random() - 0.5) * m,
        CAM_BACK
      );
    } else {
      camera.position.set(0, 0, CAM_BACK);
    }
    camera.lookAt(0, 0, -30);
  }

  updateLook(dt) {
    const color = this.tintColor;
    if (this.hitFlash > 0) {
      const k = this.hitFlash * 2.2;
      color.setRGB(1 + k * 1.7, 1 - k * 0.75, 1 - k * 0.55);
    } else if (this.surge > 0) {
      color.setHSL((this.time * 0.55) % 1, 0.9, 0.6);
    } else {
      color.setRGB(1, 1, 1);
    }
    this.tunnel.tint(color);

    // Blink while invulnerable so it is obvious a hit was absorbed.
    this.player.group.visible =
      this.invuln <= 0 || Math.floor(this.time * 18) % 2 === 0;
  }

  resize(width, height) {
    // The tube is round, so a panel of any shape frames it; only a very narrow
    // one needs the camera pulled back to keep the walls off the edges.
    const camera = this.game.camera;
    camera.fov = height > width * 1.6 ? 70 : 62;
    camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);

    const canvas = this.game.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);

    this.hud.dispose();

    this.game.camera.up.set(0, 1, 0);
    this.game.camera.position.set(0, 3, 7);
  }
}
