import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import * as THREE from 'three';
import type { ParametricAssemblyGeometry } from '../../physics/assemblyGeometry';

export type CameraPreset =
  | 'full'
  | 'forced'
  | 'cooling'
  | 'natural'
  | 'thermal'
  | 'electrical'
  | 'teg'
  | 'insulation'
  | 'fin'
  | 'fit'
  | 'front'
  | 'side'
  | 'top'
  | 'exploded';

interface CameraControllerProps {
  target: [number, number, number];
  geom: ParametricAssemblyGeometry;
  autoRotate?: boolean;
  preset?: CameraPreset | null;
  onPresetHandled?: () => void;
}

/**
 * Aspect-Aware Parametric CameraController:
 * - Calculates exact bounding framing from canvas aspect ratio + live ParametricAssemblyGeometry
 * - Positions default Full Assembly at a front-left 3/4 angle (-34°) so the Open Fan Tunnel,
 *   7 Fan Blades, Plenum Gap, Fin Channels, TEG Stack, and Electrical Display are ALL cleanly visible
 *   with zero clipping on both narrow panes (~560px) and wide monitors
 */
export function CameraController({
  target,
  geom,
  autoRotate = false,
  preset = null,
  onPresetHandled,
}: CameraControllerProps) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsType>(null);
  const initializedRef = useRef(false);

  const desiredPos = useRef<THREE.Vector3 | null>(null);
  const desiredTarget = useRef<THREE.Vector3>(new THREE.Vector3(...target));

  // Calculate aspect-aware framing distance for a world span
  const fitDistance = (spanX: number, spanY: number, spanZ: number, azimuthRad: number) => {
    const aspect = size.width / Math.max(1, size.height);
    const fovDeg = (camera as THREE.PerspectiveCamera).fov ?? 32;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    const projHoriz = Math.abs(spanX * Math.cos(azimuthRad)) + Math.abs(spanZ * Math.sin(azimuthRad));
    const distH = (projHoriz * 0.5) / (tanHalf * Math.max(0.5, aspect));
    const distV = (spanY * 0.5) / tanHalf;
    return Math.max(distH, distV, 0.16) * 1.18;
  };

  // Initial exact camera framing once canvas size is known
  useEffect(() => {
    if (initializedRef.current || size.width <= 0 || size.height <= 0) return;
    initializedRef.current = true;

    const xLeft = geom.fanX - geom.fanDepth * 0.5 - 0.008;
    const xRight = geom.displayX + 0.036;
    const cx = (xLeft + xRight) * 0.5;
    const cy = Math.max(geom.totalStackHeight, geom.fanY + geom.fanSize * 0.5) * 0.48;
    const spanX = xRight - xLeft;
    const spanY = Math.max(geom.totalStackHeight, geom.fanY + geom.fanSize * 0.5) + 0.025;
    const dist = fitDistance(spanX, spanY, geom.mountWidthZ + 0.04, THREE.MathUtils.degToRad(34));

    camera.position.set(cx - dist * 0.54, cy + dist * 0.25, dist * 0.83);
    desiredTarget.current.set(cx, cy, 0.006);
    if (controlsRef.current) {
      controlsRef.current.target.copy(desiredTarget.current);
      controlsRef.current.update();
    }
  }, [size.width, size.height, geom, camera]);

  // Handle Preset Camera Modes dynamically from live parametric geometry
  useEffect(() => {
    if (!preset) return;

    const xLeft = geom.fanX - geom.fanDepth * 0.5 - 0.008;
    const xRight = geom.displayX + 0.036;
    const fullCx = (xLeft + xRight) * 0.5;
    const fullSpanX = xRight - xLeft;
    const fullSpanY = Math.max(geom.totalStackHeight, geom.fanY + geom.fanSize * 0.5) + 0.025;
    const cy = geom.apparatusCenterY;

    switch (preset) {
      case 'full':
      case 'fit': {
        const d = fitDistance(fullSpanX, fullSpanY, geom.mountWidthZ + 0.04, THREE.MathUtils.degToRad(34));
        desiredPos.current = new THREE.Vector3(fullCx - d * 0.54, cy + d * 0.25, d * 0.83);
        desiredTarget.current.set(fullCx, cy, 0.006);
        break;
      }

      case 'forced':
      case 'cooling':
      case 'side': {
        // Focus cleanly on Open Fan Rotor/Blades + Clearance Plenum + Fin Intake across all fin sizes
        const inletX = -geom.hsLengthX * 0.25;
        const coolLeft = geom.fanX - geom.fanDepth * 0.5 - 0.025;
        const coolCx = (coolLeft + inletX) * 0.5;
        const coolSpanX = Math.max(0.12, inletX - coolLeft + 0.045);
        const coolSpanY = Math.max(geom.fanSize, geom.H_fin + 0.03) + 0.03;
        const d = fitDistance(coolSpanX, coolSpanY, geom.fanSize + 0.04, THREE.MathUtils.degToRad(48)) * 1.12;
        desiredPos.current = new THREE.Vector3(coolCx - d * 0.72, geom.fanY + d * 0.28, d * 0.64);
        desiredTarget.current.set(coolCx, geom.fanY, 0);
        break;
      }

      case 'natural': {
        const d = fitDistance(geom.mountWidthX + 0.04, fullSpanY, geom.mountWidthZ + 0.04, THREE.MathUtils.degToRad(32));
        desiredPos.current = new THREE.Vector3(-d * 0.48, cy + d * 0.25, d * 0.84);
        desiredTarget.current.set(0, cy, 0);
        break;
      }

      case 'thermal': {
        const d = fitDistance(geom.mountWidthX + 0.04, fullSpanY, geom.mountWidthZ + 0.04, THREE.MathUtils.degToRad(32));
        desiredPos.current = new THREE.Vector3(-d * 0.42, cy + d * 0.36, d * 0.82);
        desiredTarget.current.set(0, cy, 0);
        break;
      }

      case 'electrical': {
        const spanElX = geom.displayX + 0.045;
        const elCx = geom.displayX * 0.55;
        const d = fitDistance(spanElX, 0.09, 0.09, THREE.MathUtils.degToRad(22));
        desiredPos.current = new THREE.Vector3(elCx - d * 0.16, geom.y_teg + d * 0.26, geom.displayZ + d * 0.90);
        desiredTarget.current.set(elCx, geom.y_teg * 0.85, geom.displayZ * 0.75);
        break;
      }

      case 'teg': {
        // Macro view right onto TEG crystal pellets, copper bridges, electrons e- & holes h+
        const tegSpan = Math.max(0.055, geom.tegW * 1.45);
        const d = fitDistance(tegSpan, geom.tegW * 0.65, tegSpan, THREE.MathUtils.degToRad(28)) * 0.92;
        desiredPos.current = new THREE.Vector3(d * 0.42, geom.y_teg + d * 0.12, d * 0.90);
        desiredTarget.current.set(geom.tegW * 0.08, geom.y_teg, geom.tegL * 0.08);
        break;
      }

      case 'exploded': {
        const d = fitDistance(fullSpanX, fullSpanY + 0.08, geom.mountWidthZ + 0.04, THREE.MathUtils.degToRad(32));
        desiredPos.current = new THREE.Vector3(fullCx - d * 0.45, cy + d * 0.45, d * 0.80);
        desiredTarget.current.set(fullCx * 0.6, cy + 0.025, 0);
        break;
      }

      case 'insulation': {
        const d = fitDistance(geom.hotSpreaderW * 2.2, 0.08, geom.hotSpreaderL * 2.2, THREE.MathUtils.degToRad(35));
        desiredPos.current = new THREE.Vector3(-d * 0.50, geom.y_heater + d * 0.38, d * 0.78);
        desiredTarget.current.set(0, (geom.y_hot + geom.y_heater) * 0.5, 0);
        break;
      }

      case 'fin':
      case 'front': {
        const d = fitDistance(geom.mountWidthX + 0.03, fullSpanY, geom.mountWidthZ + 0.03, THREE.MathUtils.degToRad(40));
        desiredPos.current = new THREE.Vector3(-d * 0.62, geom.y_fin_mid + d * 0.22, d * 0.74);
        desiredTarget.current.set(0, geom.y_fin_mid, 0);
        break;
      }

      case 'top': {
        const d = fitDistance(fullSpanX, fullSpanX, geom.mountWidthZ, 0);
        desiredPos.current = new THREE.Vector3(0, cy + d, 0.001);
        desiredTarget.current.set(0, cy, 0);
        break;
      }
    }

    if (onPresetHandled) onPresetHandled();
  }, [preset, geom, size.width, size.height, camera, onPresetHandled]);

  useFrame(() => {
    if (desiredPos.current && controlsRef.current) {
      camera.position.lerp(desiredPos.current, 0.12);
      controlsRef.current.target.lerp(desiredTarget.current, 0.14);
      controlsRef.current.update();

      if (camera.position.distanceTo(desiredPos.current) < 0.002) {
        camera.position.copy(desiredPos.current);
        controlsRef.current.target.copy(desiredTarget.current);
        controlsRef.current.update();
        desiredPos.current = null;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={0.9}
      minDistance={0.07}
      maxDistance={1.4}
      maxPolarAngle={Math.PI / 2 + 0.02}
      target={target}
    />
  );
}
