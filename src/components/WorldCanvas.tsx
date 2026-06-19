"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, SoftShadows } from "@react-three/drei";
import type { Building, District, Road, Landmark, Selection, Vec3, WorldManifest } from "@/types/world";
import { useWorldStore } from "@/store/useWorldStore";

type Props = {
  manifest: WorldManifest | null;
  isLoading: boolean;
};

export function WorldCanvas({ manifest, isLoading }: Props) {
  const viewMode = useWorldStore((state) => state.viewMode);
  const isCompactViewport = useCompactViewport();
  const camera = useMemo(() => {
    const distance = manifest ? overviewCameraDistance(manifest, isCompactViewport) : 28;
    return { position: [distance, distance * 0.7, distance] as [number, number, number], fov: 45 };
  }, [isCompactViewport, manifest]);

  return (
    <div
      className="relative h-full min-h-[58vh] w-full md:min-h-0"
      data-testid="world-canvas"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #f3f7fe 0%, #e4edfa 45%, #d4e0f1 78%, #c7d6ec 100%)"
      }}
    >
      <Canvas
        camera={camera}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.06 }}
        className="h-full w-full"
        onPointerMissed={() => useWorldStore.getState().setSelection(null)}
      >
        <SoftShadows size={28} samples={12} focus={0.65} />
        <fog attach="fog" args={["#cdd9ed", 120, 320]} />
        <hemisphereLight color="#ffffff" groundColor="#9fb0c8" intensity={0.42} />
        <ambientLight intensity={0.22} />
        <directionalLight
          castShadow
          position={[26, 38, 18]}
          intensity={1.55}
          color="#fff6e8"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00035}
          shadow-normalBias={0.02}
        >
          <orthographicCamera attach="shadow-camera" args={[-70, 70, 70, -70, 1, 160]} />
        </directionalLight>
        <directionalLight position={[-22, 20, -24]} intensity={0.32} color="#cfe0ff" />
        <SceneEnvironment />
        <group position={[0, 0, 0]}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <planeGeometry args={[420, 420]} />
            <meshStandardMaterial color="#d3deee" roughness={0.96} metalness={0} />
          </mesh>
          <gridHelper args={[420, 84, "#aebccf", "#c5d2e4"]} position={[0, 0.006, 0]} />
          {manifest ? <WorldScene manifest={manifest} /> : <EmptyScene isLoading={isLoading} />}
          <ContactShadows frames={1} position={[0, 0.02, 0]} scale={260} resolution={1024} blur={2.4} opacity={0.42} far={40} color="#33415c" />
        </group>
        {manifest ? <StreetCameraControls enabled={viewMode === "street"} manifest={manifest} /> : null}
        {manifest ? <FlyCameraControls enabled={viewMode === "fly"} manifest={manifest} /> : null}
        <OrbitControls
          makeDefault
          enabled={viewMode === "overview"}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={160}
          maxPolarAngle={Math.PI / 2.15}
        />
        {manifest ? <FocusController manifest={manifest} enabled={viewMode === "overview"} /> : null}
      </Canvas>
      {viewMode === "street" || viewMode === "fly" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.45)]" />
      ) : null}
    </div>
  );
}

function WorldScene({ manifest }: { manifest: WorldManifest }) {
  const showDependencies = useWorldStore((state) => state.showDependencies);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);

  return (
    <>
      {manifest.districts.map((district) => (
        <DistrictBase key={district.id} district={district} />
      ))}
      {manifest.roads.map((road) => (
        <RoadMesh key={road.id} road={road} />
      ))}
      {manifest.landmarks.map((landmark) => (
        <LandmarkMesh key={landmark.id} landmark={landmark} />
      ))}
      {manifest.buildings.map((building) => (
        <BuildingMesh key={building.id} building={building} />
      ))}
      <StudField manifest={manifest} colorByLanguage={colorByLanguage} />
      {showDependencies ? <ConnectionLayer manifest={manifest} /> : null}
    </>
  );
}

const STUD_RADIUS = 0.2;
const STUD_HEIGHT = 0.28;

type StudInstance = { x: number; y: number; z: number; r: number; color: string };

