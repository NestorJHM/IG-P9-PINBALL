import * as THREE from "./lib/three/three.module.js";
import * as TWEEN from "./lib/tween/tween.esm.js";

let Ammo, scene, camera, renderer, physicsWorld, transformAux, vectorAux;
let bola, jugando = false, puntos = 0, anterior = performance.now();
const rigidBodies = [], paletas = [], reboteadores = [];
const teclas = new Set();
const tweens = new TWEEN.Group();

const posicionLanzamiento = new THREE.Vector3(4.35, 0.32, 7.5);
const estado = document.getElementById("estado");
const botonLanzar = document.getElementById("lanzar");

window.Ammo().then((lib) => {
  Ammo = lib;
  initGraphics();
  initPhysics();
  createObjects();
  initInput();
  nuevaPartida();
  anterior = performance.now();
  animationLoop();
}).catch((error) => {
  estado.textContent = "No se pudo iniciar el juego. Recarga la página para intentarlo de nuevo.";
  console.error(error);
});

function initGraphics() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x160a28);
  camera = new THREE.OrthographicCamera(-7, 7, 9, -9, 0.1, 100);
  camera.position.set(0, 20, 18);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const contenedor = document.getElementById("escena");
  contenedor.appendChild(renderer.domElement);
  new ResizeObserver(() => {
    const ancho = contenedor.clientWidth, alto = contenedor.clientHeight;
    const mitad = 9;
    camera.left = -mitad * ancho / alto;
    camera.right = mitad * ancho / alto;
    camera.top = mitad;
    camera.bottom = -mitad;
    camera.updateProjectionMatrix();
    renderer.setSize(ancho, alto, false);
  }).observe(contenedor);

  scene.add(new THREE.HemisphereLight(0xd9ecff, 0x172330, 2.2));
  const luz = new THREE.DirectionalLight(0xffffff, 2.8);
  luz.position.set(-5, 14, 8);
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  Object.assign(luz.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
  luz.shadow.normalBias = 0.03;
  scene.add(luz);

  // Animación inicial visual de la mesa.
  const entrada = new TWEEN.Tween(camera.position, tweens)
    .to({ z: 13 }, 1300)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onUpdate(() => camera.lookAt(0, 0, 0))
    .onComplete(() => tweens.remove(entrada));
  entrada.start();
}

function initPhysics() {
  const configuracion = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(configuracion);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuracion);
  // La componente Z (7.0) representa la inclinación del tablero hacia el jugador.
  const gravedad = new Ammo.btVector3(0, -9.8, 7.0);
  physicsWorld.setGravity(gravedad);
  Ammo.destroy(gravedad);
  transformAux = new Ammo.btTransform();
  vectorAux = new Ammo.btVector3(0, 0, 0);
}

function material(color, metalness = 0.15) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.4 });
}

