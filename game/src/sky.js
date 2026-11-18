// The sky: a big gradient dome shader (blue zenith, warm horizon, sun disc
// with glow, haze), soft procedural clouds drifting overhead, and warm fog.
// This is what makes the city read as a real golden-hour afternoon.
import * as THREE from 'three';
import { cloudTexture } from './textures.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // pin the dome to the far plane
}
`;

const SKY_FRAG = /* glsl */`
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 mid;
uniform vec3 horizon;
void main() {
  float h = clamp(vDir.y, -0.08, 1.0);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
  col = mix(col, zenith, smoothstep(0.24, 0.85, h));
  // Warm band hugging the horizon, strongest near the sun's azimuth.
  float sunAmount = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += vec3(1.0, 0.55, 0.22) * pow(sunAmount, 6.0) * 0.35 * (1.0 - smoothstep(0.0, 0.5, h));
  // Sun disc + halo.
  col += vec3(1.0, 0.85, 0.6) * smoothstep(0.9993, 0.9997, sunAmount) * 2.4;
  col += vec3(1.0, 0.7, 0.4) * pow(sunAmount, 90.0) * 0.55;
  // Fine haze near the horizon.
  col = mix(col, horizon, (1.0 - smoothstep(-0.02, 0.16, h)) * 0.55);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Build the sky dome, sun + hemisphere lights and drifting clouds.
// Returns { update(dt, elapsed) }.
export function createSky(scene, rng) {
  const sunDir = new THREE.Vector3(-0.55, 0.52, -0.72).normalize();

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      sunDir: { value: sunDir },
      zenith: { value: new THREE.Color(0x2f6fb8) },
      mid: { value: new THREE.Color(0x7fb2dd) },
      horizon: { value: new THREE.Color(0xf7b06a) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 18), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // Warm golden-hour sun.
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.7);
  sun.position.copy(sunDir).multiplyScalar(320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  // Cool sky bounce + warm ground bounce.
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x8a6f52, 1.2);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffe0b8, 0.4);
  scene.add(amb);

  // Warm haze so distant blocks melt into the horizon.
  scene.fog = new THREE.Fog(0xe8b98a, 260, 1100);

  // Soft procedural clouds: radial-gradient sprites at several heights.
  const clouds = [];
  const tex = cloudTexture(rng);
  for (let i = 0; i < 11; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: rng.range(0.5, 0.85),
      depthWrite: false,
      fog: false,
    });
    const s = new THREE.Sprite(mat);
    const w = rng.range(180, 420);
    s.scale.set(w, w * 0.42, 1);
    s.position.set(rng.range(-900, 900), rng.range(180, 380), rng.range(-900, 900));
    s.userData.drift = rng.range(1.2, 3.4);
    scene.add(s);
    clouds.push(s);
  }

  return {
    sun,
    sunDir,
    update(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 1000) c.position.x = -1000;
      }
      // Keep the dome centred on the camera so it never clips.
      sky.position.copy(scene.userData.cameraPosition || new THREE.Vector3());
    },
  };
}