// Every stud in the world is drawn through one InstancedMesh: thousands of studs
// become a single draw call, and they all share identical seating + lighting.
function StudField({ manifest, colorByLanguage }: { manifest: WorldManifest; colorByLanguage: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const instances = useMemo<StudInstance[]>(() => {
    const studs: StudInstance[] = [];

    for (const district of manifest.districts) {
      const color = tint(district.color, 0.5);
      for (const local of baseplateStudPositions(district.dimensions.width, district.dimensions.depth)) {
        studs.push({ x: district.position.x + local.x, y: 0.3, z: district.position.z + local.z, r: STUD_RADIUS * 1.05, color });
      }
    }

    for (const building of manifest.buildings) {
      const color = colorByLanguage ? building.color : "#94a3b8";
      const top = building.position.y + building.dimensions.height / 2;
      for (const local of buildingStudPositions(building.dimensions.width, building.dimensions.depth)) {
        studs.push({ x: building.position.x + local.x, y: top + STUD_HEIGHT / 2, z: building.position.z + local.z, r: STUD_RADIUS, color });
      }
    }

    for (const landmark of manifest.landmarks) {
      studs.push({
        x: landmark.position.x,
        y: landmark.position.y + landmark.dimensions.height / 2 + STUD_HEIGHT / 2,
        z: landmark.position.z,
        r: STUD_RADIUS * 1.1,
        color: landmark.color
      });
    }

    return studs;
  }, [colorByLanguage, manifest]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    instances.forEach((stud, index) => {
      dummy.position.set(stud.x, stud.y, stud.z);
      dummy.scale.set(stud.r, STUD_HEIGHT, stud.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, tmpColor.set(stud.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [instances]);

  if (instances.length === 0) {
    return null;
  }

  return (
    <instancedMesh key={instances.length} ref={ref} args={[undefined, undefined, instances.length]} castShadow receiveShadow>
      <cylinderGeometry args={[1, 1, 1, 20]} />
      <meshStandardMaterial roughness={0.34} metalness={0} envMapIntensity={0.7} />
    </instancedMesh>
  );
}

function SceneEnvironment() {
  // Procedural studio lighting baked into an env map for plastic-brick reflections.
  // Built entirely from Lightformers so it needs no external HDRI / network fetch.
  return (
    <Environment resolution={256}>
      <color attach="background" args={["#0b1220"]} />
      <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 14, 8]} scale={[20, 9, 1]} rotation={[-Math.PI / 2.3, 0, 0]} />
      <Lightformer form="rect" intensity={1.2} color="#d7e6ff" position={[-14, 7, -10]} scale={[11, 11, 1]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="rect" intensity={1.05} color="#fff1d6" position={[14, 6, 9]} scale={[11, 9, 1]} rotation={[0, -Math.PI / 3, 0]} />
      <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[7, 11, -7]} scale={6} />
    </Environment>
  );
}

function StreetCameraControls({ enabled, manifest }: { enabled: boolean; manifest: WorldManifest }) {
  const { camera, gl } = useThree();
  const yaw = useRef(-Math.PI / 4);
  const pitch = useRef(-0.08);
  const initializedKey = useRef("");
  const dragging = useRef(false);

  useEffect(() => {
    const element = gl.domElement;
    if (!enabled) {
      delete element.dataset.streetCamera;
      if (element.dataset.viewMode === "street") {
        element.dataset.viewMode = "overview";
      }
      dragging.current = false;
      return;
    }
    element.dataset.viewMode = "street";
    element.tabIndex = 0;
    element.focus({ preventScroll: true });

    const start = manifest.roads[0]?.points[0] ?? manifest.districts[0]?.position ?? { x: 0, y: 0, z: 0 };
    const next = manifest.roads[0]?.points[1] ?? { x: start.x + 1, y: start.y, z: start.z };
    const key = `${manifest.repo.fullName}:${manifest.generatedAt}`;

    if (initializedKey.current !== key || camera.position.y > 8) {
      camera.position.set(start.x, 1.75, start.z);
      yaw.current = Math.atan2(next.x - start.x, next.z - start.z);
      pitch.current = -0.04;
      if ("fov" in camera) {
        camera.fov = 64;
        camera.updateProjectionMatrix();
      }
      initializedKey.current = key;
    }

    return undefined;
  }, [camera, enabled, gl.domElement, manifest]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const element = gl.domElement;

    function handleWheel(event: WheelEvent) {
      // Dolly along the walking direction instead of distorting the field of view.
      event.preventDefault();
      const step = -event.deltaY * 0.01;
      camera.position.x += Math.sin(yaw.current) * step;
      camera.position.z += Math.cos(yaw.current) * step;
      camera.position.y = 1.75;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }
      dragging.current = true;
      element.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragging.current) {
        return;
      }
      yaw.current -= event.movementX * 0.004;
      pitch.current = clamp(pitch.current - event.movementY * 0.003, -0.85, 0.55);
    }

    function handlePointerUp(event: PointerEvent) {
      dragging.current = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    }

    element.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerUp);
    return () => {
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerUp);
      dragging.current = false;
    };
  }, [camera, enabled, gl.domElement]);

  useFrame((_, delta) => {
    if (!enabled) {
      return;
    }

    const pressedKeys = useWorldStore.getState().pressedKeys;
    const speed = pressedKeys.shift ? 10 : 5.5;
    const turnSpeed = 1.8;
    if (pressedKeys.arrowleft || pressedKeys.q) {
      yaw.current += turnSpeed * delta;
    }
    if (pressedKeys.arrowright || pressedKeys.e) {
      yaw.current -= turnSpeed * delta;
    }
    if (pressedKeys["+"] || pressedKeys["="] || pressedKeys["-"]) {
      const dollyDir = pressedKeys["-"] ? -1 : 1;
      camera.position.x += Math.sin(yaw.current) * dollyDir * 7 * delta;
      camera.position.z += Math.cos(yaw.current) * dollyDir * 7 * delta;
      camera.position.y = 1.75;
    }

    const forward = {
      x: Math.sin(yaw.current),
      z: Math.cos(yaw.current)
    };
    const right = {
      x: -Math.cos(yaw.current),
      z: Math.sin(yaw.current)
    };
    let moveX = 0;
    let moveZ = 0;
    if (pressedKeys.w || pressedKeys.arrowup) {
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (pressedKeys.s || pressedKeys.arrowdown) {
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (pressedKeys.d) {
      moveX += right.x;
      moveZ += right.z;
    }
    if (pressedKeys.a) {
      moveX -= right.x;
      moveZ -= right.z;
    }

    const magnitude = Math.hypot(moveX, moveZ);
    if (magnitude > 0) {
      camera.position.x += (moveX / magnitude) * speed * delta;
      camera.position.z += (moveZ / magnitude) * speed * delta;
      camera.position.y = 1.75;
    }

    const lookX = camera.position.x + Math.sin(yaw.current) * Math.cos(pitch.current);
    const lookY = camera.position.y + Math.sin(pitch.current);
    const lookZ = camera.position.z + Math.cos(yaw.current) * Math.cos(pitch.current);
    camera.lookAt(lookX, lookY, lookZ);
    gl.domElement.dataset.streetCamera = `${camera.position.x.toFixed(3)},${camera.position.z.toFixed(3)}`;
  });

  return null;
}

function FlyCameraControls({ enabled, manifest }: { enabled: boolean; manifest: WorldManifest }) {
  const { camera, gl } = useThree();
  const yaw = useRef(-Math.PI / 4);
  const pitch = useRef(-0.25);
  const initializedKey = useRef("");
  const dragging = useRef(false);
  const bounds = useMemo(() => manifestBounds(manifest), [manifest]);

  useEffect(() => {
    const element = gl.domElement;
    if (!enabled) {
      delete element.dataset.flyCamera;
      if (element.dataset.viewMode === "fly") {
        element.dataset.viewMode = "overview";
      }
      dragging.current = false;
      return;
    }

    element.dataset.viewMode = "fly";
    element.tabIndex = 0;
    element.focus({ preventScroll: true });

    const key = `${manifest.repo.fullName}:${manifest.generatedAt}`;
    if (initializedKey.current !== key || camera.position.y < 3) {
      const distance = clamp(bounds.radius * 0.72 + 14, 18, 82);
      const height = clamp(bounds.radius * 0.42 + 8, 8, 54);
      camera.position.set(bounds.center.x + distance * 0.5, height, bounds.center.z + distance * 0.72);
      const dx = bounds.center.x - camera.position.x;
      const dy = 1.4 - camera.position.y;
      const dz = bounds.center.z - camera.position.z;
      const horizontal = Math.hypot(dx, dz);
      yaw.current = Math.atan2(dx, dz);
      pitch.current = clamp(Math.atan2(dy, horizontal), -0.95, 0.45);
      if ("fov" in camera) {
        camera.fov = 58;
        camera.updateProjectionMatrix();
      }
      camera.lookAt(bounds.center.x, 1.4, bounds.center.z);
      initializedKey.current = key;
    }

    return undefined;
  }, [bounds, camera, enabled, gl.domElement, manifest]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const element = gl.domElement;

    function handleWheel(event: WheelEvent) {
      // Dolly along the look direction instead of distorting the field of view.
      event.preventDefault();
      const step = -event.deltaY * 0.02;
      const cosPitch = Math.cos(pitch.current);
      camera.position.x += Math.sin(yaw.current) * cosPitch * step;
      camera.position.y = clamp(camera.position.y + Math.sin(pitch.current) * step, 0.8, 180);
      camera.position.z += Math.cos(yaw.current) * cosPitch * step;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }
      dragging.current = true;
      element.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragging.current) {
        return;
      }
      yaw.current -= event.movementX * 0.004;
      pitch.current = clamp(pitch.current - event.movementY * 0.003, -1.22, 1.12);
    }

    function handlePointerUp(event: PointerEvent) {
      dragging.current = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    }

    element.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerUp);
    return () => {
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerUp);
      dragging.current = false;
    };
  }, [camera, enabled, gl.domElement]);

  useFrame((_, delta) => {
    if (!enabled) {
      return;
    }

    const pressedKeys = useWorldStore.getState().pressedKeys;
    const turnSpeed = 1.65;
    if (pressedKeys.arrowleft || pressedKeys.q) {
      yaw.current += turnSpeed * delta;
    }
    if (pressedKeys.arrowright || pressedKeys.e) {
      yaw.current -= turnSpeed * delta;
    }
    if (pressedKeys.arrowup) {
      pitch.current = clamp(pitch.current + turnSpeed * 0.62 * delta, -1.22, 1.12);
    }
    if (pressedKeys.arrowdown) {
      pitch.current = clamp(pitch.current - turnSpeed * 0.62 * delta, -1.22, 1.12);
    }
    if (pressedKeys["+"] || pressedKeys["="] || pressedKeys["-"]) {
      const dollyDir = pressedKeys["-"] ? -1 : 1;
      const cosP = Math.cos(pitch.current);
      const maxHeight = clamp(bounds.radius * 1.8 + 36, 44, 180);
      camera.position.x += Math.sin(yaw.current) * cosP * dollyDir * 14 * delta;
      camera.position.y = clamp(camera.position.y + Math.sin(pitch.current) * dollyDir * 14 * delta, 0.8, maxHeight);
      camera.position.z += Math.cos(yaw.current) * cosP * dollyDir * 14 * delta;
    }

    const cosPitch = Math.cos(pitch.current);
    const forward = {
      x: Math.sin(yaw.current) * cosPitch,
      y: Math.sin(pitch.current),
      z: Math.cos(yaw.current) * cosPitch
    };
    const right = {
      x: -Math.cos(yaw.current),
      y: 0,
      z: Math.sin(yaw.current)
    };
    let moveX = 0;
    let moveY = 0;
    let moveZ = 0;

    if (pressedKeys.w) {
      moveX += forward.x;
      moveY += forward.y;
      moveZ += forward.z;
    }
    if (pressedKeys.s) {
      moveX -= forward.x;
      moveY -= forward.y;
      moveZ -= forward.z;
    }
    if (pressedKeys.d) {
      moveX += right.x;
      moveZ += right.z;
    }
    if (pressedKeys.a) {
      moveX -= right.x;
      moveZ -= right.z;
    }
    if (pressedKeys[" "] || pressedKeys.r) {
      moveY += 1;
    }
    if (pressedKeys.f || pressedKeys.c) {
      moveY -= 1;
    }

    const magnitude = Math.hypot(moveX, moveY, moveZ);
    if (magnitude > 0) {
      const speed = pressedKeys.shift ? 24 : 11;
      const maxHeight = clamp(bounds.radius * 1.8 + 36, 44, 180);
      camera.position.x += (moveX / magnitude) * speed * delta;
      camera.position.y = clamp(camera.position.y + (moveY / magnitude) * speed * delta, 0.8, maxHeight);
      camera.position.z += (moveZ / magnitude) * speed * delta;
    }

    const lookX = camera.position.x + Math.sin(yaw.current) * Math.cos(pitch.current);
    const lookY = camera.position.y + Math.sin(pitch.current);
    const lookZ = camera.position.z + Math.cos(yaw.current) * Math.cos(pitch.current);
    camera.lookAt(lookX, lookY, lookZ);
    gl.domElement.dataset.flyCamera = `${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)}`;
  });

  return null;
}

