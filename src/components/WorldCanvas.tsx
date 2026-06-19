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

type SceneTheme = "day" | "neon";

export function WorldCanvas({ manifest, isLoading }: Props) {
  const viewMode = useWorldStore((state) => state.viewMode);
  const sceneTheme = useWorldStore((state) => state.sceneTheme);
  const isCompactViewport = useCompactViewport();
  const neon = sceneTheme === "neon";
  const camera = useMemo(() => {
    const distance = manifest ? overviewCameraDistance(manifest, isCompactViewport) : 28;
    return { position: [distance, distance * 0.7, distance] as [number, number, number], fov: 45 };
  }, [isCompactViewport, manifest]);

  return (
    <div
      className="relative h-full min-h-[58vh] w-full md:min-h-0"
      data-testid="world-canvas"
      style={{
        background: neon
          ? "radial-gradient(120% 100% at 50% 0%, #172554 0%, #0f172a 44%, #050816 78%, #020617 100%)"
          : "radial-gradient(120% 90% at 50% 0%, #f3f7fe 0%, #e4edfa 45%, #d4e0f1 78%, #c7d6ec 100%)"
      }}
    >
      <Canvas
        camera={camera}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: neon ? 1.18 : 1.06 }}
        className="h-full w-full"
        onPointerMissed={() => useWorldStore.getState().setSelection(null)}
      >
        <SoftShadows size={28} samples={12} focus={0.65} />
        <fog attach="fog" args={[neon ? "#050816" : "#cdd9ed", neon ? 70 : 120, neon ? 250 : 320]} />
        <hemisphereLight color={neon ? "#38bdf8" : "#ffffff"} groundColor={neon ? "#0f172a" : "#9fb0c8"} intensity={neon ? 0.28 : 0.42} />
        <ambientLight intensity={neon ? 0.1 : 0.22} />
        <directionalLight
          castShadow
          position={[26, 38, 18]}
          intensity={neon ? 0.9 : 1.55}
          color={neon ? "#a5f3fc" : "#fff6e8"}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00035}
          shadow-normalBias={0.02}
        >
          <orthographicCamera attach="shadow-camera" args={[-70, 70, 70, -70, 1, 160]} />
        </directionalLight>
        <directionalLight position={[-22, 20, -24]} intensity={neon ? 0.55 : 0.32} color={neon ? "#f0abfc" : "#cfe0ff"} />
        {neon ? (
          <>
            <pointLight position={[0, 10, 0]} intensity={2.4} distance={60} color="#22d3ee" />
            <pointLight position={[-18, 7, 14]} intensity={1.9} distance={46} color="#f472b6" />
            <pointLight position={[18, 7, -12]} intensity={1.6} distance={46} color="#a78bfa" />
          </>
        ) : null}
        <SceneEnvironment theme={sceneTheme} />
        <group position={[0, 0, 0]}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <planeGeometry args={[420, 420]} />
            <meshStandardMaterial color={neon ? "#060a1a" : "#d3deee"} roughness={neon ? 0.72 : 0.96} metalness={0} emissive={neon ? "#0f172a" : "#000000"} emissiveIntensity={neon ? 0.35 : 0} />
          </mesh>
          <gridHelper args={[420, 84, neon ? "#0ea5e9" : "#aebccf", neon ? "#1e293b" : "#c5d2e4"]} position={[0, 0.006, 0]} />
          {manifest ? <WorldScene manifest={manifest} theme={sceneTheme} /> : <EmptyScene isLoading={isLoading} theme={sceneTheme} />}
          <ContactShadows frames={1} position={[0, 0.02, 0]} scale={260} resolution={1024} blur={2.4} opacity={neon ? 0.28 : 0.42} far={40} color={neon ? "#22d3ee" : "#33415c"} />
        </group>
        {manifest ? <StreetCameraControls enabled={viewMode === "street"} manifest={manifest} /> : null}
        {manifest ? <FlyCameraControls enabled={viewMode === "fly"} manifest={manifest} /> : null}
        {manifest ? <CameraAnchorReporter /> : null}
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

function WorldScene({ manifest, theme }: { manifest: WorldManifest; theme: SceneTheme }) {
  const showDependencies = useWorldStore((state) => state.showDependencies);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);

  return (
    <>
      {manifest.districts.map((district) => (
        <DistrictBase key={district.id} district={district} theme={theme} />
      ))}
      {manifest.roads.map((road) => (
        <RoadMesh key={road.id} road={road} theme={theme} />
      ))}
      {manifest.landmarks.map((landmark) => (
        <LandmarkMesh key={landmark.id} landmark={landmark} theme={theme} />
      ))}
      {manifest.buildings.map((building) => (
        <BuildingMesh key={building.id} building={building} theme={theme} />
      ))}
      <DecorativeLayer manifest={manifest} theme={theme} />
      <StudField manifest={manifest} colorByLanguage={colorByLanguage} theme={theme} />
      {showDependencies ? <ConnectionLayer manifest={manifest} theme={theme} /> : null}
    </>
  );
}

