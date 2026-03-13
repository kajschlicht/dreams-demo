export type ObjectTransformParams = {
  size?: number;
  offsetX?: number;
  orientation?: number;
  orientationX?: number;
  orientationY?: number;
  orientationZ?: number;
  mode?: number;
};

export type ResolvedObjectTransform = {
  size: number;
  offsetX: number;
  orientationDegX: number;
  orientationDegY: number;
  orientationDegZ: number;
  orientationRadX: number;
  orientationRadY: number;
  orientationRadZ: number;
  mode: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampFinite(value: number | undefined, fallback: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? Number(value) : fallback;
  return clamp(safe, min, max);
}

export function resolveObjectTransform(
  params: ObjectTransformParams | undefined
): ResolvedObjectTransform {
  const size = clampFinite(params?.size, 1, 0.1, 1.5);
  const offsetX = clampFinite(params?.offsetX, 0, -6, 6);
  const orientationDegX = clampFinite(params?.orientationX, 0, -180, 180);
  const orientationDegY = clampFinite(
    params?.orientationY ?? params?.orientation,
    0,
    -180,
    180
  );
  const orientationDegZ = clampFinite(params?.orientationZ, 0, -180, 180);
  const mode = clampFinite(params?.mode, 0, 0, 1);

  return {
    size,
    offsetX,
    orientationDegX,
    orientationDegY,
    orientationDegZ,
    orientationRadX: (orientationDegX * Math.PI) / 180,
    orientationRadY: (orientationDegY * Math.PI) / 180,
    orientationRadZ: (orientationDegZ * Math.PI) / 180,
    mode,
  };
}

function rotateByEulerXYZ(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
): { x: number; y: number; z: number } {
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);

  // Rotate around X
  const x1 = x;
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;

  // Rotate around Y (legacy sign kept to preserve previous orientation behavior)
  const x2 = x1 * cosY - z1 * sinY;
  const y2 = y1;
  const z2 = x1 * sinY + z1 * cosY;

  // Rotate around Z
  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;
  const z3 = z2;

  return { x: x3, y: y3, z: z3 };
}

export function applyObjectTransform(
  basePositions: Float32Array,
  objectParams: ObjectTransformParams | ResolvedObjectTransform,
  out?: Float32Array
): Float32Array {
  const resolved =
    "orientationRadX" in objectParams
      ? objectParams
      : resolveObjectTransform(objectParams);
  const result = out && out.length === basePositions.length ? out : new Float32Array(basePositions.length);
  const scale = resolved.size;

  for (let i = 0; i < basePositions.length; i += 3) {
    const sx = basePositions[i + 0] * scale;
    const sy = basePositions[i + 1] * scale;
    const sz = basePositions[i + 2] * scale;

    const rotated = rotateByEulerXYZ(
      sx,
      sy,
      sz,
      resolved.orientationRadX,
      resolved.orientationRadY,
      resolved.orientationRadZ
    );

    result[i + 0] = rotated.x + resolved.offsetX;
    result[i + 1] = rotated.y;
    result[i + 2] = rotated.z;
  }

  return result;
}

export function applyOrientationToNormalsY(
  baseNormals: Float32Array,
  objectParams: ObjectTransformParams | ResolvedObjectTransform,
  out?: Float32Array
): Float32Array {
  const resolved =
    "orientationRadX" in objectParams
      ? objectParams
      : resolveObjectTransform(objectParams);
  const result = out && out.length === baseNormals.length ? out : new Float32Array(baseNormals.length);

  for (let i = 0; i < baseNormals.length; i += 3) {
    const nx = baseNormals[i + 0];
    const ny = baseNormals[i + 1];
    const nz = baseNormals[i + 2];
    const rotated = rotateByEulerXYZ(
      nx,
      ny,
      nz,
      resolved.orientationRadX,
      resolved.orientationRadY,
      resolved.orientationRadZ
    );
    result[i + 0] = rotated.x;
    result[i + 1] = rotated.y;
    result[i + 2] = rotated.z;
  }

  return result;
}