function Cubo(x, y, z, sx, sy, sz, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createObjects() {
  // Colores de recreativa de los 80.
  const azul = material(0x2635d0), borde = material(0xffbd00, 0.25);
  const oscuro = material(0x7c164f), cian = material(0x00dfff);
  const rosa = material(0xff1686), amarillo = material(0xffe600);
  Cubo(0, -0.65, 0, 10.8, 0.9, 18, oscuro);
  const suelo = Cubo(0, -0.2, 0, 10.2, 0.4, 17.8, azul);
  createBoxBody(suelo, 10.2, 0.4, 17.8, 0);

  // Bordes y canal de lanzamiento a la derecha.
  crearRail(-5, -8, -5, 8, borde);
  crearRail(5, -8, 5, 8, borde);
  crearRail(-5, -8, 5, -8, borde);
  crearRail(3.7, -4.5, 3.7, 8, borde, 0.2);
  crearRail(3.7, 8, 5, 8, borde, 0.3, 0.4);
  crearRail(3.8, -7.8, 5, -6.6, borde);
  // Guías que conducen la bola hacia las palas y el hueco de fin de partida.
  crearRail(-5, 3.3, -2.9, 5.35, borde);
  crearRail(3.7, 3.4, 2.5, 5.35, borde);
  crearRail(-5, 8, -1.05, 8.5, borde);
  crearRail(3.7, 8, 0.65, 8.5, borde);

  crearPaleta(-2.55, 5.7, 1, cian, "izquierda");
  crearPaleta(2.15, 5.7, -1, rosa, "derecha");
  crearReboteador(-1.9, -2.9, cian);
  crearReboteador(0.9, -3.5, rosa);
  crearReboteador(-0.35, -0.4, amarillo);

  // Decoración.
  for (let x of [-4.4, 4.4]) {
    for (let z of [-6, 6]) Cubo(x, -1.8, z, 0.35, 2, 0.35, borde);
  }
  for (let x of [-4.65, 4.65]) Cubo(x, 0.04, 0, 0.04, 0.04, 14.8, cian);

  bola = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), material(0xe8f1f6, 0.8));
  bola.castShadow = true;
  bola.position.copy(posicionLanzamiento);
  const shape = new Ammo.btSphereShape(0.32);
  const body = createRigidBody(bola, shape, 0.7);
  body.setUserIndex(1);
  body.setFriction(0.05);
  body.setRestitution(0.65);
  body.setDamping(0.035, 0.1);
  body.setCcdMotionThreshold(0.15);
  body.setCcdSweptSphereRadius(0.25);
}

function createBoxBody(mesh, sx, sy, sz, masa) {
  const medidas = new Ammo.btVector3(sx / 2, sy / 2, sz / 2);
  const shape = new Ammo.btBoxShape(medidas);
  shape.setMargin(0.02);
  Ammo.destroy(medidas);
  return createRigidBody(mesh, shape, masa);
}

function createRigidBody(mesh, shape, masa) {
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const pos = mesh.position, quat = mesh.quaternion;
  const origen = new Ammo.btVector3(pos.x, pos.y, pos.z);
  const rotacion = new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w);
  transform.setOrigin(origen);
  transform.setRotation(rotacion);
  const motionState = new Ammo.btDefaultMotionState(transform);
  const inercia = new Ammo.btVector3(0, 0, 0);
  if (masa > 0) shape.calculateLocalInertia(masa, inercia);
  const info = new Ammo.btRigidBodyConstructionInfo(masa, motionState, shape, inercia);
  const body = new Ammo.btRigidBody(info);
  body.setFriction(0.2);
  body.setRestitution(0.6);
  mesh.userData.physicsBody = body;
  physicsWorld.addRigidBody(body);
  if (masa > 0) {
    body.setActivationState(4);
    rigidBodies.push(mesh);
  }
  scene.add(mesh);
  // Se destruyen los objetos temporales de Ammo.js para liberar memoria.  
  [transform, origen, rotacion, inercia, info].forEach((obj) => Ammo.destroy(obj));
  return body;
}

function crearRail(x1, z1, x2, z2, mat, grosor = 0.3, alto = 0.9) {
  const largo = Math.hypot(x2 - x1, z2 - z1);
  const rail = Cubo((x1 + x2) / 2, alto / 2 + 0.03, (z1 + z2) / 2, largo, alto, grosor, mat);
  rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  createBoxBody(rail, largo, alto, grosor, 0);
}

function crearPaleta(x, z, lado, mat, tecla) {
  const largo = 2;
  const mesh = Cubo(x + lado * largo / 2, 0.32, z, largo, 0.42, 0.46, mat);
  const body = createBoxBody(mesh, largo, 0.42, 0.46, 2);
  // El anclaje redondo cubre la esquina del pivote y evita que atrape la bola.
  const ancla = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 20), mat);
  ancla.position.set(x, 0.32, z);
  const medidas = new Ammo.btVector3(0.3, 0.25, 0.3);
  const fijo = createRigidBody(ancla, new Ammo.btCylinderShape(medidas), 0);
  Ammo.destroy(medidas);
  const pivote = new Ammo.btVector3(-lado * largo / 2, 0, 0);
  const cero = new Ammo.btVector3(0, 0, 0);
  const eje = new Ammo.btVector3(0, 1, 0);
  const hinge = new Ammo.btHingeConstraint(body, fijo, pivote, cero, eje, eje, true);
  hinge.setLimit(lado === 1 ? -0.55 : -0.35, lado === 1 ? 0.35 : 0.55, 0.9, 0.3, 1);
  physicsWorld.addConstraint(hinge, true);
  paletas.push({ mesh, body, hinge, lado, tecla });
  [pivote, cero, eje].forEach((obj) => Ammo.destroy(obj));
}