// Smoothly frames the selected brick (click-to-focus) or, on reset, the whole city.
// Only active in overview, where it drives the default OrbitControls.
function FocusController({ manifest, enabled }: { manifest: WorldManifest; enabled: boolean }) {
  const controls = useThree((state) => state.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((state) => state.camera);
  const selection = useWorldStore((state) => state.selection);
  const resetNonce = useWorldStore((state) => state.resetNonce);
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!enabled) {
      goal.current = null;
      return;
    }
    goal.current = selection ? focusTargetFor(manifest, selection) : null;
  }, [enabled, manifest, selection]);

  useEffect(() => {
    if (!enabled || resetNonce === 0) {
      return;
    }
    goal.current = framing(new THREE.Vector3(manifestBounds(manifest).center.x, 0, manifestBounds(manifest).center.z), manifestBounds(manifest).radius);
  }, [enabled, manifest, resetNonce]);

  useFrame(() => {
    const target = goal.current;
    if (!enabled || !target || !controls) {
      return;
    }
    camera.position.lerp(target.pos, 0.12);
    controls.target.lerp(target.look, 0.12);
    controls.update();
    if (camera.position.distanceTo(target.pos) < 0.08) {
      goal.current = null;
    }
  });

  return null;
}

function focusTargetFor(manifest: WorldManifest, selection: NonNullable<Selection>): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
  if (selection.kind === "building") {
    const item = manifest.buildings.find((building) => building.id === selection.id);
    if (!item) return null;
    return framing(new THREE.Vector3(item.position.x, item.position.y, item.position.z), Math.max(item.dimensions.width, item.dimensions.height) * 0.9 + 1.3);
  }
  if (selection.kind === "landmark") {
    const item = manifest.landmarks.find((landmark) => landmark.id === selection.id);
    if (!item) return null;
    return framing(new THREE.Vector3(item.position.x, item.position.y, item.position.z), Math.max(item.dimensions.width, item.dimensions.height) + 1.6);
  }
  if (selection.kind === "district") {
    const item = manifest.districts.find((district) => district.id === selection.id);
    if (!item) return null;
    return framing(new THREE.Vector3(item.position.x, 0.6, item.position.z), Math.max(item.dimensions.width, item.dimensions.depth) * 0.6 + 2.4);
  }
  if (selection.kind === "road") {
    const item = manifest.roads.find((road) => road.id === selection.id);
    if (!item) return null;
    const mid = roadMidpoint(item);
    return framing(new THREE.Vector3(mid.x, 0.4, mid.z), 5);
  }
  const link = manifest.connections.find((connection) => connection.id === selection.id);
  if (!link) return null;
  const from = manifest.buildings.find((building) => building.id === link.from);
  const to = manifest.buildings.find((building) => building.id === link.to);
  if (!from || !to) return null;
  const center = new THREE.Vector3((from.position.x + to.position.x) / 2, 1.5, (from.position.z + to.position.z) / 2);
  const radius = Math.hypot(from.position.x - to.position.x, from.position.z - to.position.z) / 2 + 3.5;
  return framing(center, radius);
}

