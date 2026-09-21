import { i as __toESM } from "../_runtime.mjs";
import { I as require_jsx_runtime, L as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Camera, i as Gauge, r as RotateCcw, t as Triangle } from "../_libs/lucide-react.mjs";
import { C as PointsMaterial, D as SphereGeometry, E as Scene, O as Vector3, S as Points, T as SRGBColorSpace, _ as MeshBasicMaterial, a as BufferGeometry, b as PerspectiveCamera, c as Color, d as DodecahedronGeometry, f as Group, g as Mesh, h as InstancedMesh, i as BufferAttribute, l as CylinderGeometry, m as IcosahedronGeometry, n as AmbientLight, o as CanvasTexture, p as HemisphereLight, r as BoxGeometry, s as ClampToEdgeWrapping, t as WebGLRenderer, u as DirectionalLight, v as MeshStandardMaterial, w as Quaternion, x as PlaneGeometry, y as Object3D } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/LunarSim-Be_kY4e1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WHEEL_RADIUS = .26;
var WHEEL_WIDTH = .2;
var TRACK = 1.68;
var WHEELBASE = 1.92;
var MAX_SPEED = 4.4;
var TURN_RATE = .95;
var BODY_FOLLOW = .28;
var BODY_RADIUS = .74;
/** Ellipsoid center as a fraction of ry below (-) the terrain so the dome tapers to the ground. */
var ROCK_EMBED_K = -.22;
/** Extra meters on the sampled rock surface so wheels rest on the visual hull. */
var ROCK_HIT_SKIN = .012;
var SPAWN = {
	x: 0,
	z: 2.4,
	yaw: 0
};
var FIXED_DT = 1 / 60;
var MAX_ACCUM = .2;
var WHEEL_LAYOUT = [
	{
		id: "AS",
		label: "Ant. sin",
		x: -1.68 / 2,
		z: -1.92 / 2,
		side: -1,
		row: "front"
	},
	{
		id: "AD",
		label: "Ant. des",
		x: TRACK / 2,
		z: -1.92 / 2,
		side: 1,
		row: "front"
	},
	{
		id: "PS",
		label: "Post. sin",
		x: -1.68 / 2,
		z: WHEELBASE / 2,
		side: -1,
		row: "rear"
	},
	{
		id: "PD",
		label: "Post. des",
		x: TRACK / 2,
		z: WHEELBASE / 2,
		side: 1,
		row: "rear"
	}
];
var WHEEL_COUNT = WHEEL_LAYOUT.length;
var GAME_CODES = /* @__PURE__ */ new Set([
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Space",
	"ShiftLeft",
	"ShiftRight",
	"ControlLeft",
	"ControlRight",
	"KeyC",
	"KeyR",
	"KeyQ",
	"KeyE"
]);
function radialDeadzone(x, y, dz = .16) {
	const m = Math.hypot(x, y);
	if (m < dz) return {
		x: 0,
		y: 0
	};
	const scale = (m - dz) / (1 - dz) / m;
	return {
		x: x * scale,
		y: y * scale
	};
}
function createInput() {
	const keys = /* @__PURE__ */ new Set();
	let injected = null;
	let steerOverride = null;
	let touchThrottle = 0;
	let touchSteer = 0;
	let touchActive = false;
	let prevC = false;
	let prevR = false;
	function activeKeys() {
		return injected ?? keys;
	}
	function has(code) {
		const src = activeKeys();
		if (src instanceof Set) return src.has(code);
		return src.includes(code);
	}
	function onKeyDown(e) {
		if (GAME_CODES.has(e.code)) e.preventDefault();
		keys.add(e.code);
	}
	function onKeyUp(e) {
		keys.delete(e.code);
	}
	function clear() {
		keys.clear();
	}
	window.addEventListener("keydown", onKeyDown, { passive: false });
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", clear);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) clear();
	});
	function setTouch(throttle, steer, active) {
		touchThrottle = throttle;
		touchSteer = steer;
		touchActive = active;
	}
	function pollGamepad(actions) {
		const pads = navigator.getGamepads?.() ?? [];
		for (const pad of pads) {
			if (!pad || pad.mapping !== "standard") continue;
			const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
			actions.throttle += -stick.y;
			actions.steer += -stick.x;
			if (pad.buttons[12]?.pressed) actions.throttle += 1;
			if (pad.buttons[13]?.pressed) actions.throttle -= 1;
			if (pad.buttons[14]?.pressed) actions.steer += 1;
			if (pad.buttons[15]?.pressed) actions.steer -= 1;
			if (pad.buttons[0]?.pressed) actions.stance = Math.max(actions.stance, 1.38);
			if (pad.buttons[1]?.pressed) actions.stance = Math.min(actions.stance, .72);
			if (pad.buttons[2]?.pressed) actions.reset = true;
			if (pad.buttons[3]?.pressed) actions.cameraCycle = true;
			break;
		}
	}
	function sample() {
		const actions = {
			throttle: 0,
			steer: 0,
			stance: 1,
			cameraCycle: false,
			reset: false
		};
		if (has("KeyW") || has("ArrowUp")) actions.throttle += 1;
		if (has("KeyS") || has("ArrowDown")) actions.throttle -= 1;
		if (has("KeyA") || has("ArrowLeft")) actions.steer += 1;
		if (has("KeyD") || has("ArrowRight")) actions.steer -= 1;
		if (has("KeyQ")) actions.steer += 1;
		if (has("KeyE")) actions.steer -= 1;
		if (has("ShiftLeft") || has("ShiftRight")) {
			if (actions.throttle > 0) actions.throttle = 1.35;
		}
		if (has("Space")) actions.stance = 1.42;
		if (has("ControlLeft") || has("ControlRight")) actions.stance = .7;
		if (touchActive) {
			actions.throttle += touchThrottle;
			actions.steer += touchSteer;
		}
		pollGamepad(actions);
		if (steerOverride !== null) actions.steer = steerOverride;
		actions.throttle = Math.max(-1.35, Math.min(1.35, actions.throttle));
		actions.steer = Math.max(-1, Math.min(1, actions.steer));
		const c = has("KeyC");
		const r = has("KeyR");
		actions.cameraCycle = c && !prevC;
		actions.reset = r && !prevR;
		prevC = c;
		prevR = r;
		return actions;
	}
	function setKeys(codes) {
		injected = codes.length ? codes : null;
	}
	function setSteer(v) {
		steerOverride = v;
	}
	function dispose() {
		window.removeEventListener("keydown", onKeyDown);
		window.removeEventListener("keyup", onKeyUp);
		window.removeEventListener("blur", clear);
	}
	return {
		sample,
		setKeys,
		setSteer,
		setTouch,
		dispose,
		has
	};
}
var gold = new MeshStandardMaterial({
	color: 12886102,
	metalness: .72,
	roughness: .38
});
var goldDark = new MeshStandardMaterial({
	color: 9071154,
	metalness: .65,
	roughness: .48
});
var white = new MeshStandardMaterial({
	color: 15131354,
	metalness: .15,
	roughness: .55
});
var black = new MeshStandardMaterial({
	color: 1447448,
	metalness: .4,
	roughness: .55
});
var titan = new MeshStandardMaterial({
	color: 10132130,
	metalness: .78,
	roughness: .32
});
var tire = new MeshStandardMaterial({
	color: 3815996,
	metalness: .1,
	roughness: .82
});
var grouser = new MeshStandardMaterial({
	color: 9276818,
	metalness: .55,
	roughness: .4
});
var lamp = new MeshStandardMaterial({
	color: 15921126,
	metalness: .2,
	roughness: .25,
	emissive: 14209216,
	emissiveIntensity: .45
});
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
	const m = new Mesh(new BoxGeometry(w, h, d), mat);
	m.position.set(x, y, z);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}
