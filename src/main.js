// Entry point: the renderer, the camera and the frame loop, and nothing else.
// Gameplay lives in scenes under src/scenes/.

import * as THREE from 'three';
import { SceneManager } from './scene.js';
import { GameScene } from './scenes/GameScene.js';
import { registerIcons } from './icons.js';

// Every symbol the interface asks for, published once as CSS variables.
registerIcons(['play', 'pause', 'refresh-ccw', 'rotate-ccw', 'rotate-cw', 'arrow-up']);

const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

// Phones report a device pixel ratio of 3, which means rendering nine times the
// pixels for a difference nobody can see and a frame rate everybody can.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x05060f);
stage.appendChild(renderer.domElement);

// The whole game is seen down the axis of a tube, so the camera sits on it.
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 240);
camera.position.set(0, 0, 6.4);
camera.lookAt(0, 0, -10);

// On window so the running game can be inspected from outside the module graph.
window.game = new SceneManager(renderer, camera, stage);
window.game.start(GameScene);
window.game.run();
