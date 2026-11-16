import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface ThreeStudioContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  isSoftwareGl: boolean;
  envTexture: THREE.Texture;
  cleanup: () => void;
  start: (onFrame: (delta: number, elapsed: number) => void) => () => void;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createStudioContext(
  container: HTMLElement,
  options: {
    fov?: number;
    near?: number;
    far?: number;
    bgColor?: number;
    fogNear?: number;
    fogFar?: number;
  } = {}
): ThreeStudioContext {
  const {
    fov = 58,
    near = 0.1,
    far = 200,
    bgColor = 0x070a14,
    fogNear = 18,
    fogFar = 95,
  } = options;

  const isSoftwareGl = detectSoftwareWebGL();
  const width = Math.max(container.clientWidth || 320, 260);
  const height = Math.max(container.clientHeight || 360, 240);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, fogNear, fogFar);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(fov, width / height, near, far);

  // Balanced 3-point studio lighting
  const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.55);
  keyLight.position.set(10, 18, 12);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -16;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
  rimLight.position.set(-12, 8, -14);
  scene.add(rimLight);

  const handleResize = () => {
    if (!container) return;
    const w = Math.max(container.clientWidth || width, 200);
    const h = Math.max(container.clientHeight || height, 200);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  const start = (onFrame: (delta: number, elapsed: number) => void) => {
    let active = true;
    let frameId = 0;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      if (!active) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (!active) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (!active) return;
      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      onFrame(delta, elapsed);
      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      renderer.compile(scene, camera);
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
  };

  const cleanup = () => {
    resizeObserver.disconnect();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    envTexture.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { renderer, scene, camera, isSoftwareGl, envTexture, cleanup, start };
}

export function makeCanvasTexture(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;
  return texture;
}

export function buildSportsCar(primaryColor: number, accentColor: number): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    metalness: 0.65,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.35,
    roughness: 0.65,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x020617,
    metalness: 0.9,
    roughness: 0.08,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
  });

  // Lower chassis (bottom at y = 0.18 above wheel axle)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.38, 2.7), bodyMat);
  chassis.position.set(0, 0.42, 0);
  chassis.castShadow = true;
  group.add(chassis);

  // Cabin canopy
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 1.35), glassMat);
  cabin.position.set(0, 0.76, 0.12);
  cabin.castShadow = true;
  group.add(cabin);

  // Hood stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 2.66), glowMat);
  stripe.position.set(0, 0.62, 0);
  group.add(stripe);

  // Rear spoiler wing + struts
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.32), trimMat);
  wing.position.set(0, 0.88, 1.15);
  group.add(wing);

  // Front headlights
  const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), headlightMat);
  hlLeft.position.set(-0.48, 0.44, -1.36);
  const hlRight = hlLeft.clone();
  hlRight.position.x = 0.48;
  group.add(hlLeft, hlRight);

  // Rear tail light bar
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 0.08), new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xf43f5e,
    emissiveIntensity: 1.5,
  }));
  tailBar.position.set(0, 0.48, 1.36);
  group.add(tailBar);

  // 4 Wheels grounded at y = 0
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.74, 0.28, -0.82],
    [0.74, 0.28, -0.82],
    [-0.74, 0.28, 0.82],
    [0.74, 0.28, 0.82],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, trimMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    group.add(wheel);
  }

  return group;
}

export function buildStarfighter(hullColor: number, glowColor: number): THREE.Group {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: hullColor,
    metalness: 0.72,
    roughness: 0.25,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.4,
    roughness: 0.65,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 1.8,
  });

  // Main nose cone fuselage
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.9, 8), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.35, -0.2);
  group.add(nose);

  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.72), new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.9,
    roughness: 0.1,
  }));
  canopy.position.set(0, 0.56, 0.1);
  group.add(canopy);

  // Swept delta wings
  const wingGeo = new THREE.BoxGeometry(2.3, 0.08, 0.85);
  const wings = new THREE.Mesh(wingGeo, darkMat);
  wings.position.set(0, 0.32, 0.32);
  group.add(wings);

  // Wingtip cannons
  const cannonGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8);
  cannonGeo.rotateX(Math.PI / 2);
  const leftCannon = new THREE.Mesh(cannonGeo, glowMat);
  leftCannon.position.set(-1.05, 0.36, 0.05);
  const rightCannon = leftCannon.clone();
  rightCannon.position.x = 1.05;
  group.add(leftCannon, rightCannon);

  // Twin afterburners
  const thrusterGeo = new THREE.CylinderGeometry(0.14, 0.09, 0.45, 10);
  thrusterGeo.rotateX(Math.PI / 2);
  const leftThrust = new THREE.Mesh(thrusterGeo, glowMat);
  leftThrust.position.set(-0.24, 0.34, 0.85);
  const rightThrust = leftThrust.clone();
  rightThrust.position.x = 0.24;
  group.add(leftThrust, rightThrust);

  return group;
}

export function buildBowlingPin(): THREE.Group {
  const group = new THREE.Group();
  const points = [
    new THREE.Vector2(0.0, 0),
    new THREE.Vector2(0.15, 0),
    new THREE.Vector2(0.21, 0.25),
    new THREE.Vector2(0.20, 0.5),
    new THREE.Vector2(0.10, 0.82),
    new THREE.Vector2(0.11, 0.98),
    new THREE.Vector2(0.14, 1.15),
    new THREE.Vector2(0.09, 1.32),
    new THREE.Vector2(0.0, 1.38),
  ];
  const latheGeo = new THREE.LatheGeometry(points, 18);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
  });
  const body = new THREE.Mesh(latheGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Red neck collar stripe
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.108, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
  );
  stripe.position.y = 0.88;
  group.add(stripe);

  return group;
}

export function build3DCoin(): THREE.Group {
  const group = new THREE.Group();
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xb45309,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.18,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20), coinMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.04, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.7 })
  );
  group.add(innerRing);

  return group;
}