function CameraAnchorReporter() {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as unknown as { target?: THREE.Vector3 } | null;
  const last = useRef(new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN));

  useFrame(() => {
    const viewMode = useWorldStore.getState().viewMode;
    const source = viewMode === "overview" && controls?.target ? controls.target : camera.position;
    if (last.current.distanceTo(source) < 2) {
      return;
    }
    last.current.copy(source);
    useWorldStore.getState().setViewportAnchor({
      x: roundTo(source.x, 1),
      y: roundTo(source.y, 1),
      z: roundTo(source.z, 1)
    });
  });

  return null;
}

const STUD_RADIUS = 0.2;
const STUD_HEIGHT = 0.28;

type StudInstance = { x: number; y: number; z: number; r: number; color: string };

type DecorativeTower = {
  id: string;
  position: Vec3;
  width: number;
  depth: number;
  height: number;
  color: string;
  accent: string;
  rotation: number;
  variant: "stack" | "kiosk" | "spire";
};

type DecorativeCrane = {
  id: string;
  position: Vec3;
  rotation: number;
  height: number;
  color: string;
  accent: string;
};

// Every stud in the world is drawn through one InstancedMesh: thousands of studs
// become a single draw call, and they all share identical seating + lighting.
function StudField({ manifest, colorByLanguage, theme }: { manifest: WorldManifest; colorByLanguage: boolean; theme: SceneTheme }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const instances = useMemo<StudInstance[]>(() => {
    const studs: StudInstance[] = [];

    for (const district of manifest.districts) {
      const color = theme === "neon" ? neonize(district.color) : tint(district.color, 0.5);
      for (const local of baseplateStudPositions(district.dimensions.width, district.dimensions.depth)) {
        studs.push({ x: district.position.x + local.x, y: 0.3, z: district.position.z + local.z, r: STUD_RADIUS * 1.05, color });
      }
    }

    for (const building of manifest.buildings) {
      const color = theme === "neon" ? neonize(colorByLanguage ? building.color : "#94a3b8") : colorByLanguage ? building.color : "#94a3b8";
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
        color: theme === "neon" ? neonize(landmark.color) : landmark.color
      });
    }

    return studs;
  }, [colorByLanguage, manifest, theme]);

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
      <meshStandardMaterial roughness={theme === "neon" ? 0.22 : 0.34} metalness={0} envMapIntensity={theme === "neon" ? 1.1 : 0.7} emissive={theme === "neon" ? "#67e8f9" : "#000000"} emissiveIntensity={theme === "neon" ? 0.22 : 0} />
    </instancedMesh>
  );
}

function SceneEnvironment({ theme }: { theme: SceneTheme }) {
  const neon = theme === "neon";
  // Procedural studio lighting baked into an env map for plastic-brick reflections.
  // Built entirely from Lightformers so it needs no external HDRI / network fetch.
  return (
    <Environment resolution={256}>
      <color attach="background" args={[neon ? "#020617" : "#0b1220"]} />
      <Lightformer form="rect" intensity={neon ? 2.8 : 2.4} color={neon ? "#22d3ee" : "#ffffff"} position={[0, 14, 8]} scale={[20, 9, 1]} rotation={[-Math.PI / 2.3, 0, 0]} />
      <Lightformer form="rect" intensity={neon ? 1.8 : 1.2} color={neon ? "#f472b6" : "#d7e6ff"} position={[-14, 7, -10]} scale={[11, 11, 1]} rotation={[0, Math.PI / 3, 0]} />
      <Lightformer form="rect" intensity={neon ? 1.6 : 1.05} color={neon ? "#a78bfa" : "#fff1d6"} position={[14, 6, 9]} scale={[11, 9, 1]} rotation={[0, -Math.PI / 3, 0]} />
      <Lightformer form="ring" intensity={neon ? 2.2 : 1.5} color={neon ? "#67e8f9" : "#ffffff"} position={[7, 11, -7]} scale={6} />
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

function EmptyScene({ isLoading, theme }: { isLoading: boolean; theme: SceneTheme }) {
  const neon = theme === "neon";
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
        <meshStandardMaterial color={neon ? "#0f172a" : "#ffffff"} emissive={neon ? "#164e63" : "#000000"} emissiveIntensity={neon ? 0.35 : 0} />
      </mesh>
      {blocks.map((block) => (
        <group key={block.x} position={[block.x, block.h / 2 + 0.2, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, block.h, 1.2]} />
            <meshStandardMaterial color={neon ? neonize(block.c) : block.c} roughness={neon ? 0.28 : 0.62} emissive={neon ? neonize(block.c) : "#000000"} emissiveIntensity={neon ? 0.34 : 0} />
          </mesh>
          <Stud position={{ x: 0, y: block.h / 2 + 0.12, z: 0 }} color={block.c} />
        </group>
      ))}
    </group>
  );
}

function DistrictBase({ district, theme }: { district: District; theme: SceneTheme }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const selected = selection?.kind === "district" && selection.id === district.id;
  const neon = theme === "neon";
  const plateColor = neon ? shade(district.color, -0.42) : tint(district.color, 0.5);
  const topColor = neon ? shade(district.color, -0.25) : tint(district.color, 0.6);

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
        <meshStandardMaterial color={plateColor} roughness={neon ? 0.36 : 0.5} metalness={0} envMapIntensity={neon ? 0.9 : 0.4} emissive={neon ? neonize(district.color) : "#ffffff"} emissiveIntensity={neon ? (selected ? 0.44 : 0.16) : selected ? 0.16 : 0} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[district.dimensions.width * 0.96, 0.05, district.dimensions.depth * 0.96]} />
        <meshStandardMaterial color={topColor} roughness={neon ? 0.32 : 0.48} metalness={0} envMapIntensity={neon ? 1 : 0.4} emissive={neon ? neonize(district.color) : "#ffffff"} emissiveIntensity={neon ? (selected ? 0.56 : 0.2) : selected ? 0.16 : 0} />
      </mesh>
      <SceneLabel position={{ x: 0, y: 0.58, z: -district.dimensions.depth / 2 + 0.72 }} tone="sector">
        {districtLabel(district.name)}
      </SceneLabel>
    </group>
  );
}