function cyl(rTop, rBot, h, mat, segs = 12) {
	const m = new Mesh(new CylinderGeometry(rTop, rBot, h, segs), mat);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}
function makeWheel() {
	const g = new Group();
	const hub = cyl(WHEEL_RADIUS * .42, WHEEL_RADIUS * .42, WHEEL_WIDTH * .7, titan, 14);
	hub.rotation.z = Math.PI / 2;
	g.add(hub);
	const rim = cyl(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH * .55, tire, 18);
	rim.rotation.z = Math.PI / 2;
	g.add(rim);
	const disc = cyl(WHEEL_RADIUS * .78, WHEEL_RADIUS * .78, WHEEL_WIDTH * .18, black, 16);
	disc.rotation.z = Math.PI / 2;
	g.add(disc);
	const grouserGeo = new BoxGeometry(WHEEL_WIDTH * .7, .045, .07);
	for (let i = 0; i < 14; i++) {
		const a = i / 14 * Math.PI * 2;
		const m = new Mesh(grouserGeo, grouser);
		m.position.set(0, Math.sin(a) * WHEEL_RADIUS, Math.cos(a) * WHEEL_RADIUS);
		m.rotation.x = a;
		m.castShadow = true;
		g.add(m);
	}
	return g;
}
var _from = new Vector3();
var _to = new Vector3();
var _dir = new Vector3();
var _mid = new Vector3();
var _quat = new Quaternion();
var _y = new Vector3(0, 1, 0);
function placeBone(mesh, ax, ay, az, bx, by, bz, thickScale = 1) {
	_from.set(ax, ay, az);
	_to.set(bx, by, bz);
	_dir.subVectors(_to, _from);
	const len = Math.max(.04, _dir.length());
	_mid.copy(_from).add(_to).multiplyScalar(.5);
	mesh.position.copy(_mid);
	_quat.setFromUnitVectors(_y, _dir.normalize());
	mesh.quaternion.copy(_quat);
	mesh.scale.set(thickScale, len, thickScale);
}
function buildRoverView() {
	const root = new Group();
	root.name = "rover";
	const posed = new Group();
	const body = new Group();
	body.add(box(1.22, .34, 1.48, gold, 0, .1, .02));
	body.add(box(1.12, .07, 1.4, white, 0, .3, .02));
	body.add(box(1.16, .14, .42, goldDark, 0, .16, .62));
	body.add(box(.48, .05, .08, titan, 0, .04, -.76));
	body.add(box(.1, .07, .08, lamp, -.38, .16, -.74));
	body.add(box(.1, .07, .08, lamp, .38, .16, -.74));
	posed.add(body);
	root.add(posed);
	const legs = [];
	const upperGeo = new CylinderGeometry(.045, .055, 1, 8);
	const lowerGeo = new CylinderGeometry(.04, .035, 1, 8);
	const pistonGeo = new CylinderGeometry(.018, .018, 1, 6);
	const jointGeo = new SphereGeometry(.07, 12, 10);
	for (let i = 0; i < WHEEL_COUNT; i++) {
		const hipJoint = new Mesh(jointGeo, gold);
		hipJoint.castShadow = true;
		const kneeJoint = new Mesh(jointGeo, goldDark);
		kneeJoint.castShadow = true;
		const upper = new Mesh(upperGeo, titan);
		upper.castShadow = true;
		const lower = new Mesh(lowerGeo, titan);
		lower.castShadow = true;
		const piston = new Mesh(pistonGeo, black);
		piston.castShadow = true;
		const fork = new Group();
		fork.add(box(.08, .16, .05, titan, 0, 0, 0));
		const wheel = makeWheel();
		fork.add(wheel);
		root.add(hipJoint, kneeJoint, upper, lower, piston, fork);
		legs.push({
			hipJoint,
			kneeJoint,
			upper,
			lower,
			piston,
			fork,
			wheel
		});
	}
	function update(pose) {
		posed.position.set(pose.x, pose.y, pose.z);
		posed.rotation.order = "YXZ";
		posed.rotation.y = pose.yaw;
		posed.rotation.x = pose.pitch;
		posed.rotation.z = pose.roll;
		for (let i = 0; i < WHEEL_COUNT; i++) {
			const w = pose.wheels[i];
			const leg = legs[i];
			leg.hipJoint.position.set(w.hipX, w.hipY, w.hipZ);
			leg.kneeJoint.position.set(w.kneeX, w.kneeY, w.kneeZ);
			placeBone(leg.upper, w.hipX, w.hipY, w.hipZ, w.kneeX, w.kneeY, w.kneeZ, 1);
			placeBone(leg.lower, w.kneeX, w.kneeY, w.kneeZ, w.x, w.y, w.z, 1);
			placeBone(leg.piston, w.hipX, w.hipY - .02, w.hipZ, w.x, w.y + .04, w.z, .75);
			leg.fork.position.set(w.x, w.y, w.z);
			leg.fork.rotation.order = "YXZ";
			leg.fork.rotation.set(0, pose.yaw + w.steer, 0);
			leg.wheel.rotation.x = w.spin;
		}
	}
	return {
		group: root,
		update
	};
}
function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function damp(current, target, lambda, dt) {
	return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
/** Match three.js Euler order YXZ used by the rover body. */
function chassisPoint(rover, lx, ly, lz) {
	const x = rover.pitch;
	const y = rover.yaw;
	const z = rover.roll;
	const c1 = Math.cos(x);
	const c2 = Math.cos(y);
	const c3 = Math.cos(z);
	const s1 = Math.sin(x);
	const s2 = Math.sin(y);
	const s3 = Math.sin(z);
	const m00 = c2 * c3 - s2 * s1 * s3;
	const m10 = c2 * s3 + s2 * s1 * c3;
	const m20 = -s2 * c1;
	const m01 = -c1 * s3;
	const m11 = c1 * c3;
	const m21 = s1;
	const m02 = s2 * c3 + c2 * s1 * s3;
	const m12 = s2 * s3 - c2 * s1 * c3;
	const m22 = c2 * c1;
	return {
		x: rover.x + m00 * lx + m01 * ly + m02 * lz,
		y: rover.y + m10 * lx + m11 * ly + m12 * lz,
		z: rover.z + m20 * lx + m21 * ly + m22 * lz
	};
}
function createRover(terrain) {
	const wheels = WHEEL_LAYOUT.map((w) => ({
		id: w.id,
		label: w.label,
		hipLocalX: w.x * .7,
		hipLocalY: .06,
		hipLocalZ: w.z,
		side: w.side,
		row: w.row,
		x: 0,
		y: 0,
		z: 0,
		hipX: 0,
		hipY: 0,
		hipZ: 0,
		kneeX: 0,
		kneeY: 0,
		kneeZ: 0,
		contact: true,
		lift: 0,
		compression: .2,
		spin: 0,
		steer: 0,
		load: 1 / WHEEL_COUNT
	}));
	const rover = {
		x: SPAWN.x,
		y: 1.2,
		z: SPAWN.z,
		yaw: SPAWN.yaw,
		pitch: 0,
		roll: 0,
		speed: 0,
		yawRate: 0,
		stance: 1,
		wheels,
		maxLift: 0,
		contacts: WHEEL_COUNT
	};
	snapToGround(rover, terrain);
	return rover;
}
function placeWheels(rover, terrain, dt) {
	const fy = -Math.sin(rover.yaw);
	const fz = -Math.cos(rover.yaw);
	let maxLift = 0;
	let contacts = 0;
	let loadSum = 0;
	const nominal = terrain.sample(rover.x, rover.z) + WHEEL_RADIUS;
	for (const w of rover.wheels) {
		const hip = chassisPoint(rover, w.hipLocalX, w.hipLocalY, w.hipLocalZ);
		const foot = chassisPoint(rover, w.hipLocalX + w.side * .34, -.2, w.hipLocalZ);
		const targetY = terrain.sample(foot.x, foot.z) + WHEEL_RADIUS;
		const follow = dt >= .2 ? 1 : 1 - Math.exp(-28 * dt);
		w.y = lerp(w.y, targetY, follow);
		w.x = foot.x;
		w.z = foot.z;
		w.lift = Math.max(0, w.y - nominal);
		if (w.lift > maxLift) maxLift = w.lift;
		const hipToWheel = hip.y - w.y;
		w.compression = clamp((.62 * rover.stance - hipToWheel) / .62, 0, 1);
		w.contact = w.y <= targetY + .05;
		if (w.contact) contacts += 1;
		w.load = .08 + w.compression;
		loadSum += w.load;
		w.hipX = hip.x;
		w.hipY = hip.y;
		w.hipZ = hip.z;
		const dx = w.x - hip.x;
		const dy = w.y - hip.y;
		const dz = w.z - hip.z;
		const bend = Math.max(0, .88 - (Math.hypot(dx, dy, dz) || .001)) * .9 + .08;
		w.kneeX = (hip.x + w.x) * .5 + fy * (-.7 * bend) + w.side * .1 * bend;
		w.kneeY = (hip.y + w.y) * .5 + .02;
		w.kneeZ = (hip.z + w.z) * .5 + fz * (-.7 * bend) + w.side * .04 * bend;
	}
	if (loadSum > 0) for (const w of rover.wheels) w.load /= loadSum;
	rover.maxLift = maxLift;
	rover.contacts = contacts;
}
function fitBody(rover, dt) {
	const wheels = rover.wheels;
	const front = (wheels[0].y + wheels[1].y) * .5;
	const rear = (wheels[2].y + wheels[3].y) * .5;
	const left = (wheels[0].y + wheels[2].y) * .5;
	const right = (wheels[1].y + wheels[3].y) * .5;
	const avg = (front + rear) * .5;
	const terrainPitch = Math.atan2(front - rear, WHEELBASE);
	const terrainRoll = Math.atan2(right - left, TRACK);
	rover.pitch = damp(rover.pitch, terrainPitch * BODY_FOLLOW, 7, dt);
	rover.roll = damp(rover.roll, terrainRoll * BODY_FOLLOW, 7, dt);
	const clearance = .58 * rover.stance;
	rover.y = damp(rover.y, avg + clearance, 9, dt);
}
function stepRover(rover, terrain, actions, dt) {
	rover.stance = damp(rover.stance, actions.stance, 6, dt);
	const traction = rover.contacts / WHEEL_COUNT;
	const maxSpeed = MAX_SPEED * (actions.throttle > 1 ? 1.22 : 1) * (.5 + .5 * traction);
	const want = clamp(actions.throttle, -1, 1) * maxSpeed;
	const accel = actions.throttle !== 0 ? 2.1 : 3.2;
	rover.speed += (want - rover.speed) * Math.min(1, accel * dt);
	rover.speed *= 1 - .18 * dt;
	const reverse = rover.speed >= -.04 ? 1 : -1;
	const speedFactor = .4 + .6 * Math.min(1, Math.abs(rover.speed) / 3.2);
	const turn = actions.steer * TURN_RATE * speedFactor * reverse;
	rover.yawRate = damp(rover.yawRate, turn, 10, dt);
	rover.yaw += rover.yawRate * dt;
	const fx = -Math.sin(rover.yaw);
	const fz = -Math.cos(rover.yaw);
	rover.x += fx * rover.speed * dt;
	rover.z += fz * rover.speed * dt;
	const limit = 39;
	rover.x = clamp(rover.x, -39, limit);
	rover.z = clamp(rover.z, -39, limit);
	const blocked = terrain.resolveBody(rover.x, rover.y, rover.z, BODY_RADIUS);
	if (blocked.hit) {
		rover.x = blocked.x;
		rover.z = blocked.z;
		rover.speed *= .55;
	}
	const steerVis = actions.steer * .48;
	for (const w of rover.wheels) {
		const mag = w.row === "front" ? 1 : -.7;
		w.steer = damp(w.steer, steerVis * mag, 12, dt);
		w.spin += rover.speed / WHEEL_RADIUS * (w.contact ? 1 : 1.35) * dt;
	}
	placeWheels(rover, terrain, dt);
	fitBody(rover, dt);
}
function snapToGround(rover, terrain) {
	for (let i = 0; i < 10; i++) {
		placeWheels(rover, terrain, .2);
		fitBody(rover, .2);
	}
	rover.speed = 0;
	rover.yawRate = 0;
}
function resetRover(rover, terrain) {
	rover.x = SPAWN.x;
	rover.z = SPAWN.z;
	rover.yaw = SPAWN.yaw;
	rover.pitch = 0;
	rover.roll = 0;
	rover.speed = 0;
	rover.yawRate = 0;
	rover.stance = 1;
	snapToGround(rover, terrain);
}
function clonePose(rover) {
	return {
		x: rover.x,
		y: rover.y,
		z: rover.z,
		yaw: rover.yaw,
		pitch: rover.pitch,
		roll: rover.roll,
		wheels: rover.wheels.map((w) => ({
			x: w.x,
			y: w.y,
			z: w.z,
			hipX: w.hipX,
			hipY: w.hipY,
			hipZ: w.hipZ,
			kneeX: w.kneeX,
			kneeY: w.kneeY,
			kneeZ: w.kneeZ,
			spin: w.spin,
			steer: w.steer,
			lift: w.lift,
			compression: w.compression
		}))
	};
}
function interpPose(a, b, t) {
	const lerpA = (x, y) => x + (y - x) * t;
	const lerpAngle = (x, y) => {
		let d = y - x;
		while (d > Math.PI) d -= Math.PI * 2;
		while (d < -Math.PI) d += Math.PI * 2;
		return x + d * t;
	};
	return {
		x: lerpA(a.x, b.x),
		y: lerpA(a.y, b.y),
		z: lerpA(a.z, b.z),
		yaw: lerpAngle(a.yaw, b.yaw),
		pitch: lerpA(a.pitch, b.pitch),
		roll: lerpA(a.roll, b.roll),
		wheels: a.wheels.map((w, i) => {
			const n = b.wheels[i];
			return {
				x: lerpA(w.x, n.x),
				y: lerpA(w.y, n.y),
				z: lerpA(w.z, n.z),
				hipX: lerpA(w.hipX, n.hipX),
				hipY: lerpA(w.hipY, n.hipY),
				hipZ: lerpA(w.hipZ, n.hipZ),
				kneeX: lerpA(w.kneeX, n.kneeX),
				kneeY: lerpA(w.kneeY, n.kneeY),
				kneeZ: lerpA(w.kneeZ, n.kneeZ),
				spin: lerpA(w.spin, n.spin),
				steer: lerpA(w.steer, n.steer),
				lift: lerpA(w.lift, n.lift),
				compression: lerpA(w.compression, n.compression)
			};
		})
	};
}
function mulberry32$1(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function fade(t) {
	return t * t * (3 - 2 * t);
}
function makeValueNoise(rand, dim = 64) {
	const grid = new Float32Array(dim * dim);
	for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;
	return (x, y) => {
		const xi = Math.floor(x);
		const yi = Math.floor(y);
		const tx = fade(x - xi);
		const ty = fade(y - yi);
		const x0 = (xi % dim + dim) % dim;
		const y0 = (yi % dim + dim) % dim;
		const x1 = (x0 + 1) % dim;
		const y1 = (y0 + 1) % dim;
		const a = grid[y0 * dim + x0];
		const b = grid[y0 * dim + x1];
		const c = grid[y1 * dim + x0];
		const d = grid[y1 * dim + x1];
		const u = a + (b - a) * tx;
		return u + (c + (d - c) * tx - u) * ty;
	};
}
function fbm(noise, x, y, oct = 5) {
	let s = 0;
	let a = 1;
	let f = 1;
	let n = 0;
	for (let i = 0; i < oct; i++) {
		s += noise(x * f, y * f) * a;
		n += a;
		a *= .5;
		f *= 2.03;
	}
	return s / n;
}
function craterProfile(t, depth, rim) {
	if (t >= 1.18) return 0;
	const bowl = t < 1 ? -depth * (1 - t * t) * (1 - t * t) : 0;
	const u = (t - .92) / .16;
	return bowl + rim * Math.exp(-u * u);
}
function localXZ(rock, x, z) {
	const dx = x - rock.x;
	const dz = z - rock.z;
	return {
		lx: dx * rock.cosY + dz * rock.sinY,
		lz: -dx * rock.sinY + dz * rock.cosY
	};
}
/** Upper ellipsoid surface, or null if (x,z) is outside the rock's ground footprint. */
function rockSurfaceY(rock, x, z) {
	const { lx, lz } = localXZ(rock, x, z);
	const n2 = lx * lx / (rock.rx * rock.rx) + lz * lz / (rock.rz * rock.rz);
	if (n2 >= .999) return null;
	const upper = rock.cy + rock.ry * Math.sqrt(1 - n2) + ROCK_HIT_SKIN;
	if (upper <= rock.baseY + .004) return null;
	return upper;
}
function makeRock(x, z, rx, rz, peak, rotY, color, variant, bilinear) {
	const baseY = bilinear(x, z);
	const k = ROCK_EMBED_K;
	const ry = peak / (1 + k);
	return {
		x,
		z,
		rx,
		ry,
		rz,
		cy: baseY + k * ry,
		baseY,
		rotY,
		cosY: Math.cos(rotY),
		sinY: Math.sin(rotY),
		color,
		variant
	};
}
function createTerrain(seed = 334380) {
	const rand = mulberry32$1(seed);
	const noise = makeValueNoise(rand, 96);
	const size = 84;
	const res = 168;
	const heights = /* @__PURE__ */ new Float32Array(28224);
	const craters = [
		{
			x: -18,
			z: -16,
			r: 7.5,
			depth: 1.8
		},
		{
			x: 22,
			z: -11,
			r: 5.2,
			depth: 1.1
		},
		{
			x: 14,
			z: 24,
			r: 9.4,
			depth: 2.2
		},
		{
			x: -26,
			z: 12,
			r: 4.4,
			depth: .9
		},
		{
			x: 6,
			z: -28,
			r: 6.1,
			depth: 1.3
		},
		{
			x: -8,
			z: 28,
			r: 3.6,
			depth: .7
		},
		{
			x: 30,
			z: 8,
			r: 4.8,
			depth: 1
		},
		{
			x: -32,
			z: -24,
			r: 8.2,
			depth: 1.9
		}
	];
	for (let i = 0; i < 10; i++) {
		const ang = rand() * Math.PI * 2;
		const dist = 16 + rand() * 22;
		craters.push({
			x: Math.cos(ang) * dist,
			z: Math.sin(ang) * dist,
			r: 1.4 + rand() * 2.4,
			depth: .25 + rand() * .45
		});
	}
	const half = size / 2;
	for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
		const x = ix / 167 * size - half;
		const z = iz / 167 * size - half;
		let h = fbm(noise, x * .035, z * .035, 5) * 1.55;
		h += fbm(noise, x * .14 + 20, z * .14, 3) * .22;
		const flatten = fade(Math.min(1, Math.max(0, (14 - Math.hypot(x, z)) / 10)));
		h *= 1 - .88 * flatten;
		for (const c of craters) {
			const t = Math.hypot(x - c.x, z - c.z) / c.r;
			h += craterProfile(t, c.depth, c.depth * .22);
		}
		heights[iz * res + ix] = h;
	}
	function bilinear(x, z) {
		const u = (x + half) / size * 167;
		const v = (z + half) / size * 167;
		const x0 = Math.max(0, Math.min(166, Math.floor(u)));
		const z0 = Math.max(0, Math.min(166, Math.floor(v)));
		const tx = Math.max(0, Math.min(1, u - x0));
		const tz = Math.max(0, Math.min(1, v - z0));
		const h00 = heights[z0 * res + x0];
		const h10 = heights[z0 * res + x0 + 1];
		const h01 = heights[(z0 + 1) * res + x0];
		const h11 = heights[(z0 + 1) * res + x0 + 1];
		return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
	}
	const rocks = [];
	const rockPalette = [
		6972768,
		6051923,
		7893610,
		5131078,
		7235680
	];
	for (const d of [
		{
			x: -.9,
			z: -5.4,
			s: .5
		},
		{
			x: .9,
			z: -5.4,
			s: .46
		},
		{
			x: 0,
			z: -6.5,
			s: .62
		},
		{
			x: -.85,
			z: -7.6,
			s: .54
		},
		{
			x: .85,
			z: -7.8,
			s: .5
		},
		{
			x: .1,
			z: -9,
			s: .58
		},
		{
			x: -.95,
			z: -10.2,
			s: .48
		},
		{
			x: .9,
			z: -11.4,
			s: .56
		},
		{
			x: 0,
			z: -12.8,
			s: .64
		},
		{
			x: -.8,
			z: -14.4,
			s: .5
		},
		{
			x: .75,
			z: -15.8,
			s: .54
		},
		{
			x: .15,
			z: -17.4,
			s: .52
		}
	]) rocks.push(makeRock(d.x, d.z, d.s * (.92 + rand() * .16), d.s * (.78 + rand() * .22), d.s * (.48 + rand() * .16), rand() * Math.PI * 2, rockPalette[Math.floor(rand() * rockPalette.length)], Math.floor(rand() * 3), bilinear));
	for (let i = 0; i < 58; i++) {
		const ang = rand() * Math.PI * 2;
		const dist = 6 + rand() * 34;
		const x = Math.cos(ang) * dist;
		const z = Math.sin(ang) * dist;
		if (Math.hypot(x, z - 2.4) < 4.2) continue;
		const s = .16 + rand() * .42;
		rocks.push(makeRock(x, z, s * (.85 + rand() * .4), s * (.75 + rand() * .4), s * (.42 + rand() * .32), rand() * Math.PI * 2, rockPalette[Math.floor(rand() * rockPalette.length)], Math.floor(rand() * 3), bilinear));
	}
	for (const b of [
		{
			x: -16.2,
			z: -12.4,
			s: 1.35
		},
		{
			x: 18.6,
			z: -8.8,
			s: 1.15
		},
		{
			x: 11.2,
			z: 20.4,
			s: 1.55
		},
		{
			x: -28.4,
			z: 10.6,
			s: 1.05
		},
		{
			x: 4.4,
			z: -25.2,
			s: 1.22
		},
		{
			x: -30.8,
			z: -21.5,
			s: 1.4
		}
	]) rocks.push(makeRock(b.x, b.z, b.s * (.9 + rand() * .2), b.s * (.78 + rand() * .22), b.s * (.7 + rand() * .18), rand() * Math.PI * 2, 5788751, Math.floor(rand() * 3), bilinear));
	const pebbles = [];
	for (let i = 0; i < 160; i++) {
		const ang = rand() * Math.PI * 2;
		const dist = rand() * 38;
		const x = Math.cos(ang) * dist;
		const z = Math.sin(ang) * dist;
		const s = .05 + rand() * .11;
		pebbles.push(makeRock(x, z, s, s * (.7 + rand() * .45), s * .62, rand() * Math.PI * 2, 6972766, 0, bilinear));
	}
	function sample(x, z) {
		const limit = 41.6;
		const cx = Math.max(-41.6, Math.min(limit, x));
		const cz = Math.max(-41.6, Math.min(limit, z));
		let h = bilinear(cx, cz);
		for (let i = 0; i < rocks.length; i++) {
			const r = rocks[i];
			const pad = Math.max(r.rx, r.rz);
			if (Math.abs(cx - r.x) > pad || Math.abs(cz - r.z) > pad) continue;
			const bump = rockSurfaceY(r, cx, cz);
			if (bump !== null && bump > h) h = bump;
		}
		return h;
	}
	const _n = {
		x: 0,
		y: 1,
		z: 0
	};
	function sampleNormal(x, z, out = _n) {
		const e = .18;
		const dx = sample(x + e, z) - sample(x - e, z);
		const dz = sample(x, z + e) - sample(x, z - e);
		const nx = -dx;
		const ny = 2 * e;
		const nz = -dz;
		const inv = 1 / Math.hypot(nx, ny, nz);
		out.x = nx * inv;
		out.y = ny * inv;
		out.z = nz * inv;
		return out;
	}
	function resolveBody(x, y, z, radius) {
		let px = x;
		let pz = z;
		let hit = false;
		for (let i = 0; i < rocks.length; i++) {
			const r = rocks[i];
			if (r.cy + r.ry < y - .12) continue;
			const pad = Math.max(r.rx, r.rz) + radius;
			if (Math.abs(px - r.x) > pad || Math.abs(pz - r.z) > pad) continue;
			const hy = (y - r.cy) / r.ry;
			if (hy >= .98 || hy <= -.98) continue;
			const slice = Math.sqrt(Math.max(.05, 1 - hy * hy));
			const erx = r.rx * slice + radius;
			const erz = r.rz * slice + radius;
			const { lx, lz } = localXZ(r, px, pz);
			const n2 = lx * lx / (erx * erx) + lz * lz / (erz * erz);
			if (n2 >= 1 || n2 < 1e-8) continue;
			const s = 1 / Math.sqrt(n2);
			const lx2 = lx * s;
			const lz2 = lz * s;
			px = r.x + lx2 * r.cosY - lz2 * r.sinY;
			pz = r.z + lx2 * r.sinY + lz2 * r.cosY;
			hit = true;
		}
		return {
			x: px,
			z: pz,
			hit
		};
	}
	return {
		size,
		res,
		heights,
		rocks,
		pebbles,
		craters,
		sample,
		groundAt: bilinear,
		sampleNormal,
		resolveBody
	};
}
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function makeEarthTexture() {
	const c = document.createElement("canvas");
	c.width = 512;
	c.height = 256;
	const ctx = c.getContext("2d");
	ctx.fillStyle = "#1a3a78";
	ctx.fillRect(0, 0, 512, 256);
	const drawLand = (x, y, rx, ry, color) => {
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
		ctx.fill();
	};
	drawLand(90, 90, 70, 50, "#2f6a3a");
	drawLand(70, 110, 40, 28, "#4a7a3e");
	drawLand(200, 70, 55, 38, "#3d6b3a");
	drawLand(310, 130, 90, 40, "#356338");
	drawLand(400, 80, 50, 55, "#2c5a34");
	drawLand(470, 140, 40, 30, "#3a6840");
	ctx.fillStyle = "rgba(240,246,255,0.55)";
	for (let i = 0; i < 18; i++) {
		ctx.beginPath();
		ctx.ellipse(i * 97 % 512, 40 + i * 53 % 180, 30 + i % 5 * 8, 8 + i % 3 * 3, i * .4, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = "#e8eef6";
	ctx.fillRect(0, 0, 512, 18);
	ctx.fillRect(0, 238, 512, 18);
	const tex = new CanvasTexture(c);
	tex.colorSpace = SRGBColorSpace;
	tex.needsUpdate = true;
	return tex;
}
function makeAlbedo(terrain) {
	const res = 512;
	const c = document.createElement("canvas");
	c.width = res;
	c.height = res;
	const ctx = c.getContext("2d");
	const img = ctx.createImageData(res, res);
	const half = 42;
	for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
		const wx = x / 511 * 84 - half;
		const wz = y / 511 * 84 - half;
		const ix = Math.floor(x / 511 * (terrain.res - 1));
		const iz = Math.floor(y / 511 * (terrain.res - 1));
		const n = .52 + terrain.heights[iz * terrain.res + ix] * .08 + (x * 13 + y * 7) % 9 * .004;
		let crater = 0;
		for (const cr of terrain.craters) {
			const t = Math.hypot(wx - cr.x, wz - cr.z) / cr.r;
			if (t < 1) crater += (1 - t) * .18;
		}
		const r = (.42 + n * .18 - crater) * 255;
		const g = (.4 + n * .16 - crater * .9) * 255;
		const b = (.36 + n * .14 - crater * .7) * 255;
		const i = (y * res + x) * 4;
		img.data[i] = Math.max(40, Math.min(200, r));
		img.data[i + 1] = Math.max(38, Math.min(190, g));
		img.data[i + 2] = Math.max(34, Math.min(175, b));
		img.data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	const tex = new CanvasTexture(c);
	tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
	tex.colorSpace = SRGBColorSpace;
	tex.anisotropy = 4;
	tex.needsUpdate = true;
	return tex;
}
/**
* Unit rock whose *upper* vertices sit inside the unit sphere.
* Collision uses the same (rx, ry, rz) ellipsoid as the instance scale, so the
* hitbox is the convex envelope of the visible mesh.
*/
function makeRockGeometry(seed) {
	const geo = new IcosahedronGeometry(1, 2);
	const pos = geo.attributes.position;
	const rand = mulberry32(seed);
	for (let i = 0; i < pos.count; i++) {
		let x = pos.getX(i);
		let y = pos.getY(i);
		let z = pos.getZ(i);
		const n = .9 + rand() * .16;
		x *= n;
		y *= n;
		z *= n;
		if (y < 0) y *= .52;
		pos.setXYZ(i, x, y, z);
	}
	let maxR = 0;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const y = pos.getY(i);
		const z = pos.getZ(i);
		if (y >= -.08) maxR = Math.max(maxR, Math.hypot(x, y, z));
	}
	if (maxR > 1e-6) {
		const s = 1 / maxR;
		for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
	}
	pos.needsUpdate = true;
	geo.computeVertexNormals();
	geo.computeBoundingSphere();
	return geo;
}
function placeRocks(rocks, geos, material, dummy, color) {
	const groups = [
		[],
		[],
		[]
	];
	for (const r of rocks) groups[r.variant % 3].push(r);
	const meshes = [];
	groups.forEach((list, vi) => {
		if (!list.length) return;
		const mesh = new InstancedMesh(geos[vi], material, list.length);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		mesh.frustumCulled = false;
		list.forEach((r, i) => {
			dummy.position.set(r.x, r.cy, r.z);
			dummy.rotation.set(0, r.rotY, 0);
			dummy.scale.set(r.rx, r.ry, r.rz);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
			color.setHex(r.color);
			mesh.setColorAt(i, color);
		});
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		meshes.push(mesh);
	});
	return meshes;
}
function buildWorld(terrain) {
	const root = new Group();
	const half = 42;
	const geo = new PlaneGeometry(84, 84, terrain.res - 1, terrain.res - 1);
	geo.rotateX(-Math.PI / 2);
	const pos = geo.attributes.position;
	const colors = new Float32Array(pos.count * 3);
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const ix = Math.round((x + half) / 84 * (terrain.res - 1));
		const iz = Math.round((z + half) / 84 * (terrain.res - 1));
		const clampedIx = Math.max(0, Math.min(terrain.res - 1, ix));
		const clampedIz = Math.max(0, Math.min(terrain.res - 1, iz));
		const h = terrain.heights[clampedIz * terrain.res + clampedIx] ?? 0;
		pos.setY(i, h);
		const shade = .55 + h * .06;
		colors[i * 3] = shade;
		colors[i * 3 + 1] = shade * .98;
		colors[i * 3 + 2] = shade * .92;
	}
	pos.needsUpdate = true;
	geo.setAttribute("color", new BufferAttribute(colors, 3));
	geo.computeVertexNormals();
	geo.computeBoundingSphere();
	const albedo = makeAlbedo(terrain);
	const mat = new MeshStandardMaterial({
		map: albedo,
		vertexColors: true,
		roughness: .94,
		metalness: .02,
		color: 13157048
	});
	const ground = new Mesh(geo, mat);
	ground.receiveShadow = true;
	ground.castShadow = true;
	root.add(ground);
	const rockGeos = [
		makeRockGeometry(37282),
		makeRockGeometry(49949),
		makeRockGeometry(24071)
	];
	const rockMat = new MeshStandardMaterial({
		color: 16777215,
		roughness: .92,
		metalness: .03,
		flatShading: true
	});
	const dummy = new Object3D();
	const color = new Color();
	for (const mesh of placeRocks(terrain.rocks, rockGeos, rockMat, dummy, color)) root.add(mesh);
	const pebbleMat = rockMat.clone();
	pebbleMat.flatShading = true;
	const pebbleGeo = new DodecahedronGeometry(1, 0);
	const pebbles = new InstancedMesh(pebbleGeo, pebbleMat, terrain.pebbles.length);
	pebbles.castShadow = true;
	pebbles.receiveShadow = true;
	pebbles.frustumCulled = false;
	terrain.pebbles.forEach((r, i) => {
		dummy.position.set(r.x, r.cy, r.z);
		dummy.rotation.set(0, r.rotY, 0);
		dummy.scale.set(r.rx, r.ry, r.rz);
		dummy.updateMatrix();
		pebbles.setMatrixAt(i, dummy.matrix);
		color.setHex(r.color);
		pebbles.setColorAt(i, color);
	});
	pebbles.instanceMatrix.needsUpdate = true;
	if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
	root.add(pebbles);
	root.add(makeStars());
	const earth = new Mesh(new SphereGeometry(6.5, 32, 24), new MeshBasicMaterial({ map: makeEarthTexture() }));
	earth.position.set(-42, 38, -70);
	root.add(earth);
	const earthGlow = new Mesh(new SphereGeometry(7.1, 24, 16), new MeshBasicMaterial({
		color: 7251199,
		transparent: true,
		opacity: .12
	}));
	earthGlow.position.copy(earth.position);
	root.add(earthGlow);
	return {
		root,
		ground,
		albedo
	};
}
function makeStars() {
	const n = 1800;
	const positions = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const u = Math.random();
		const v = Math.random();
		const theta = 2 * Math.PI * u;
		const phi = Math.acos(2 * v - 1);
		const r = 220 + Math.random() * 40;
		positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
		positions[i * 3 + 1] = r * Math.cos(phi);
		positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
	}
	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(positions, 3));
	return new Points(geo, new PointsMaterial({
		color: 15922431,
		size: .55,
		sizeAttenuation: true
	}));
}
function buildDust() {
	const n = 220;
	const positions = /* @__PURE__ */ new Float32Array(660);
	for (let i = 0; i < n; i++) positions[i * 3 + 1] = -20;
	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(positions, 3));
	const mat = new PointsMaterial({
		color: 12037794,
		size: .11,
		transparent: true,
		opacity: .65,
		depthWrite: false
	});
	const points = new Points(geo, mat);
	const life = new Float32Array(n);
	const vel = /* @__PURE__ */ new Float32Array(660);
	let cursor = 0;
	function emit(x, y, z, fx, fz) {
		const i = cursor % n;
		cursor += 1;
		positions[i * 3] = x + (Math.random() - .5) * .2;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z + (Math.random() - .5) * .2;
		vel[i * 3] = -fx * .4 + (Math.random() - .5) * .3;
		vel[i * 3 + 1] = .35 + Math.random() * .5;
		vel[i * 3 + 2] = -fz * .4 + (Math.random() - .5) * .3;
		life[i] = .8 + Math.random() * .5;
	}
	function update(dt) {
		for (let i = 0; i < n; i++) {
			if (life[i] <= 0) {
				positions[i * 3 + 1] = -20;
				continue;
			}
			life[i] -= dt;
			vel[i * 3 + 1] -= 1.62 * dt;
			positions[i * 3] += vel[i * 3] * dt;
			positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
			positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
		}
		geo.attributes.position.needsUpdate = true;
	}
	return {
		points,
		emit,
		update
	};
}
var CAM_MODES = [
	{
		kind: "chase",
		dist: 7.4,
		height: 2.35,
		look: .7,
		fov: 52
	},
	{
		kind: "chase",
		dist: 11.5,
		height: 5.2,
		look: .4,
		fov: 52
	},
	{
		kind: "chase",
		dist: 3.6,
		height: 1.55,
		look: .9,
		fov: 48
	},
	{
		kind: "pov",
		fov: 70
	}
];
CAM_MODES.findIndex((m) => m.kind === "pov");
var EMPTY_HUD = {
	speed: 0,
	yaw: 0,
	pitch: 0,
	roll: 0,
	stance: 1,
	maxLift: 0,
	contacts: WHEEL_COUNT,
	x: 0,
	z: 0,
	camera: 0,
	pov: false,
	playing: false,
	wheels: []
};
function createEngine(canvas, onHud) {
	const terrain = createTerrain();
	const rover = createRover(terrain);
	let prev = clonePose(rover);
	let curr = clonePose(rover);
	let playing = false;
	let camMode = 0;
	let snapCam = true;
	let hudDirty = 0;
	let hudCache = EMPTY_HUD;
	let peakLift = 0;
	let lastSteer = 0;
	const input = createInput();
	const listeners = /* @__PURE__ */ new Set();
	const renderer = new WebGLRenderer({
		canvas,
		antialias: true,
		alpha: false,
		powerPreference: "high-performance"
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	renderer.setClearColor(0, 1);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = 1;
	renderer.toneMapping = 4;
	renderer.toneMappingExposure = 1.12;
	renderer.outputColorSpace = SRGBColorSpace;
	const scene = new Scene();
	scene.background = new Color(0);
	const camera = new PerspectiveCamera(52, 1, .08, 400);
	camera.position.set(0, 4, 10);
	const sun = new DirectionalLight(16773590, 3.35);
	sun.position.set(28, 46, 16);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.near = 2;
	sun.shadow.camera.far = 120;
	sun.shadow.camera.left = -22;
	sun.shadow.camera.right = 22;
	sun.shadow.camera.top = 22;
	sun.shadow.camera.bottom = -22;
	sun.shadow.bias = -35e-5;
	sun.shadow.normalBias = .03;
	scene.add(sun);
	scene.add(sun.target);
	const earthShine = new DirectionalLight(9417983, .22);
	earthShine.position.set(-40, 30, -50);
	scene.add(earthShine);
	scene.add(new AmbientLight(1052692, .12));
	scene.add(new HemisphereLight(790552, 1710100, .16));
	const world = buildWorld(terrain);
	scene.add(world.root);
	const roverView = buildRoverView();
	scene.add(roverView.group);
	roverView.update(rover);
	const dust = buildDust();
	scene.add(dust.points);
	const camPos = new Vector3(2, 4, 10);
	const camLook = new Vector3();
	const camDesired = new Vector3();
	const lookDesired = new Vector3();
	let acc = 0;
	let last = performance.now();
	let disposed = false;
	let dustAcc = 0;
	function resize() {
		const parent = canvas.parentElement ?? canvas;
		const w = Math.max(1, parent.clientWidth);
		const h = Math.max(1, parent.clientHeight);
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	resize();
	const ro = new ResizeObserver(resize);
	ro.observe(canvas.parentElement ?? canvas);
	function snapshot() {
		return {
			speed: rover.speed,
			yaw: rover.yaw,
			pitch: rover.pitch,
			roll: rover.roll,
			stance: rover.stance,
			maxLift: rover.maxLift,
			contacts: rover.contacts,
			x: rover.x,
			z: rover.z,
			camera: camMode,
			pov: CAM_MODES[camMode]?.kind === "pov",
			playing,
			wheels: rover.wheels.map((w) => ({
				id: w.id,
				label: w.label,
				lift: w.lift,
				compression: w.compression
			}))
		};
	}
	function notify() {
		hudCache = snapshot();
		onHud();
		listeners.forEach((fn) => fn());
	}
	hudCache = snapshot();
	function setFov(fov) {
		if (Math.abs(camera.fov - fov) < .01) return;
		camera.fov = fov;
		camera.updateProjectionMatrix();
	}
	function applyCamera(pose, dt) {
		const mode = CAM_MODES[camMode];
		if (mode.kind === "pov") {
			const eye = chassisPoint(pose, 0, .62, -.88);
			const aim = chassisPoint(pose, 0, .36, -18);
			camDesired.set(eye.x, eye.y, eye.z);
			lookDesired.set(aim.x, aim.y, aim.z);
			setFov(mode.fov);
		} else {
			const fx = -Math.sin(pose.yaw);
			const fz = -Math.cos(pose.yaw);
			camDesired.set(pose.x - fx * mode.dist, pose.y + mode.height, pose.z - fz * mode.dist);
			lookDesired.set(pose.x + fx * 1.2, pose.y + mode.look, pose.z + fz * 1.2);
			setFov(mode.fov);
		}
		const k = snapCam ? 1 : 1 - Math.exp((mode.kind === "pov" ? -18 : -3.6) * dt);
		snapCam = false;
		camPos.lerp(camDesired, k);
		camLook.lerp(lookDesired, k);
		camera.position.copy(camPos);
		camera.lookAt(camLook);
	}
	function physicsStep(dt) {
		prev = curr;
		const actions = playing ? input.sample() : {
			throttle: 0,
			steer: 0,
			stance: 1,
			cameraCycle: false,
			reset: false
		};
		if (actions.cameraCycle) {
			camMode = (camMode + 1) % CAM_MODES.length;
			snapCam = true;
		}
		if (actions.reset) resetRover(rover, terrain);
		lastSteer = actions.steer;
		stepRover(rover, terrain, actions, dt);
		if (rover.maxLift > peakLift) peakLift = rover.maxLift;
		curr = clonePose(rover);
		dustAcc += dt;
		if (dustAcc > .045 && Math.abs(rover.speed) > .35) {
			dustAcc = 0;
			const fx = -Math.sin(rover.yaw);
			const fz = -Math.cos(rover.yaw);
			for (const w of rover.wheels) if (w.contact && Math.random() > .4) dust.emit(w.x, w.y - .18, w.z, fx * rover.speed, fz * rover.speed);
		}
	}
	const loop = () => {
		if (disposed) return;
		const now = performance.now();
		let dt = Math.min((now - last) / 1e3, .1);
		last = now;
		acc += dt;
		if (acc > .2) acc = MAX_ACCUM;
		while (acc >= FIXED_DT) {
			physicsStep(FIXED_DT);
			acc -= FIXED_DT;
		}
		const alpha = acc / FIXED_DT;
		const pose = interpPose(prev, curr, alpha);
		roverView.update(pose);
		dust.update(dt);
		applyCamera(pose, dt);
		sun.target.position.set(pose.x, pose.y, pose.z);
		sun.position.set(pose.x + 28, pose.y + 46, pose.z + 16);
		sun.target.updateMatrixWorld();
		renderer.render(scene, camera);
		hudDirty += dt;
		if (hudDirty > .08) {
			hudDirty = 0;
			notify();
		}
	};
	renderer.setAnimationLoop(loop);
	window.__controlsTest = {
		getYaw: () => rover.yaw,
		getSpeed: () => rover.speed,
		setKeys: (codes) => input.setKeys(codes),
		setSteer: (v) => input.setSteer(v),
		getLift: () => rover.maxLift,
		getPeakLift: () => peakLift,
		getPos: () => ({
			x: rover.x,
			z: rover.z,
			y: rover.y
		}),
		getCamera: () => camMode,
		getSteer: () => lastSteer,
		getYawRate: () => rover.yawRate,
		setCamera: (mode) => {
			camMode = (mode % CAM_MODES.length + CAM_MODES.length) % CAM_MODES.length;
			snapCam = true;
			notify();
		},
		reset: () => {
			resetRover(rover, terrain);
			prev = clonePose(rover);
			curr = clonePose(rover);
			peakLift = 0;
		}
	};
	function dispose() {
		disposed = true;
		renderer.setAnimationLoop(null);
		ro.disconnect();
		input.dispose();
		world.albedo.dispose();
		renderer.dispose();
		if (window.__controlsTest) delete window.__controlsTest;
	}
	return {
		dispose,
		setPlaying: (v) => {
			playing = v;
			notify();
		},
		setTouch: input.setTouch,
		cycleCamera: () => {
			camMode = (camMode + 1) % CAM_MODES.length;
			snapCam = true;
			notify();
		},
		reset: () => {
			resetRover(rover, terrain);
			prev = clonePose(rover);
			curr = clonePose(rover);
			notify();
		},
		getHud: () => hudCache,
		subscribe: (fn) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		}
	};
}
var CAM_LABELS = [
	"Inseguimento",
	"Alta",
	"Vicina",
	"POV"
];
function useEngineHud(engine) {
	return (0, import_react.useSyncExternalStore)((cb) => engine ? engine.subscribe(cb) : () => {}, () => engine?.getHud() ?? EMPTY_HUD, () => EMPTY_HUD);
}
function fmt(n, d = 1) {
	return n.toFixed(d);
}
function deg(rad) {
	return (rad * 180 / Math.PI).toFixed(0);
}
function heading(yaw) {
	return ((-yaw * 180 / Math.PI + 360) % 360).toFixed(0);
}
function LunarSim() {
	const wrapRef = (0, import_react.useRef)(null);
	const canvasRef = (0, import_react.useRef)(null);
	const engineRef = (0, import_react.useRef)(null);
	const [engine, setEngine] = (0, import_react.useState)(null);
	const [started, setStarted] = (0, import_react.useState)(false);
	const hud = useEngineHud(engine);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const handle = createEngine(canvas, () => {});
		engineRef.current = handle;
		setEngine(handle);
		return () => {
			handle.dispose();
			engineRef.current = null;
			setEngine(null);
		};
	}, []);
	const start = (0, import_react.useCallback)(() => {
		engineRef.current?.setPlaying(true);
		setStarted(true);
		wrapRef.current?.focus();
	}, []);
	(0, import_react.useEffect)(() => {
		if (started) return;
		const onKey = (e) => {
			if (e.code === "Enter" || e.code === "KeyW" || e.code === "Space") start();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [started, start]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		tabIndex: 0,
		className: "relative h-dvh w-full overflow-hidden bg-bg text-fg outline-none",
		style: { touchAction: "none" },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full"
			}),
			started ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hud, {
				hud,
				engine
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StartOverlay, { onStart: start }),
			started ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TouchPad, { engine }) : null
		]
	});
}
function StartOverlay({ onStart }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "absolute inset-0 z-10 flex items-end justify-center bg-bg/55 p-4 pb-8 sm:items-center sm:pb-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg rounded-xl border border-line bg-surface/90 p-6 sm:p-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs tracking-widest text-muted uppercase",
					children: "DeltaSpace · Ambiente di sviluppo 2026"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "mt-3 font-sans text-2xl font-medium tracking-tight text-fg sm:text-3xl",
					children: ["Ambiente di Sviluppo", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-xl sm:text-2xl",
						children: "Rover DeltaSpace 2026"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 max-w-md text-sm leading-relaxed text-muted",
					children: "Banco di prova della regolite. Rover a quattro gambe indipendenti: ogni ruota segue la superficie reale della roccia, senza attraversarla."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "mt-5 grid grid-cols-2 gap-2 font-mono text-xs text-faint sm:text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
							children: "WASD / frecce — guida"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
							children: "Spazio — stiva alta"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
							children: "Ctrl — accovaccia"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-md border border-line bg-elevated px-3 py-2 text-muted",
							children: "C camera / POV · R reset"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onStart,
					className: "mt-6 flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-opacity duration-150 ease-out hover:opacity-90",
					children: "Avvia ambiente"
				})
			]
		})
	});
}
function Hud({ hud, engine }) {
	const kmh = Math.abs(hud.speed) * 3.6;
	const adapting = hud.maxLift > .12;
	const camName = CAM_LABELS[hud.camera] ?? "Camera";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		hud.pov ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PovFrame, {}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-line bg-surface/80 px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-xs tracking-widest text-faint uppercase",
					children: "DeltaSpace 2026"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 font-mono text-xs text-muted",
					children: [
						fmt(hud.x, 1),
						" m · ",
						fmt(hud.z, 1),
						" m"
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gauge, { className: "size-3.5" }),
					label: "Velocità",
					value: `${fmt(kmh, 1)} km/h`
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Triangle, { className: "size-3.5" }),
					label: "Prua",
					value: `${heading(hud.yaw)}°`
				})]
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute right-3 bottom-28 left-3 z-10 flex flex-col gap-3 sm:right-auto sm:bottom-4 sm:left-4 sm:w-[22rem]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-line bg-surface/80 p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-xs tracking-widest text-faint uppercase",
							children: "Sollevamento ruote"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `font-mono text-xs ${adapting ? "text-ok" : "text-faint"}`,
							children: adapting ? "Gambe in adattamento" : "Regolite piana"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex items-end gap-2",
						children: hud.wheels.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WheelBar, { wheel: w }, w.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex justify-between font-mono text-xs text-faint",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "g 1.62 m/s²" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"pitch ",
								deg(hud.pitch),
								"° · roll ",
								deg(hud.roll),
								"°"
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								hud.contacts,
								"/",
								WHEEL_COUNT,
								" contatto"
							] })
						]
					})
				]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto absolute top-3 right-3 z-10 hidden flex-col gap-2 sm:top-4 sm:right-4 sm:flex",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					label: `Camera ${camName}`,
					onClick: () => engine?.cycleCamera(),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
					label: "Reset",
					onClick: () => engine?.reset(),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pointer-events-none text-center font-mono text-[10px] tracking-widest text-faint uppercase",
					children: camName
				})
			]
		})
	] });
}
function PovFrame() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 z-[9]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-16 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.28em] text-fg/70 uppercase",
				children: "CAM · POV"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-[18%] left-[8%] size-8 border-t border-l border-fg/35" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-[18%] right-[8%] size-8 border-t border-r border-fg/35" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-[22%] left-[8%] size-8 border-b border-l border-fg/35" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-[22%] right-[8%] size-8 border-b border-r border-fg/35" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 top-1/2 h-px bg-fg/40" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-y-0 left-1/2 w-px bg-fg/40" })]
			})
		]
	});
}
function Stat({ icon, label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line bg-surface/80 px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "flex items-center gap-1.5 font-mono text-xs tracking-widest text-faint uppercase",
			children: [icon, label]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 font-mono text-sm tabular-nums text-fg",
			children: value
		})]
	});
}
function WheelBar({ wheel }) {
	const h = Math.min(1, wheel.lift / .7);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-1 flex-col items-center gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "relative h-16 w-full overflow-hidden rounded-sm bg-elevated",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-x-0 bottom-0 bg-primary",
				style: {
					height: `${Math.max(6, h * 100)}%`,
					opacity: .35 + h * .65
				}
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-xs text-faint",
			children: wheel.id
		})]
	});
}
function IconBtn({ children, onClick, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": label,
		onClick,
		className: "flex size-11 items-center justify-center rounded-md border border-line bg-surface text-fg transition-opacity duration-150 hover:opacity-90",
		children
	});
}
function TouchPad({ engine }) {
	const stickRef = (0, import_react.useRef)(null);
	const [knob, setKnob] = (0, import_react.useState)({
		x: 0,
		y: 0,
		active: false
	});
	const apply = (0, import_react.useCallback)((clientX, clientY) => {
		const el = stickRef.current;
		if (!el || !engine) return;
		const r = el.getBoundingClientRect();
		const cx = r.left + r.width / 2;
		const cy = r.top + r.height / 2;
		const max = r.width * .38;
		let dx = clientX - cx;
		let dy = clientY - cy;
		const m = Math.hypot(dx, dy);
		if (m > max && m > 0) {
			dx = dx / m * max;
			dy = dy / m * max;
		}
		const nx = dx / max;
		const ny = dy / max;
		setKnob({
			x: dx,
			y: dy,
			active: true
		});
		engine.setTouch(-ny, -nx, true);
	}, [engine]);
	const end = (0, import_react.useCallback)(() => {
		setKnob({
			x: 0,
			y: 0,
			active: false
		});
		engine?.setTouch(0, 0, false);
	}, [engine]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-between px-4 sm:hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: stickRef,
			className: "pointer-events-auto relative size-28 rounded-full border border-line bg-surface/70",
			onPointerDown: (e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				apply(e.clientX, e.clientY);
			},
			onPointerMove: (e) => {
				if (!knob.active && !(e.buttons & 1)) return;
				apply(e.clientX, e.clientY);
			},
			onPointerUp: end,
			onPointerCancel: end,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-1/2 left-1/2 size-11 rounded-full bg-primary/80",
				style: { transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto flex flex-col gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
				label: "Camera",
				onClick: () => engine?.cycleCamera(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, { className: "size-4" })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
				label: "Reset",
				onClick: () => engine?.reset(),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" })
			})]
		})]
	});
}
//#endregion
export { LunarSim };
