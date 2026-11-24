// The cube the player drives.
//
// In a tube there is no gravity "down": the player is stuck to the wall and
// moves along the tube's angle, and a leap pulls it toward the axis and lets it
// fall back out. That is three numbers — angle, radius, radial velocity — which
// makes the whole thing impossible to break and easy to tune.

import * as THREE from 'three';
import {
  PLAYER_SIZE,
  REST_RADIUS,
  GRAVITY,
  JUMP_SPEED,
  MAX_TURN
} from './config.js';

/// How quickly the spin follows the controls. High enough to feel direct, low
/// enough that the cube carries a little momentum into a corner.
const RESPONSE = 17;

export class Player {
  constructor(root) {
    this.group = new THREE.Group();

    this.core = new THREE.Mesh(
      new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
      new THREE.MeshLambertMaterial({
        color: 0x9df6ff,
        emissive: 0x22708f
      })
    );

    // A wireframe cage a whisker larger than the cube. It needs no light, so it
    // is what keeps the player visible against the dark tube.
    this.glow = new THREE.Mesh(
      new THREE.BoxGeometry(PLAYER_SIZE * 1.2, PLAYER_SIZE * 1.2, PLAYER_SIZE * 1.2),
      new THREE.MeshBasicMaterial({
        color: 0x38f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      })
    );

    this.group.add(this.core, this.glow);
    root.add(this.group);

    this.spin = 0;
    this.reset();
  }

  reset() {
    this.theta = -Math.PI / 2;
    this.r = REST_RADIUS;
    this.omega = 0;
    this.vr = 0;
    this.grounded = true;
    this.place();
    this.core.rotation.set(0, 0, 0);
    this.glow.rotation.set(0, 0, 0);
  }

  /// Leaves the wall. Returns false if the cube is already in the air, so the
  /// caller can decide what a wasted press should do.
  jump() {
    if (!this.grounded) return false;
    this.vr = -JUMP_SPEED;
    this.grounded = false;
    return true;
  }

  /// How far the cube has lifted off the wall, in world units.
  get leap() {
    return REST_RADIUS - this.r;
  }

  /// `turn` is -1, 0 or 1.
  update(dt, turn) {
    const target = turn * MAX_TURN;
    this.omega += (target - this.omega) * (1 - Math.exp(-RESPONSE * dt));

    this.theta += this.omega * dt;
    if (this.theta > Math.PI) this.theta -= Math.PI * 2;
    else if (this.theta < -Math.PI) this.theta += Math.PI * 2;

    if (!this.grounded) {
      this.vr += GRAVITY * dt;
      this.r += this.vr * dt;
      if (this.r >= REST_RADIUS) {
        this.r = REST_RADIUS;
        this.vr = 0;
        this.grounded = true;
      }
    }

    this.spin += (1.4 + Math.abs(this.omega) * 0.45) * dt;
    this.place();
    this.core.rotation.set(this.spin * 0.32, this.spin * 0.48, this.spin);
    this.glow.rotation.set(-this.spin * 0.36, this.spin * 0.28, -this.spin * 0.8);
  }

  place() {
    this.group.position.set(
      Math.cos(this.theta) * this.r,
      Math.sin(this.theta) * this.r,
      0
    );
  }
}