function framing(center: THREE.Vector3, radius: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const distance = radius * 2.1 + 3;
  return {
    look: center.clone(),
    pos: new THREE.Vector3(center.x + distance * 0.7, center.y + distance * 0.62, center.z + distance * 0.7)
  };
}

function EmptyScene({ isLoading }: { isLoading: boolean }) {
  const blocks = isLoading
    ? [
        { x: -1.7, h: 1.8, c: "#eb5757" },
        { x: 0, h: 2.6, c: "#f2c94c" },
        { x: 1.7, h: 1.3, c: "#2f80ed" }
      ]
    : [
        { x: -1.7, h: 1.1, c: "#eb5757" },
        { x: 0, h: 1.1, c: "#f2c94c" },
        { x: 1.7, h: 1.1, c: "#27ae60" }
      ];

  return (
    <group position={[0, 0, 0]}>
      <mesh receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[7.5, 0.22, 4.5]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {blocks.map((block) => (
        <group key={block.x} position={[block.x, block.h / 2 + 0.2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, block.h, 1.2]} />
            <meshStandardMaterial color={block.c} roughness={0.62} />
          </mesh>
          <Stud position={{ x: 0, y: block.h / 2 + 0.12, z: 0 }} color={block.c} />
        </group>
      ))}
    </group>
  );
}

function DistrictBase({ district }: { district: District }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const selected = selection?.kind === "district" && selection.id === district.id;

  return (
    <group position={[district.position.x, 0, district.position.z]}>
      <mesh
        receiveShadow
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          setSelection({ kind: "district", id: district.id });
        }}
      >
        <boxGeometry args={[district.dimensions.width, 0.28, district.dimensions.depth]} />
        <meshStandardMaterial color={tint(district.color, 0.5)} roughness={0.5} metalness={0} envMapIntensity={0.4} emissive="#ffffff" emissiveIntensity={selected ? 0.16 : 0} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[district.dimensions.width * 0.96, 0.05, district.dimensions.depth * 0.96]} />
        <meshStandardMaterial color={tint(district.color, 0.6)} roughness={0.48} metalness={0} envMapIntensity={0.4} emissive="#ffffff" emissiveIntensity={selected ? 0.16 : 0} />
      </mesh>
      <SceneLabel position={{ x: 0, y: 0.58, z: -district.dimensions.depth / 2 + 0.72 }} tone="sector">
        {districtLabel(district.name)}
      </SceneLabel>
    </group>
  );
}

