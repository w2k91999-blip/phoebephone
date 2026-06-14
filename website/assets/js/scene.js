/* ===========================================================
   Phone Phoebe — 3D hero scene (Three.js, global build)
   A floating smartphone with soundwave rings pulsing out of it.
   Light theme: transparent background, soft indigo lighting.
   =========================================================== */
(function () {
  if (typeof THREE === 'undefined') return;
  var canvas = document.getElementById('scene');
  if (!canvas) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ACCENT = 0x6366f1;
  var ACCENT2 = 0x8b5cf6;

  var scene = new THREE.Scene();

  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  // ---- Lighting (soft, light-theme friendly) ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  var key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(4, 6, 8);
  scene.add(key);
  var fill = new THREE.PointLight(ACCENT2, 0.9, 40);
  fill.position.set(-6, -2, 6);
  scene.add(fill);
  var rim = new THREE.PointLight(ACCENT, 0.8, 40);
  rim.position.set(6, 4, -4);
  scene.add(rim);

  // ---- Group that holds everything (for float + parallax) ----
  var group = new THREE.Group();
  scene.add(group);

  // ---- Rounded-rectangle phone body via extruded shape ----
  function roundedRectShape(w, h, r) {
    var s = new THREE.Shape();
    var x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  var phone = new THREE.Group();

  var bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(2.5, 5, 0.55), {
    depth: 0.42, bevelEnabled: true, bevelThickness: 0.12,
    bevelSize: 0.12, bevelSegments: 6, curveSegments: 24
  });
  bodyGeo.center();
  var bodyMat = new THREE.MeshStandardMaterial({
    color: 0x141a2e, metalness: 0.85, roughness: 0.28
  });
  var body = new THREE.Mesh(bodyGeo, bodyMat);
  phone.add(body);

  // Screen (glowing indigo gradient feel via emissive)
  var screenGeo = new THREE.ExtrudeGeometry(roundedRectShape(2.18, 4.6, 0.42), {
    depth: 0.06, bevelEnabled: false, curveSegments: 24
  });
  screenGeo.center();
  var screenMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.55,
    metalness: 0.2, roughness: 0.5
  });
  var screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.32;
  phone.add(screen);

  // Camera notch / speaker bar
  var notchGeo = (typeof THREE.CapsuleGeometry === 'function')
    ? new THREE.CapsuleGeometry(0.05, 0.4, 4, 8)
    : new THREE.BoxGeometry(0.5, 0.1, 0.1);
  var notch = new THREE.Mesh(
    notchGeo,
    new THREE.MeshStandardMaterial({ color: 0x0b0f1c, roughness: 0.6 })
  );
  notch.rotation.z = Math.PI / 2;
  notch.position.set(0, 1.9, 0.36);
  phone.add(notch);

  // A "call" glyph floating on the screen (torus + sphere = handset vibe)
  var glyphMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3
  });
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 16, 48), glyphMat);
  ring.position.z = 0.4;
  phone.add(ring);
  var bead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), glyphMat);
  bead.position.set(0, 0, 0.45);
  phone.add(bead);

  phone.rotation.y = -0.35;
  phone.rotation.x = 0.12;
  group.add(phone);

  // ---- Soundwave rings emanating from the phone ----
  var waves = [];
  var WAVE_COUNT = 4;
  for (var i = 0; i < WAVE_COUNT; i++) {
    var wGeo = new THREE.TorusGeometry(1, 0.022, 12, 80);
    var wMat = new THREE.MeshBasicMaterial({
      color: i % 2 ? ACCENT2 : ACCENT, transparent: true, opacity: 0.5
    });
    var w = new THREE.Mesh(wGeo, wMat);
    w.rotation.x = 0.12;
    w.rotation.y = -0.35;
    w.userData.offset = i / WAVE_COUNT;
    group.add(w);
    waves.push(w);
  }

  // ---- Floating particles (depth + life) ----
  var pCount = 60;
  var pGeo = new THREE.BufferGeometry();
  var pPos = new Float32Array(pCount * 3);
  for (var p = 0; p < pCount; p++) {
    pPos[p * 3] = (Math.random() - 0.5) * 12;
    pPos[p * 3 + 1] = (Math.random() - 0.5) * 12;
    pPos[p * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    color: ACCENT2, size: 0.06, transparent: true, opacity: 0.55
  }));
  scene.add(particles);

  // ---- Sizing ----
  function resize() {
    var wrap = canvas.parentElement;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- Mouse parallax ----
  var targetX = 0, targetY = 0;
  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.5;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.4;
    });
  }

  // ---- Animation loop ----
  var t0 = performance.now();
  function frame(now) {
    var t = (now - t0) / 1000;

    if (!reduce) {
      group.position.y = Math.sin(t * 1.1) * 0.18;
      phone.rotation.y = -0.35 + Math.sin(t * 0.6) * 0.12 + targetX;
      phone.rotation.x = 0.12 + targetY;
      ring.rotation.z = t * 0.4;
      particles.rotation.y = t * 0.03;

      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        var prog = (t * 0.45 + w.userData.offset) % 1;       // 0..1 expand cycle
        var sc = 0.6 + prog * 3.2;
        w.scale.set(sc, sc, sc);
        w.material.opacity = Math.max(0, 0.55 * (1 - prog));
        w.rotation.y = -0.35 + targetX;
        w.rotation.x = 0.12 + targetY;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