function crearReboteador(x, z, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.7, 24), mat);
  mesh.position.set(x, 0.4, z);
  mesh.castShadow = true;
  const medidas = new Ammo.btVector3(0.72, 0.35, 0.72);
  const body = createRigidBody(mesh, new Ammo.btCylinderShape(medidas), 0);
  body.setUserIndex(10 + reboteadores.length);
  Ammo.destroy(medidas);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.07, 8, 32),
    new THREE.MeshBasicMaterial({ color: mat.color }));
  aro.rotation.x = -Math.PI / 2;
  aro.position.set(x, 0.79, z);
  scene.add(aro);
  reboteadores.push({ mesh, aro, ultimoGolpe: -Infinity, tween: null });
}

function colocarBola() {
  const body = bola.userData.physicsBody;
  transformAux.setIdentity();
  vectorAux.setValue(posicionLanzamiento.x, posicionLanzamiento.y, posicionLanzamiento.z);
  transformAux.setOrigin(vectorAux);
  body.setWorldTransform(transformAux);
  body.getMotionState().setWorldTransform(transformAux);
  vectorAux.setValue(0, 0, 0);
  body.setLinearVelocity(vectorAux);
  body.setAngularVelocity(vectorAux);
  body.setLinearFactor(vectorAux);
  body.clearForces();
  body.activate();
  bola.position.copy(posicionLanzamiento);
  bola.quaternion.identity();
  bola.visible = true;
}

function nuevaPartida() {
  jugando = false;
  puntos = 0;
  teclas.clear();
  document.getElementById("puntos").textContent = "000000";
  colocarBola();
  for (let reboteador of reboteadores) {
    if (reboteador.tween) { reboteador.tween.stop(); tweens.remove(reboteador.tween); }
    reboteador.aro.scale.setScalar(1);
    reboteador.ultimoGolpe = -Infinity;
  }
  estado.textContent = "Bola lista. Pulsa espacio para comenzar.";
  document.querySelectorAll("button").forEach((boton) => { boton.disabled = false; });
}

function lanzarBola() {
  if (jugando && !enCanal()) return;
  colocarBola();
  vectorAux.setValue(1, 0, 1);
  bola.userData.physicsBody.setLinearFactor(vectorAux);
  vectorAux.setValue(0, 0, -24);
  bola.userData.physicsBody.setLinearVelocity(vectorAux);
  jugando = true;
  botonLanzar.disabled = true;
  estado.textContent = "Bola en juego. ¡Atento a las paletas!";
}

function enCanal() {
  return bola.position.x > 4 && bola.position.z > 6 &&
    bola.userData.physicsBody.getLinearVelocity().z() > -1;
}

function initInput() {
  window.addEventListener("keydown", (event) => {
    if (!["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "Space", "KeyR"].includes(event.code)) return;
    event.preventDefault();
    teclas.add(event.code);
    if (event.repeat) return;
    if (event.code === "Space") lanzarBola();
    if (event.code === "KeyR") nuevaPartida();
  });
  window.addEventListener("keyup", (event) => teclas.delete(event.code));
  window.addEventListener("blur", () => teclas.clear());
  document.addEventListener("visibilitychange", () => { teclas.clear(); anterior = performance.now(); });
  for (let lado of ["izquierda", "derecha"]) {
    const boton = document.getElementById(lado);
    boton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      boton.setPointerCapture(event.pointerId);
      teclas.add(lado);
    });
    for (let evento of ["pointerup", "pointercancel", "lostpointercapture"]) {
      boton.addEventListener(evento, () => teclas.delete(lado));
    }
  }
  botonLanzar.addEventListener("click", lanzarBola);
  document.getElementById("reiniciar").addEventListener("click", nuevaPartida);
}