function RoadMesh({ road }: { road: Road }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "road" && selection.id === road.id;
  const midpoint = roadMidpoint(road);
  const isConnector = road.kind === "connector";
  const roadY = isConnector ? 0.05 : 0.03;
  const roadHeight = 0.05;
  const roadWidth = road.width * 0.72;
  const surfaceColor = selected ? "#9aa7bb" : isConnector ? "#7e8ca1" : "#6f7c8e";
  const stripeColor = selected ? "#0f172a" : "#cdd6e4";
  const labelOffset = roadLabelOffset(road.id, isConnector ? 1.05 : 0.55);

  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setSelection({ kind: "road", id: road.id });
      }}
    >
      {road.points.slice(1).map((point, index) => {
        const previous = road.points[index];
        const dx = point.x - previous.x;
        const dz = point.z - previous.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.05) {
          return null;
        }
        return (
          <group
            key={`${road.id}:${index}`}
            position={[(point.x + previous.x) / 2, roadY, (point.z + previous.z) / 2]}
            rotation={[0, Math.atan2(dx, dz), 0]}
          >
            <mesh receiveShadow renderOrder={isConnector ? 2 : 1}>
              <boxGeometry args={[roadWidth, roadHeight, length]} />
              <meshStandardMaterial color={surfaceColor} roughness={0.85} metalness={0} envMapIntensity={0.2} />
            </mesh>
            <mesh position={[0, roadHeight / 2 + 0.012, 0]} renderOrder={isConnector ? 3 : 2}>
              <boxGeometry args={[0.06, 0.02, Math.max(0.3, length * 0.82)]} />
              <meshStandardMaterial color={stripeColor} roughness={0.5} emissive="#ffffff" emissiveIntensity={selected ? 0 : 0.05} />
            </mesh>
          </group>
        );
      })}
      {hovered || selected ? (
        <SceneLabel position={{ x: midpoint.x + labelOffset.x, y: isConnector ? 0.5 : 0.4, z: midpoint.z + labelOffset.z }} tone="road">
          {road.name}
        </SceneLabel>
      ) : null}
    </group>
  );
}

function BuildingMesh({ building }: { building: Building }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);
  const highlightComplexity = useWorldStore((state) => state.highlightComplexity);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "building" && selection.id === building.id;
  const color = colorByLanguage ? building.color : "#94a3b8";
  const glow = selected ? 0.26 : hovered ? 0.13 : 0;
  const accent = building.complexity >= 8 ? "#eb5757" : building.complexity >= 5 ? "#f2994a" : "#27ae60";
  const windowRows = useMemo(() => buildingWindowRows(building.dimensions.height), [building.dimensions.height]);
  const profile = useMemo(() => buildingProfile(building), [building]);

  return (
    <group
      position={[building.position.x, building.position.y, building.position.z]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setSelection({ kind: "building", id: building.id });
      }}
    >
      <mesh receiveShadow position={[0, -building.dimensions.height / 2 + 0.035, 0]}>
        <boxGeometry args={[building.dimensions.width * 1.08, 0.07, building.dimensions.depth * 1.08]} />
        <meshStandardMaterial color={tint(color, 0.32)} roughness={0.46} metalness={0} envMapIntensity={0.5} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[building.dimensions.width, building.dimensions.height, building.dimensions.depth]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0} envMapIntensity={0.6} emissive="#ffffff" emissiveIntensity={glow} />
      </mesh>
      {windowRows.map((y) => (
        <mesh key={y} position={[0, y, building.dimensions.depth / 2 + 0.018]}>
          <boxGeometry args={[building.dimensions.width * 0.62, 0.08, 0.035]} />
          <meshStandardMaterial color={tint(color, 0.62)} roughness={0.18} metalness={0.1} envMapIntensity={1.1} emissive="#bcd4ff" emissiveIntensity={selected || hovered ? 0.4 : 0.16} />
        </mesh>
      ))}
      {building.imports > 2 ? (
        <group position={[0, building.dimensions.height / 2 + 0.28, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.36, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.38} />
          </mesh>
          <mesh castShadow position={[0, 0.23, 0]}>
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshStandardMaterial color={accent} roughness={0.4} />
          </mesh>
        </group>
      ) : null}
      <BuildingRoof building={building} profile={profile} selected={selected} hovered={hovered} />
      {building.symbols >= 10 ? <SymbolStack building={building} color={accent} /> : null}
      {building.todos > 0 ? <TodoScaffold building={building} todos={building.todos} /> : null}
      {highlightComplexity ? (
        <mesh position={[0, building.dimensions.height / 2 + 0.025, 0]}>
          <boxGeometry args={[building.dimensions.width * 0.92, 0.06, building.dimensions.depth * 0.92]} />
          <meshStandardMaterial color={accent} roughness={0.48} />
        </mesh>
      ) : null}
      {selected || hovered ? <SceneLabel position={{ x: 0, y: building.dimensions.height / 2 + 0.58, z: 0 }}>{building.name}</SceneLabel> : null}
    </group>
  );
}

type BuildingProfile = {
  role: "entry" | "test" | "config" | "style" | "data" | "utility" | "source";
  roofColor: string;
};