function RoadMesh({ road, theme }: { road: Road; theme: SceneTheme }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "road" && selection.id === road.id;
  const midpoint = roadMidpoint(road);
  const isConnector = road.kind === "connector";
  const neon = theme === "neon";
  const roadY = isConnector ? 0.05 : 0.03;
  const roadHeight = 0.05;
  const roadWidth = road.width * 0.72;
  const surfaceColor = neon ? (selected ? "#1e3a8a" : isConnector ? "#10233f" : "#101827") : selected ? "#9aa7bb" : isConnector ? "#7e8ca1" : "#6f7c8e";
  const stripeColor = neon ? (isConnector ? "#22d3ee" : "#a78bfa") : selected ? "#0f172a" : "#cdd6e4";
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
              <meshStandardMaterial color={surfaceColor} roughness={neon ? 0.42 : 0.85} metalness={0} envMapIntensity={neon ? 0.9 : 0.2} emissive={neon ? "#0f172a" : "#000000"} emissiveIntensity={neon ? 0.42 : 0} />
            </mesh>
            <mesh position={[0, roadHeight / 2 + 0.012, 0]} renderOrder={isConnector ? 3 : 2}>
              <boxGeometry args={[0.06, 0.02, Math.max(0.3, length * 0.82)]} />
              <meshStandardMaterial color={stripeColor} roughness={neon ? 0.18 : 0.5} emissive={neon ? stripeColor : "#ffffff"} emissiveIntensity={neon ? 0.9 : selected ? 0 : 0.05} />
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

function BuildingMesh({ building, theme }: { building: Building; theme: SceneTheme }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const colorByLanguage = useWorldStore((state) => state.colorByLanguage);
  const highlightComplexity = useWorldStore((state) => state.highlightComplexity);
  const historyFocusPaths = useWorldStore((state) => state.historyFocusPaths);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "building" && selection.id === building.id;
  const historyFocused = historyFocusPaths.includes(building.path);
  const neon = theme === "neon";
  const rawColor = colorByLanguage ? building.color : "#94a3b8";
  const color = neon ? neonize(rawColor) : rawColor;
  const glow = neon
    ? selected
      ? 0.78
      : historyFocused
        ? 0.68
        : hovered
          ? 0.46
          : 0.18
    : selected
      ? 0.26
      : historyFocused
        ? 0.22
        : hovered
          ? 0.13
          : 0;
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
        <meshStandardMaterial color={neon ? "#0f172a" : tint(color, 0.32)} roughness={neon ? 0.32 : 0.46} metalness={0} envMapIntensity={neon ? 1 : 0.5} emissive={neon ? color : "#000000"} emissiveIntensity={neon ? 0.26 : 0} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[building.dimensions.width, building.dimensions.height, building.dimensions.depth]} />
        <meshStandardMaterial color={neon ? shade(color, -0.28) : color} roughness={neon ? 0.24 : 0.4} metalness={0} envMapIntensity={neon ? 1.25 : 0.6} emissive={neon ? color : "#ffffff"} emissiveIntensity={glow} />
      </mesh>
      {windowRows.map((y) => (
        <mesh key={y} position={[0, y, building.dimensions.depth / 2 + 0.018]}>
          <boxGeometry args={[building.dimensions.width * 0.62, 0.08, 0.035]} />
          <meshStandardMaterial color={neon ? "#e0f2fe" : tint(color, 0.62)} roughness={0.18} metalness={0.1} envMapIntensity={1.1} emissive={neon ? "#22d3ee" : "#bcd4ff"} emissiveIntensity={neon ? (selected || hovered ? 1.1 : 0.62) : selected || hovered ? 0.4 : 0.16} />
        </mesh>
      ))}
      {building.imports > 2 ? (
        <group position={[0, building.dimensions.height / 2 + 0.28, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.36, 10]} />
            <meshStandardMaterial color={neon ? "#e0f2fe" : "#f8fafc"} roughness={0.38} emissive={neon ? "#22d3ee" : "#000000"} emissiveIntensity={neon ? 0.35 : 0} />
          </mesh>
          <mesh castShadow position={[0, 0.23, 0]}>
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshStandardMaterial color={neon ? neonize(accent) : accent} roughness={0.4} emissive={neon ? neonize(accent) : "#000000"} emissiveIntensity={neon ? 0.8 : 0} />
          </mesh>
        </group>
      ) : null}
      <BuildingRoof building={building} profile={profile} selected={selected} hovered={hovered} theme={theme} />
      {building.symbols >= 10 ? <SymbolStack building={building} color={accent} theme={theme} /> : null}
      {building.todos > 0 ? <TodoScaffold building={building} todos={building.todos} theme={theme} /> : null}
      {highlightComplexity ? (
        <mesh position={[0, building.dimensions.height / 2 + 0.025, 0]}>
          <boxGeometry args={[building.dimensions.width * 0.92, 0.06, building.dimensions.depth * 0.92]} />
          <meshStandardMaterial color={neon ? neonize(accent) : accent} roughness={neon ? 0.22 : 0.48} emissive={neon ? neonize(accent) : "#000000"} emissiveIntensity={neon ? 0.9 : 0} />
        </mesh>
      ) : null}
      {historyFocused ? (
        <mesh position={[0, building.dimensions.height / 2 + 0.12, 0]}>
          <boxGeometry args={[building.dimensions.width * 1.08, 0.08, building.dimensions.depth * 1.08]} />
          <meshStandardMaterial color={neon ? "#facc15" : "#f59e0b"} roughness={neon ? 0.18 : 0.36} emissive={neon ? "#facc15" : "#fff7cc"} emissiveIntensity={neon ? 1.05 : 0.32} transparent opacity={0.82} />
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
  hovered,
  theme
}: {
  building: Building;
  profile: BuildingProfile;
  selected: boolean;
  hovered: boolean;
  theme: SceneTheme;
}) {
  const neon = theme === "neon";
  const top = building.dimensions.height / 2;
  const roofBase = neon ? neonize(profile.roofColor) : profile.roofColor;
  const roofColor = selected || hovered ? tint(roofBase, 0.14) : roofBase;
  const shine = neon ? (selected ? 0.95 : hovered ? 0.7 : 0.38) : selected ? 0.22 : hovered ? 0.12 : 0.04;

  if (profile.role === "entry") {
    return (
      <mesh castShadow position={[0, top + 0.18, 0]} scale={[1, 0.46, 1]}>
        <sphereGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.44, 22, 12]} />
        <meshStandardMaterial color={neon ? shade(roofColor, -0.16) : roofColor} roughness={neon ? 0.2 : 0.28} metalness={0} envMapIntensity={neon ? 1.25 : 0.9} emissive={neon ? roofColor : "#fff7cc"} emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "config") {
    return (
      <mesh castShadow position={[0, top + 0.22, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.62, 0.44, 4]} />
        <meshStandardMaterial color={neon ? shade(roofColor, -0.18) : roofColor} roughness={neon ? 0.22 : 0.32} metalness={0} envMapIntensity={neon ? 1.2 : 0.8} emissive={neon ? roofColor : "#ffffff"} emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "test") {
    return (
      <group position={[0, top + 0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[building.dimensions.width * 0.92, 0.14, building.dimensions.depth * 0.3]} />
          <meshStandardMaterial color={neon ? shade(roofColor, -0.12) : roofColor} roughness={neon ? 0.2 : 0.34} metalness={0} envMapIntensity={neon ? 1.2 : 0.75} emissive={neon ? roofColor : "#dcfce7"} emissiveIntensity={shine} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[building.dimensions.width * 0.3, 0.16, building.dimensions.depth * 0.92]} />
          <meshStandardMaterial color={neon ? "#cffafe" : "#f8fafc"} roughness={0.3} metalness={0} envMapIntensity={0.75} emissive={neon ? "#22d3ee" : "#000000"} emissiveIntensity={neon ? 0.5 : 0} />
        </mesh>
      </group>
    );
  }

  if (profile.role === "data") {
    return (
      <mesh castShadow position={[0, top + 0.1, 0]}>
        <cylinderGeometry args={[building.dimensions.width * 0.42, building.dimensions.width * 0.42, 0.18, 18]} />
        <meshStandardMaterial color={neon ? shade(roofColor, -0.12) : roofColor} roughness={neon ? 0.18 : 0.3} metalness={0} envMapIntensity={neon ? 1.3 : 0.85} emissive={neon ? roofColor : "#ffffff"} emissiveIntensity={shine} />
      </mesh>
    );
  }

  if (profile.role === "style") {
    return (
      <mesh castShadow position={[0, top + 0.2, 0]}>
        <coneGeometry args={[Math.min(building.dimensions.width, building.dimensions.depth) * 0.54, 0.4, 3]} />
        <meshStandardMaterial color={neon ? shade(roofColor, -0.16) : roofColor} roughness={neon ? 0.18 : 0.26} metalness={0} envMapIntensity={neon ? 1.35 : 0.95} emissive={neon ? roofColor : "#e0f2fe"} emissiveIntensity={shine} />
      </mesh>
    );
  }

  return (
    <mesh castShadow position={[0, top + 0.08, 0]}>
      <boxGeometry args={[building.dimensions.width * 0.78, 0.14, building.dimensions.depth * 0.78]} />
      <meshStandardMaterial color={neon ? shade(roofColor, -0.16) : roofColor} roughness={neon ? 0.2 : 0.32} metalness={0} envMapIntensity={neon ? 1.2 : 0.75} emissive={neon ? roofColor : "#ffffff"} emissiveIntensity={shine} />
    </mesh>
  );
}

function SymbolStack({ building, color, theme }: { building: Building; color: string; theme: SceneTheme }) {
  const top = building.dimensions.height / 2;
  const plates = Math.min(4, Math.max(2, Math.ceil(building.symbols / 18)));
  const neon = theme === "neon";

  return (
    <group position={[-building.dimensions.width * 0.3, top + 0.12, -building.dimensions.depth * 0.3]}>
      {Array.from({ length: plates }, (_, index) => (
        <mesh key={index} castShadow position={[0, index * 0.09, 0]}>
          <boxGeometry args={[building.dimensions.width * 0.34, 0.055, building.dimensions.depth * 0.34]} />
          <meshStandardMaterial color={index % 2 === 0 ? (neon ? neonize(color) : color) : neon ? "#cffafe" : "#f8fafc"} roughness={neon ? 0.18 : 0.3} metalness={0} envMapIntensity={neon ? 1.1 : 0.85} emissive={neon ? (index % 2 === 0 ? neonize(color) : "#22d3ee") : "#000000"} emissiveIntensity={neon ? 0.45 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function TodoScaffold({ building, todos, theme }: { building: Building; todos: number; theme: SceneTheme }) {
  const width = building.dimensions.width + 0.42;
  const depth = building.dimensions.depth + 0.42;
  const height = building.dimensions.height + 0.58;
  const top = building.dimensions.height / 2 + 0.32;
  const neon = theme === "neon";
  const glow = clamp(todos * 0.05, neon ? 0.46 : 0.12, neon ? 1.05 : 0.36);
  const materialProps = { color: neon ? "#facc15" : "#f59e0b", roughness: neon ? 0.18 : 0.34, metalness: 0.05, envMapIntensity: neon ? 1.1 : 0.75, emissive: neon ? "#f59e0b" : "#f59e0b", emissiveIntensity: glow };

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

function DecorativeLayer({ manifest, theme }: { manifest: WorldManifest; theme: SceneTheme }) {
  const plan = useMemo(() => decorativePlan(manifest), [manifest]);

  return (
    <group>
      {plan.towers.map((tower) => (
        <PropTower key={tower.id} tower={tower} theme={theme} />
      ))}
      {plan.cranes.map((crane) => (
        <ConstructionCrane key={crane.id} crane={crane} theme={theme} />
      ))}
    </group>
  );
}

function PropTower({ tower, theme }: { tower: DecorativeTower; theme: SceneTheme }) {
  const neon = theme === "neon";
  const color = neon ? neonize(tower.color) : tower.color;
  const accent = neon ? neonize(tower.accent) : tower.accent;
  const top = tower.height / 2;
  const tiers = tower.variant === "spire" ? 3 : tower.variant === "stack" ? 2 : 1;

  return (
    <group position={[tower.position.x, 0.22 + tower.height / 2, tower.position.z]} rotation={[0, tower.rotation, 0]}>
      <mesh receiveShadow position={[0, -top - 0.045, 0]}>
        <boxGeometry args={[tower.width * 1.24, 0.09, tower.depth * 1.24]} />
        <meshStandardMaterial color={neon ? "#0f172a" : tint(color, 0.45)} roughness={neon ? 0.26 : 0.48} envMapIntensity={neon ? 1 : 0.45} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.2 : 0} />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[tower.width, tower.height, tower.depth]} />
        <meshStandardMaterial color={neon ? shade(color, -0.3) : color} roughness={neon ? 0.22 : 0.44} envMapIntensity={neon ? 1.2 : 0.55} emissive={neon ? color : "#ffffff"} emissiveIntensity={neon ? 0.44 : 0.04} />
      </mesh>
      {Array.from({ length: tiers }, (_, index) => (
        <mesh key={index} castShadow position={[0, top + 0.08 + index * 0.1, 0]}>
          <boxGeometry args={[tower.width * (0.72 - index * 0.13), 0.09, tower.depth * (0.72 - index * 0.13)]} />
          <meshStandardMaterial color={index % 2 === 0 ? accent : "#f8fafc"} roughness={neon ? 0.18 : 0.32} envMapIntensity={neon ? 1.2 : 0.7} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.6 : 0} />
        </mesh>
      ))}
      {tower.variant === "spire" ? (
        <mesh castShadow position={[0, top + 0.42, 0]}>
          <coneGeometry args={[Math.min(tower.width, tower.depth) * 0.38, 0.62, 4]} />
          <meshStandardMaterial color={accent} roughness={neon ? 0.18 : 0.3} envMapIntensity={neon ? 1.3 : 0.7} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.75 : 0} />
        </mesh>
      ) : null}
      {buildingStudPositions(tower.width, tower.depth).map((point) => (
        <mesh key={`${point.x}:${point.z}`} castShadow position={[point.x, top + STUD_HEIGHT / 2, point.z]}>
          <cylinderGeometry args={[STUD_RADIUS * 0.9, STUD_RADIUS * 0.9, STUD_HEIGHT, 18]} />
          <meshStandardMaterial color={accent} roughness={neon ? 0.18 : 0.34} envMapIntensity={neon ? 1.1 : 0.7} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.46 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function ConstructionCrane({ crane, theme }: { crane: DecorativeCrane; theme: SceneTheme }) {
  const armRef = useRef<THREE.Group>(null);
  const hookRef = useRef<THREE.Group>(null);
  const neon = theme === "neon";
  const color = neon ? neonize(crane.color) : crane.color;
  const accent = neon ? neonize(crane.accent) : crane.accent;

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (armRef.current) {
      armRef.current.rotation.y = crane.rotation + Math.sin(elapsed * 0.28 + crane.position.x * 0.03) * 0.28;
    }
    if (hookRef.current) {
      hookRef.current.position.x = Math.sin(elapsed * 0.42 + crane.position.z * 0.02) * 0.9 + 1.9;
      hookRef.current.position.y = -0.24 + Math.sin(elapsed * 0.7) * 0.12;
    }
  });

  return (
    <group position={[crane.position.x, 0.24, crane.position.z]}>
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[1.3, 0.12, 1.3]} />
        <meshStandardMaterial color={neon ? "#0f172a" : "#e2e8f0"} roughness={0.38} emissive={neon ? "#164e63" : "#000000"} emissiveIntensity={neon ? 0.28 : 0} />
      </mesh>
      <mesh castShadow position={[0, crane.height / 2, 0]}>
        <boxGeometry args={[0.22, crane.height, 0.22]} />
        <meshStandardMaterial color={color} roughness={neon ? 0.2 : 0.38} envMapIntensity={neon ? 1.2 : 0.6} emissive={neon ? color : "#000000"} emissiveIntensity={neon ? 0.44 : 0} />
      </mesh>
      <mesh castShadow position={[0, crane.height + 0.08, 0]}>
        <boxGeometry args={[0.52, 0.2, 0.52]} />
        <meshStandardMaterial color={accent} roughness={neon ? 0.18 : 0.34} envMapIntensity={neon ? 1.2 : 0.7} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.64 : 0} />
      </mesh>
      <group ref={armRef} position={[0, crane.height + 0.22, 0]} rotation={[0, crane.rotation, 0]}>
        <mesh castShadow position={[1.65, 0, 0]}>
          <boxGeometry args={[3.5, 0.12, 0.12]} />
          <meshStandardMaterial color={accent} roughness={neon ? 0.18 : 0.34} envMapIntensity={neon ? 1.2 : 0.65} emissive={neon ? accent : "#000000"} emissiveIntensity={neon ? 0.7 : 0} />
        </mesh>
        <mesh castShadow position={[-0.72, 0, 0]}>
          <boxGeometry args={[0.9, 0.18, 0.2]} />
          <meshStandardMaterial color={color} roughness={neon ? 0.2 : 0.38} envMapIntensity={neon ? 1.1 : 0.55} emissive={neon ? color : "#000000"} emissiveIntensity={neon ? 0.42 : 0} />
        </mesh>
        <group ref={hookRef} position={[1.9, -0.24, 0]}>
          <mesh position={[0, -0.34, 0]}>
            <boxGeometry args={[0.035, 0.68, 0.035]} />
            <meshStandardMaterial color={neon ? "#e0f2fe" : "#475569"} emissive={neon ? "#22d3ee" : "#000000"} emissiveIntensity={neon ? 0.55 : 0} />
          </mesh>
          <mesh castShadow position={[0, -0.77, 0]}>
            <boxGeometry args={[0.34, 0.18, 0.24]} />
            <meshStandardMaterial color={color} roughness={neon ? 0.2 : 0.42} emissive={neon ? color : "#000000"} emissiveIntensity={neon ? 0.55 : 0} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function LandmarkMesh({ landmark, theme }: { landmark: Landmark; theme: SceneTheme }) {
  const setSelection = useWorldStore((state) => state.setSelection);
  const selection = useWorldStore((state) => state.selection);
  const [hovered, setHovered] = useState(false);
  const selected = selection?.kind === "landmark" && selection.id === landmark.id;
  const neon = theme === "neon";
  const color = neon ? neonize(landmark.color) : landmark.color;
  const glow = neon ? (selected ? 0.92 : hovered ? 0.58 : 0.18) : selected ? 0.26 : hovered ? 0.13 : 0;

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
        <meshStandardMaterial color={neon ? "#0f172a" : tint(landmark.color, 0.5)} roughness={neon ? 0.28 : 0.46} metalness={0} envMapIntensity={neon ? 1 : 0.5} emissive={neon ? color : "#ffffff"} emissiveIntensity={neon ? glow * 0.8 : glow * 0.6} />
      </mesh>
      {landmark.kind === "automation_panel" ? (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[landmark.dimensions.width / 2, landmark.dimensions.width / 2, landmark.dimensions.height, 24]} />
          <meshStandardMaterial color={neon ? shade(color, -0.18) : color} roughness={neon ? 0.22 : 0.4} metalness={0} envMapIntensity={neon ? 1.2 : 0.6} emissive={neon ? color : "#ffffff"} emissiveIntensity={glow} />
        </mesh>
      ) : landmark.kind === "instruction_center" ? (
        <>
          <mesh castShadow receiveShadow position={[0, -0.1, 0]}>
            <boxGeometry args={[landmark.dimensions.width, landmark.dimensions.height * 0.72, landmark.dimensions.depth]} />
            <meshStandardMaterial color={neon ? shade(color, -0.18) : color} roughness={neon ? 0.22 : 0.4} metalness={0} envMapIntensity={neon ? 1.2 : 0.6} emissive={neon ? color : "#ffffff"} emissiveIntensity={glow} />
          </mesh>
          <mesh castShadow position={[0, landmark.dimensions.height * 0.35, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[landmark.dimensions.width * 0.62, landmark.dimensions.height * 0.6, 4]} />
            <meshStandardMaterial color={neon ? "#ecfeff" : "#f4f7fb"} roughness={neon ? 0.24 : 0.42} metalness={0} envMapIntensity={neon ? 1 : 0.6} emissive={neon ? "#22d3ee" : "#000000"} emissiveIntensity={neon ? 0.36 : 0} />
          </mesh>
        </>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[landmark.dimensions.width, landmark.dimensions.height, landmark.dimensions.depth]} />
          <meshStandardMaterial color={neon ? shade(color, -0.18) : color} roughness={neon ? 0.22 : 0.4} metalness={0} envMapIntensity={neon ? 1.2 : 0.6} emissive={neon ? color : "#ffffff"} emissiveIntensity={glow} />
        </mesh>
      )}
      {selected || hovered ? <SceneLabel position={{ x: 0, y: landmark.dimensions.height / 2 + 0.58, z: 0 }}>{landmark.name}</SceneLabel> : null}
    </group>
  );
}

function ConnectionLayer({ manifest, theme }: { manifest: WorldManifest; theme: SceneTheme }) {
  const flowRef = useRef<THREE.InstancedMesh>(null);
  const pulseObject = useMemo(() => new THREE.Object3D(), []);
  const neon = theme === "neon";
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
      const scale = (neon ? 0.11 : 0.08) + Math.sin((t + index * 0.17) * Math.PI) * (neon ? 0.055 : 0.035);
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
        <lineBasicMaterial color={neon ? "#22d3ee" : "#2563eb"} transparent opacity={neon ? 0.76 : 0.52} depthWrite={false} />
      </lineSegments>
      {flowPaths.length > 0 ? (
        <instancedMesh ref={flowRef} args={[undefined, undefined, flowPaths.length]} renderOrder={2}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={neon ? "#67e8f9" : "#38bdf8"} emissive={neon ? "#22d3ee" : "#2563eb"} emissiveIntensity={neon ? 2.2 : 1.25} roughness={0.2} transparent opacity={neon ? 0.94 : 0.86} depthWrite={false} />
        </instancedMesh>
      ) : null}
    </>
  );
}

function SceneLabel({ children, position, tone = "default" }: { children: string; position: Vec3; tone?: "default" | "road" | "sector" }) {
  const sceneTheme = useWorldStore((state) => state.sceneTheme);
  const className =
    sceneTheme === "neon" && tone === "sector"
      ? "origin-center max-w-24 rounded border border-cyan-300/70 bg-slate-950/88 px-1.5 py-0.5 text-center text-[8px] font-semibold leading-tight text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.35)] sm:text-[10px]"
      : sceneTheme === "neon" && tone === "road"
        ? "origin-center rounded border border-fuchsia-300/70 bg-slate-950/88 px-2 py-0.5 text-center text-[8px] font-medium leading-tight text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,0.35)] sm:text-[10px]"
        : sceneTheme === "neon"
          ? "origin-center rounded border border-cyan-200/70 bg-slate-950/90 px-2 py-1 text-center text-[9px] font-medium leading-tight text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.35)] sm:text-[10px]"
          : tone === "sector"
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

function decorativePlan(manifest: WorldManifest): { towers: DecorativeTower[]; cranes: DecorativeCrane[] } {
  const bounds = manifestBounds(manifest);
  const seed = hashString(`${manifest.repo.fullName}:${manifest.stats.files}:${manifest.stats.districts}`);
  const colors = ["#38bdf8", "#f472b6", "#facc15", "#34d399", "#a78bfa", "#fb7185"];
  const variants: DecorativeTower["variant"][] = ["stack", "kiosk", "spire"];
  const count = clampInt(Math.ceil(manifest.districts.length * 0.9) + 2, 4, 10);
  const towers: DecorativeTower[] = [];

  for (let index = 0; index < count; index += 1) {
    const angle = ((index / count) * Math.PI * 2 + ((seed % 37) / 37) * Math.PI * 0.4) % (Math.PI * 2);
    const distance = bounds.radius + 4.5 + (index % 3) * 1.25;
    const height = roundTo(0.85 + ((seed >> (index % 13)) & 3) * 0.34 + (index % 2) * 0.28, 2);
    const width = roundTo(0.9 + (index % 3) * 0.16, 2);
    const depth = roundTo(0.82 + ((index + 1) % 3) * 0.18, 2);
    const color = colors[(seed + index) % colors.length];
    const accent = colors[(seed + index + 2) % colors.length];

    towers.push({
      id: `prop:tower:${index}`,
      position: {
        x: roundTo(bounds.center.x + Math.cos(angle) * distance, 2),
        y: 0,
        z: roundTo(bounds.center.z + Math.sin(angle) * distance, 2)
      },
      width,
      depth,
      height,
      color,
      accent,
      rotation: roundTo(angle + Math.PI / 4, 3),
      variant: variants[(seed + index) % variants.length]
    });
  }

  const craneDistance = bounds.radius + 3.8;
  const craneAngles = [Math.PI * 0.18 + (seed % 7) * 0.04, Math.PI * 1.18 + (seed % 5) * 0.05];
  const cranes = craneAngles.map((angle, index) => ({
    id: `prop:crane:${index}`,
    position: {
      x: roundTo(bounds.center.x + Math.cos(angle) * craneDistance, 2),
      y: 0,
      z: roundTo(bounds.center.z + Math.sin(angle) * craneDistance, 2)
    },
    rotation: roundTo(angle + Math.PI, 3),
    height: roundTo(clamp(bounds.radius * 0.1 + 2.1 + index * 0.35, 2.1, 4.4), 2),
    color: index % 2 === 0 ? "#facc15" : "#fb7185",
    accent: index % 2 === 0 ? "#22d3ee" : "#a78bfa"
  }));

  return { towers, cranes };
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

function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    if (amount >= 0) {
      return Math.min(255, Math.round(channel + (255 - channel) * amount));
    }
    return Math.max(0, Math.round(channel * (1 + amount)));
  });
  return `#${channels.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function neonize(hex: string): string {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(hsl.h, clamp(hsl.s * 1.35 + 0.12, 0.55, 1), clamp(hsl.l * 1.18 + 0.12, 0.5, 0.78));
  return `#${color.getHexString()}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