function updatePhysics(deltatime) {
  for (let paleta of paletas) {
    const codigo = paleta.lado === 1 ? "KeyA" : "KeyD";
    const flecha = paleta.lado === 1 ? "ArrowLeft" : "ArrowRight";
    const pulsada = teclas.has(codigo) || teclas.has(flecha) || teclas.has(paleta.tecla);
    paleta.hinge.enableAngularMotor(true, paleta.lado * (pulsada ? -12 : 10), 4);
    document.getElementById(paleta.tecla).classList.toggle("pulsada", pulsada);
  }
  physicsWorld.stepSimulation(deltatime, 8, 1 / 120);
  for (let mesh of rigidBodies) {
    mesh.userData.physicsBody.getMotionState().getWorldTransform(transformAux);
    const pos = transformAux.getOrigin(), quat = transformAux.getRotation();
    mesh.position.set(pos.x(), pos.y(), pos.z());
    mesh.quaternion.set(quat.x(), quat.y(), quat.z(), quat.w());
  }
  if (!jugando) return;
  comprobarRebotes();
  const vuelveAlCanal = enCanal();
  botonLanzar.disabled = !vuelveAlCanal;
  if (vuelveAlCanal) estado.textContent = "La bola ha vuelto al canal. Pulsa espacio para lanzarla.";
  if (bola.position.z > 8.65 || Math.abs(bola.position.x) > 6) {
    jugando = false;
    bola.visible = false;
    vectorAux.setValue(0, 0, 0);
    bola.userData.physicsBody.setLinearFactor(vectorAux);
    bola.userData.physicsBody.setLinearVelocity(vectorAux);
    botonLanzar.disabled = false;
    estado.textContent = "Bola perdida. Pulsa espacio para volver a lanzar.";
  }
}

function comprobarRebotes() {
  const dispatcher = physicsWorld.getDispatcher();
  for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
    const contacto = dispatcher.getManifoldByIndexInternal(i);
    const a = contacto.getBody0().getUserIndex(), b = contacto.getBody1().getUserIndex();
    const indice = a === 1 ? b - 10 : b === 1 ? a - 10 : -1;
    if (indice < 0 || indice >= reboteadores.length) continue;
    let tocando = false;
    for (let j = 0; j < contacto.getNumContacts(); j++) {
      if (contacto.getContactPoint(j).getDistance() <= 0) tocando = true;
    }
    const reboteador = reboteadores[indice], ahora = performance.now();
    if (!tocando || ahora - reboteador.ultimoGolpe < 250) continue;
    reboteador.ultimoGolpe = ahora;
    puntos += 100;
    document.getElementById("puntos").textContent = String(puntos).padStart(6, "0");
    const dx = bola.position.x - reboteador.mesh.position.x;
    const dz = bola.position.z - reboteador.mesh.position.z;
    const distancia = Math.hypot(dx, dz) || 1;
    vectorAux.setValue(4.5 * dx / distancia, 0, 4.5 * dz / distancia);
    bola.userData.physicsBody.applyCentralImpulse(vectorAux);
    if (reboteador.tween) { reboteador.tween.stop(); tweens.remove(reboteador.tween); }
    const tween = new TWEEN.Tween({ escala: 1 }, tweens)
      .to({ escala: 1.35 }, 130)
      .onUpdate((coords) => reboteador.aro.scale.setScalar(coords.escala))
      .repeat(1).yoyo(true)
      .onComplete(() => tweens.remove(tween));
    reboteador.tween = tween;
    tween.start();
  }
}

function animationLoop(ahora = performance.now()) {
  requestAnimationFrame(animationLoop);
  const deltatime = Math.min((ahora - anterior) / 1000, 1 / 30);
  anterior = ahora;
  updatePhysics(Math.max(deltatime, 0));
  tweens.update(ahora);
  renderer.render(scene, camera);
}