function BuildingRoof({
  building,
  profile,
  selected,
  hovered
}: {
  building: Building;
  profile: BuildingProfile;
  selected: boolean;
  hovered: boolean;
}) {
  const top = building.dimensions.height / 2;
  const roofColor = selected || hovered ? tint(profile.roofColor, 0.14) : profile.roofColor;
  const shine = selected ? 0.22 : hovered ? 0.12 : 0.04;

  if (profile.role === "entry") {
    return (
      <mesh castShadow position={[0, top + 0.18, 0]} scale={[1, 0.46, 1]}>
        <sphereGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.44, 22, 12]} />
        <meshStandardMaterial color={roofColor} roughness={0.28} metalness={0} envMapIntensity={0.9} emissive="#fff7cc" emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "config") {
    return (
      <mesh castShadow position={[0, top + 0.22, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.62, 0.44, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.32} metalness={0} envMapIntensity={0.8} emissive="#ffffff" emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "test") {
    return (
      <group position={[0, top + 0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[building.dimensions.width * 0.92, 0.14, building.dimensions.depth * 0.3]} />
          <meshStandardMaterial color={roofColor} roughness={0.34} metalness={0} envMapIntensity={0.75} emissive="#dcfce7" emissiveIntensity={shine} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[building.dimensions.width * 0.3, 0.16, building.dimensions.depth * 0.92]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0} envMapIntensity={0.75} />
        </mesh>
      </group>
    );
  }

  if (profile.role === "data") {
    return (
      <mesh castShadow position={[0, top + 0.1, 0]}>
        <cylinderGeometry args={[building.dimensions.width * 0.42, building.dimensions.width * 0.42, 0.18, 18]} />
        <meshStandardMaterial color={roofColor} roughness={0.3} metalness={0} envMapIntensity={0.85} emissive="#ffffff" emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "style") {
    return (
      <mesh castShadow position={[0, top + 0.2, 0]}>
        <coneGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.54, 0.4, 3]} />
        <meshStandardMaterial color={roofColor} roughness={0.26} metalness={0} envMapIntensity={0.95} emissive="#e0f2fe" emissiveIntensity={shine} />
      </mesh>
    );
  }

  return (
    <mesh castShadow position={[0, top + 0.08, 0]}>
      <boxGeometry args={[building.dimensions.width * 0.78, 0.14, building.dimensions.depth * 0.78]} />
      <meshStandardMaterial color={roofColor} roughness={0.32} metalness={0} envMapIntensity={0.75} emissive="#ffffff" emissiveIntensity={shine} />
    </mesh>
  );
}

