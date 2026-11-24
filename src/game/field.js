// Obstacles and prisms.
//
// Obstacles are wedges of voxels growing in from the tunnel wall. Because the
// tube is a circle, a hit test is two cheap comparisons: is the player close
// enough in, and does its angle overlap the wedge's? No physics, no raycasts,
// and nothing that can slip between two frames.

import * as THREE from 'three';
import { TUBE_RADIUS, VOXEL, PLAYER_HALF } from './config.js';

const MAX_INSTANCES = 620;
const REACH = 9;

const TALL_COLOR = new THREE.Color('#ff2e6e');
const LOW_COLOR = new THREE.Color('#ffc23d');

/// The shortest way round the circle from a to b.
export function angleDelta(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

export class ObstacleField {
  constructor(root) {
    this.list = [];
    this.used = 0;
    this.dummy = new THREE.Object3D();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Blocks fill the frame, so the mesh's own bounding sphere is useless —
    // culling it would empty the screen.
    this.mesh.frustumCulled = false;
    // One colour up front so the buffer exists before the first compile: an
    // instanceColor added later would need the material rebuilt.
    this.mesh.setColorAt(0, TALL_COLOR);
    this.mesh.count = 0;
    root.add(this.mesh);
  }

  /// A wedge growing in from the wall. `half` is its half-width in radians,
  /// `height` how far in from the wall it reaches, `depth` how far along.
  add({ angle, half, height, depth, kind, z }) {
    const nx = Math.max(1, Math.round((2 * half * TUBE_RADIUS) / VOXEL));
    const m = Math.max(1, Math.round(height / VOXEL));
    const nz = Math.max(1, Math.round(depth / VOXEL));
    const cost = nx * m * nz;
    if (this.used + cost > MAX_INSTANCES) return;

    this.list.push({
      angle,
      half,
      kind,
      z,
      nx,
      m,
      nz,
      stepA: (2 * half) / nx,
      vox: (2 * half * TUBE_RADIUS) / nx,
      depth: nz * VOXEL,
      // Shallower than the art, so a graze is not a hit. A gold bar sits well
      // inside every leap; a magenta wall reaches further in than the cube can
      // ever lift, so the only way past it is round.
      collideH: kind === 'low' ? Math.min(m * VOXEL - 0.16, 0.52) : m * VOXEL - 0.04
    });
    this.used += cost;
  }

  update(dt, speed) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.z += speed * dt;
      if (o.z > REACH) this.list.splice(i, 1);
    }
    this.fill();
  }

  /// Rebuilds every live instance. A few hundred matrix composes on the worst
  /// frame, which is far cheaper than tracking pooled slots by hand.
  fill() {
    let idx = 0;
    for (const o of this.list) {
      if (idx >= MAX_INSTANCES) break;
      const color = o.kind === 'low' ? LOW_COLOR : TALL_COLOR;

      for (let i = 0; i < o.nx && idx < MAX_INSTANCES; i++) {
        const angle = o.angle + (i + 0.5 - o.nx / 2) * o.stepA;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        for (let j = 0; j < o.m && idx < MAX_INSTANCES; j++) {
          const radius = TUBE_RADIUS - (j + 0.5) * VOXEL;

          for (let k = 0; k < o.nz && idx < MAX_INSTANCES; k++) {
            this.dummy.position.set(
              ca * radius,
              sa * radius,
              o.z + (k + 0.5 - o.nz / 2) * VOXEL
            );
            this.dummy.rotation.set(0, 0, angle - Math.PI / 2);
            this.dummy.scale.set(o.vox * 0.96, VOXEL * 0.96, VOXEL * 0.96);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(idx, this.dummy.matrix);
            this.mesh.setColorAt(idx, color);
            idx++;
          }
        }
      }
    }

    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /// The obstacle the player is inside right now, or null. `dz` is how far the
  /// world moved this frame, so a slow frame cannot skip a thin wall.
  hit(theta, r, dz) {
    const reach = dz * 0.5 + 0.26;
    for (const o of this.list) {
      if (o.z < -o.depth * 0.5 - reach || o.z > o.depth * 0.5 + reach) continue;
      if (r + PLAYER_HALF < TUBE_RADIUS - o.collideH) continue;
      if (Math.abs(angleDelta(theta, o.angle)) < o.half + 0.12) return o;
    }
    return null;
  }

  clear() {
    this.list.length = 0;
    this.used = 0;
    this.mesh.count = 0;
  }
}

export class ShardField {
  constructor(root) {
    this.geometry = new THREE.OctahedronGeometry(0.27, 0);
    this.material = new THREE.MeshLambertMaterial({
      color: 0x6ffbff,
      emissive: 0x1c8fa6
    });

    this.pool = [];
    this.active = [];
    for (let i = 0; i < 42; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.visible = false;
      mesh.userData.angle = 0;
      mesh.userData.pop = 0;
      root.add(mesh);
      this.pool.push(mesh);
    }
  }

  /// Prisms float just in from the wall, a little above the cube's path.
  spawn(angle, z) {
    const mesh = this.pool.find((m) => !m.visible);
    if (!mesh) return;
    const radius = TUBE_RADIUS - 0.75;
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    mesh.scale.setScalar(1);
    mesh.userData.angle = angle;
    mesh.userData.pop = 0;
    mesh.visible = true;
    this.active.push(mesh);
  }

  update(dt, speed) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const mesh = this.active[i];
      mesh.position.z += speed * dt;
      mesh.rotation.y += dt * 2.6;
      mesh.rotation.x += dt * 1.7;

      if (mesh.userData.pop > 0) {
        mesh.userData.pop -= dt;
        const t = 1 - Math.max(0, mesh.userData.pop) / 0.2;
        mesh.scale.setScalar(1 + t * 1.8);
        if (mesh.userData.pop <= 0) {
          mesh.visible = false;
          this.active.splice(i, 1);
          continue;
        }
      }

      if (mesh.position.z > REACH) {
        mesh.visible = false;
        this.active.splice(i, 1);
      }
    }
  }

  /// Collects everything the player is passing through. Returns how many.
  take(theta, halfAngle) {
    let count = 0;
    for (const mesh of this.active) {
      if (mesh.userData.pop > 0) continue;
      if (Math.abs(mesh.position.z) > 0.62) continue;
      if (Math.abs(angleDelta(theta, mesh.userData.angle)) > halfAngle) continue;
      mesh.userData.pop = 0.2;
      count++;
    }
    return count;
  }

  clear() {
    for (const mesh of this.active) mesh.visible = false;
    this.active.length = 0;
  }
}
