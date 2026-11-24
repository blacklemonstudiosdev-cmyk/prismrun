// The endless voxel tube the run happens inside.
//
// Every block of the tunnel is one instance in a single InstancedMesh — 78 rings
// of 24 cubes is close to two thousand boxes in one draw call. The rings ride a
// group that slides toward the player, and a ring that passes behind the camera
// is teleported to the far end and repainted, so the tube has no end.

import * as THREE from 'three';
import { TUBE_RADIUS, VOXEL } from './config.js';

const RING_COUNT = 78;
const SLICE = 0.9;
const BLOCKS = 24;
const NEAR_Z = 6;
const RECYCLE_Z = 7.6;
const SPAN = RING_COUNT * SLICE;

// The tunnel's palette: deep indigo voxels with rare neon ones, so the walls
// shimmer the way the game's icon does.
const BASE = ['#151a3d', '#1b2350', '#241c55', '#1a2458', '#1d1745', '#181e42'];
const ACCENT = ['#ff2e88', '#ffc23d', '#3d7bff', '#38f0ff', '#a35cff'];

/// A stable pseudo-random number for a ring and a block.
function noise(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class Tunnel {
  constructor(root) {
    this.group = new THREE.Group();
    root.add(this.group);

    // Each ring remembers where it sits along the tube and which "slot" paints
    // it. Slots count up forever, so a repainted ring never repeats.
    this.ringZ = new Float32Array(RING_COUNT);
    this.slot = new Int32Array(RING_COUNT);
    for (let i = 0; i < RING_COUNT; i++) {
      this.ringZ[i] = NEAR_Z - i * SLICE;
      this.slot[i] = i;
    }
    this.topSlot = RING_COUNT;
    this.rear = 0;

    const geometry = new THREE.BoxGeometry(VOXEL, VOXEL, SLICE * 0.95);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, RING_COUNT * BLOCKS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The tube fills the frame, so its bounding sphere is meaningless — and
    // culling the whole thing one frame early would empty the screen.
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();

    for (let i = 0; i < RING_COUNT; i++) this.paintRing(i);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /// Lays one ring of voxels out along the tube and colours it.
  paintRing(index) {
    const slot = this.slot[index];
    const z = this.ringZ[index];
    const band = slot % 9 === 0;
    const radius = TUBE_RADIUS + VOXEL * 0.5;

    for (let b = 0; b < BLOCKS; b++) {
      const angle = (b / BLOCKS) * Math.PI * 2;
      this.dummy.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        z
      );
      // Local +y is each voxel's radial axis, so the ring's blocks point at the
      // tube's centre instead of standing square to the world.
      this.dummy.rotation.set(0, 0, angle - Math.PI / 2);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index * BLOCKS + b, this.dummy.matrix);

      const n = noise(slot, b);
      if (n < (band ? 0.16 : 0.05)) {
        this.color.set(ACCENT[(slot + b) % ACCENT.length]);
        this.color.multiplyScalar(0.4 + n * 2.4);
      } else {
        this.color.set(BASE[(slot + b * 3) % BASE.length]);
        this.color.multiplyScalar((0.72 + n * 0.8) * (band ? 1.45 : 1));
      }
      this.mesh.setColorAt(index * BLOCKS + b, this.color);
    }
  }

  /// `speed` is world units per second, `dt` is seconds.
  update(dt, speed) {
    this.group.position.z += speed * dt;

    // The rear-most ring is the one nearest the camera; once it is behind the
    // lens it wraps to the far end of the tube.
    let repainted = false;
    while (this.ringZ[this.rear] + this.group.position.z > RECYCLE_Z) {
      const i = this.rear;
      this.ringZ[i] -= SPAN;
      this.slot[i] = ++this.topSlot;
      this.paintRing(i);
      this.rear = (this.rear + 1) % RING_COUNT;
      repainted = true;
    }

    if (repainted) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  /// Tints every voxel at once — the surge washes the whole tube through the
  /// spectrum and a hit flushes it red, both without touching an instance.
  tint(color) {
    this.mesh.material.color.copy(color);
  }
}