function SymbolStack({ building, color }: { building: Building; color: string }) {
  const top = building.dimensions.height / 2;
  const plates = Math.min(4, Math.max(2, Math.ceil(building.symbols / 18)));

  return (
    <group position={[-building.dimensions.width * 0.3, top + 0.12, -building.dimensions.depth * 0.3]}>
      {Array.from({ length: plates }, (_, index) => (
        <mesh key={index} castShadow position={[0, index * 0.09, 0]}>
          <boxGeometry args={[building.dimensions.width * 0.34, 0.055, building.dimensions.depth * 0.34]} />
          <meshStandardMaterial color={index % 2 === 0 ? color : "#f8fafc"} roughness={0.3} metalness={0} envMapIntensity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function TodoScaffold({ building, todos }: { building: Building; todos: number }) {
  const width = building.dimensions.width + 0.42;
  const depth = building.dimensions.depth + 0.42;
  const height = building.dimensions.height + 0.58;
  const top = building.dimensions.height / 2 + 0.32;
  const glow = clamp(todos * 0.05, 0.12, 0.36);
  const materialProps = { color: "#f59e0b", roughness: 0.34, metalness: 0.05, envMapIntensity: 0.75, emissive: "#f59e0b", emissiveIntensity: glow };

  return (
    <group>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}:${z}`} castShadow position={[(width / 2) * x, 0.08, (depth / 2) * z]}>
            <boxGeometry args={[0.055, height, 0.055]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
        ))
      )}
      {[-1, 1].map((z) => (
        <mesh key={`top-x:${z}`} castShadow position={[0, top, (depth / 2) * z]}>
          <boxGeometry args={[width, 0.055, 0.055]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      ))}
      {[-1, 1].map((x) => (
        <mesh key={`top-z:${x}`} castShadow position={[(width / 2) * x, top, 0]}>
          <boxGeometry args={[0.055, 0.055, depth]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      ))}
      <mesh castShadow position={[0, -building.dimensions.height * 0.1, depth / 2]}>
        <boxGeometry args={[width * 0.82, 0.045, 0.045]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    </group>
  );
}

function LandmarkMesh({ landmark }: { landmark: Landmark }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "landmark" && selection.id === landmark.id;
  const color = landmark.color;
  const glow = selected ? 0.26 : hovered ? 0.13 : 0;

  return (
    <group
      position={[landmark.position.x, landmark.position.y, landmark.position.z]}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setSelection({ kind: "landmark", id: landmark.id });
      }}
    >
      <mesh receiveShadow position={[0, -landmark.dimensions.height / 2 + 0.06, 0]}>
        <boxGeometry args={[landmark.dimensions.width * 1.16, 0.12, landmark.dimensions.depth * 1.16]} />
        <meshStandardMaterial color={tint(landmark.color, 0.5)} roughness={0.46} metalness={0} envMapIntensity={0.5} emissive="#ffffff" emissiveIntensity={glow * 0.6} />
      </mesh>
      {landmark.kind === "automation_panel" ? (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[landmark.dimensions.width / 2, landmark.dimensions.width / 2, landmark.dimensions.height, 24]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} envMapIntensity={0.6} emissive="#ffffff" emissiveIntensity={glow} />
        </mesh>
      ) : landmark.kind === "instruction_center" ? (
        <>
          <mesh castShadow receiveShadow position={[0, -0.1, 0]}>
            <boxGeometry args={[landmark.dimensions.width, landmark.dimensions.height * 0.72, landmark.dimensions.depth]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0} envMapIntensity={0.6} emissive="#ffffff" emissiveIntensity={glow} />
          </mesh>
          <mesh castShadow position={[0, landmark.dimensions.height * 0.35, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[landmark.dimensions.width * 0.62, landmark.dimensions.height * 0.6, 4]} />
            <meshStandardMaterial color="#f4f7fb" roughness={0.42} metalness={0} envMapIntensity={0.6} />
          </mesh>
        </>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[landmark.dimensions.width, landmark.dimensions.height, landmark.dimensions.depth]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0} envMapIntensity={0.6} emissive="#ffffff" emissiveIntensity={glow} />
        </mesh>
      )}
      {selected || hovered ? <SceneLabel position={{ x: 0, y: landmark.dimensions.height / 2 + 0.58, z: 0 }}>{landmark.name}</SceneLabel> : null}
    </group>
  );
}

function ConnectionLayer({ manifest }: { manifest: WorldManifest }) {
  const flowRef = useRef<THREE.InstancedMesh>(null);
  const pulseObject = useMemo(() => new THREE.Object3D(), []);
  const { positions, flowPaths } = useMemo(() => {
    const buildingById = new Map(manifest.buildings.map((building) => [building.id, building]));
    const values: number[] = [];
    const paths: Array<{ from: Vec3; mid: Vec3; to: Vec3 }> = [];

    for (const connection of manifest.connections) {
      const from = buildingById.get(connection.from);
      const to = buildingById.get(connection.to);
      if (!from || !to) {
        continue;
      }

      const fromPoint = {
        x: from.position.x,
        y: from.position.y + from.dimensions.height / 2 + 0.32,
        z: from.position.z
      };
      const toPoint = {
        x: to.position.x,
        y: to.position.y + to.dimensions.height / 2 + 0.32,
        z: to.position.z
      };
      const midPoint = {
        x: (fromPoint.x + toPoint.x) / 2,
        y: Math.max(fromPoint.y, toPoint.y) + 0.9,
        z: (fromPoint.z + toPoint.z) / 2
      };

      values.push(fromPoint.x, fromPoint.y, fromPoint.z, midPoint.x, midPoint.y, midPoint.z);
      values.push(midPoint.x, midPoint.y, midPoint.z, toPoint.x, toPoint.y, toPoint.z);
      paths.push({ from: fromPoint, mid: midPoint, to: toPoint });
    }

    return { positions: new Float32Array(values), flowPaths: paths.slice(0, 240) };
  }, [manifest.buildings, manifest.connections]);

  useFrame((state) => {
    const mesh = flowRef.current;
    if (!mesh || flowPaths.length === 0) {
      return;
    }

    const elapsed = state.clock.elapsedTime;
    flowPaths.forEach((path, index) => {
      const t = (elapsed * 0.22 + index * 0.071) % 1;
      const point = pointOnConnectionPath(path, t);
      const scale = 0.08 + Math.sin((t + index * 0.17) * Math.PI) * 0.035;
      pulseObject.position.set(point.x, point.y, point.z);
      pulseObject.scale.setScalar(scale);
      pulseObject.updateMatrix();
      mesh.setMatrixAt(index, pulseObject.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (positions.length === 0) {
    return null;
  }

  return (
    <>
      <lineSegments renderOrder={1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#2563eb" transparent opacity={0.52} depthWrite={false} />
      </lineSegments>
      {flowPaths.length > 0 ? (
        <instancedMesh ref={flowRef} args={[undefined, undefined, flowPaths.length]} renderOrder={2}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#38bdf8" emissive="#2563eb" emissiveIntensity={1.25} roughness={0.2} transparent opacity={0.86} depthWrite={false} />
        </instancedMesh>
      ) : null}
    </>
  );
}

function SceneLabel({ children, position, tone = "default" }: { children: string; position: Vec3; tone?: "default" | "road" | "sector" }) {
  const className =
    tone === "sector"
      ? "origin-center max-w-24 rounded border border-slate-300 bg-white/95 px-1.5 py-0.5 text-center text-[8px] font-semibold leading-tight text-slate-950 shadow-sm sm:text-[10px]"
      : tone === "road"
        ? "origin-center rounded border border-slate-400 bg-slate-900/88 px-2 py-0.5 text-center text-[8px] font-medium leading-tight text-white shadow-sm sm:text-[10px]"
        : "origin-center rounded border border-slate-200 bg-white/95 px-2 py-1 text-center text-[9px] font-medium leading-tight text-slate-950 shadow-sm sm:text-[10px]";
  const distanceFactor = tone === "sector" ? 10 : tone === "road" ? 11 : 12;

  return (
    <Html center distanceFactor={distanceFactor} position={[position.x, position.y, position.z]} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div className={className}>{children}</div>
    </Html>
  );
}

function Stud({ position, color }: { position: Vec3; color: string }) {
  return (
    <mesh castShadow position={[position.x, position.y, position.z]}>
      <cylinderGeometry args={[0.18, 0.18, 0.16, 20]} />
      <meshStandardMaterial color={color} roughness={0.34} metalness={0} envMapIntensity={0.7} />
    </mesh>
  );
}

function useCompactViewport(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const updateViewport = () => setIsCompact(window.innerWidth < 640);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  return isCompact;
}

function baseplateStudPositions(width: number, depth: number): Vec3[] {
  const columns = clampInt(Math.floor((width - 1.4) / 2.15) + 1, 2, 7);
  const rows = clampInt(Math.floor((depth - 1.4) / 2.15) + 1, 2, 6);
  const left = -width / 2 + 0.75;
  const right = width / 2 - 0.75;
  const top = -depth / 2 + 0.75;
  const bottom = depth / 2 - 0.75;
  const positions: Vec3[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = columns === 1 ? 0 : left + ((right - left) * column) / (columns - 1);
      const z = rows === 1 ? 0 : top + ((bottom - top) * row) / (rows - 1);
      positions.push({ x: roundTo(x, 2), y: 0, z: roundTo(z, 2) });
    }
  }

  return positions;
}

function buildingStudPositions(width: number, depth: number): Vec3[] {
  const xOffset = width * 0.24;
  if (depth >= 1.35) {
    const zOffset = depth * 0.24;
    return [
      { x: -xOffset, y: 0, z: -zOffset },
      { x: xOffset, y: 0, z: -zOffset },
      { x: -xOffset, y: 0, z: zOffset },
      { x: xOffset, y: 0, z: zOffset }
    ];
  }
  return [
    { x: -xOffset, y: 0, z: 0 },
    { x: xOffset, y: 0, z: 0 }
  ];
}

function buildingWindowRows(height: number): number[] {
  const count = clampInt(Math.floor(height / 0.55), 1, 4);
  const bottom = -height / 2 + 0.32;
  const top = height / 2 - 0.32;

  if (count === 1) {
    return [roundTo((bottom + top) / 2, 2)];
  }

  return Array.from({ length: count }, (_, index) => roundTo(bottom + ((top - bottom) * index) / (count - 1), 2));
}

function buildingProfile(building: Building): BuildingProfile {
  const lowerPath = building.path.toLowerCase();
  const name = lowerPath.split("/").pop() ?? lowerPath;
  const language = building.language.toLowerCase();

  if (
    /(^|\/)(index|main|app|page|layout|route|server|worker|cli)\.[cm]?[jt]sx?$/.test(lowerPath) ||
    ["main.py", "__main__.py", "app.py", "server.py"].includes(name)
  ) {
    return { role: "entry", roofColor: "#facc15" };
  }

  if (/(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(lowerPath)) {
    return { role: "test", roofColor: "#22c55e" };
  }

  if (
    /(^|\/)(package|tsconfig|vite\.config|next\.config|eslint\.config|tailwind\.config|postcss\.config|vitest\.config|playwright\.config|webpack\.config|rollup\.config|babel\.config)/.test(
      lowerPath
    ) ||
    language.includes("manifest") ||
    language.includes("docker")
  ) {
    return { role: "config", roofColor: "#ef4444" };
  }

  if (
    language.includes("css") ||
    language.includes("svg") ||
    language.includes("mdx") ||
    language.includes("markdown") ||
    /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf)$/.test(lowerPath)
  ) {
    return { role: "style", roofColor: "#38bdf8" };
  }

  if (
    language.includes("json") ||
    language.includes("yaml") ||
    language.includes("toml") ||
    language.includes("sql") ||
    language.includes("graphql") ||
    language.includes("prisma") ||
    language.includes("xml")
  ) {
    return { role: "data", roofColor: "#f59e0b" };
  }

  if (/(^|\/)(utils?|helpers?|hooks?|services?|lib)\//.test(lowerPath) || /(util|helper|client|service|adapter|parser)/.test(name)) {
    return { role: "utility", roofColor: "#94a3b8" };
  }

  return { role: "source", roofColor: tint(building.color, building.imports > 4 ? 0.08 : 0.24) };
}

function districtLabel(name: string): string {
  return name.replace(/\s+Baseplate$/i, "");
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function manifestBounds(manifest: WorldManifest): { center: Vec3; radius: number } {
  const points: Vec3[] = [];

  for (const district of manifest.districts) {
    const halfWidth = district.dimensions.width / 2;
    const halfDepth = district.dimensions.depth / 2;
    points.push(
      { x: district.position.x - halfWidth, y: 0, z: district.position.z - halfDepth },
      { x: district.position.x + halfWidth, y: 0, z: district.position.z + halfDepth }
    );
  }

  for (const road of manifest.roads) {
    points.push(...road.points);
  }

  if (points.length === 0) {
    return { center: { x: 0, y: 0, z: 0 }, radius: 16 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const center = { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 };
  const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2;
  return { center, radius };
}

function overviewCameraDistance(manifest: WorldManifest, isCompactViewport: boolean): number {
  const { radius } = manifestBounds(manifest);
  const baseDistance = radius * 1.28 + 8;
  return clamp(baseDistance * (isCompactViewport ? 0.72 : 1), isCompactViewport ? 22 : 28, 118);
}

function roadLabelOffset(id: string, distance: number): Vec3 {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  return { x: roundTo(Math.cos(angle) * distance, 2), y: 0, z: roundTo(Math.sin(angle) * distance, 2) };
}

function tint(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const r = Math.min(255, Math.round(((value >> 16) & 255) + (255 - ((value >> 16) & 255)) * amount));
  const g = Math.min(255, Math.round(((value >> 8) & 255) + (255 - ((value >> 8) & 255)) * amount));
  const b = Math.min(255, Math.round((value & 255) + (255 - (value & 255)) * amount));
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function roadMidpoint(road: Road): Vec3 {
  if (road.points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const total = road.points.slice(1).reduce((sum, point, index) => {
    const previous = road.points[index];
    return sum + Math.hypot(point.x - previous.x, point.z - previous.z);
  }, 0);
  if (total <= 0) {
    return road.points[0];
  }

  let walked = 0;
  const target = total / 2;
  for (let index = 1; index < road.points.length; index += 1) {
    const previous = road.points[index - 1];
    const point = road.points[index];
    const segment = Math.hypot(point.x - previous.x, point.z - previous.z);
    if (walked + segment >= target) {
      const t = (target - walked) / segment;
      return {
        x: previous.x + (point.x - previous.x) * t,
        y: 0,
        z: previous.z + (point.z - previous.z) * t
      };
    }
    walked += segment;
  }
  return road.points.at(-1) ?? road.points[0];
}

function pointOnConnectionPath(path: { from: Vec3; mid: Vec3; to: Vec3 }, t: number): Vec3 {
  const firstHalf = t < 0.5;
  const start = firstHalf ? path.from : path.mid;
  const end = firstHalf ? path.mid : path.to;
  const localT = firstHalf ? t * 2 : (t - 0.5) * 2;

  return {
    x: start.x + (end.x - start.x) * localT,
    y: start.y + (end.y - start.y) * localT,
    z: start.z + (end.z - start.z) * localT
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
