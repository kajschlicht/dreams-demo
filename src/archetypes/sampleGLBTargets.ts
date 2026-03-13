import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import { GLTFLoader, MeshSurfaceSampler } from "three-stdlib";

export type GLBPointSets = {
  surfacePositions: Float32Array;
  edgePositions: Float32Array;
  surfaceNormals: Float32Array;
};

const gltfLoader = new GLTFLoader();

export const STAGE_WIDTH = 14;
export const STAGE_HEIGHT = 8;
export const STAGE_CENTER = new THREE.Vector3(0, 0.8, 0);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function loadGLTF(url: string): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => resolve(gltf as GLTF), undefined, reject);
  });
}

function hash01(index: number, seed: number): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function mergeFloat3(chunks: Float32Array[], totalCount: number): Float32Array {
  const out = new Float32Array(totalCount * 3);
  let write = 0;
  for (const chunk of chunks) {
    out.set(chunk, write);
    write += chunk.length;
  }
  return out;
}

function distributeCounts(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) {
    const even = Math.floor(total / weights.length);
    const out = new Array(weights.length).fill(even);
    let rem = total - even * weights.length;
    let i = 0;
    while (rem > 0) {
      out[i % out.length]++;
      i++;
      rem--;
    }
    return out;
  }

  const raw = weights.map((w) => (w / weightSum) * total);
  const base = raw.map((v) => Math.floor(v));
  let remainder = total - base.reduce((acc, v) => acc + v, 0);
  const ranked = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  let cursor = 0;
  while (remainder > 0 && ranked.length > 0) {
    base[ranked[cursor % ranked.length].i]++;
    cursor++;
    remainder--;
  }
  return base;
}

function computeMeshArea(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return 0;
  const position = geometry.getAttribute("position");
  if (!position || position.count < 3) return 0;

  const matrix = mesh.matrixWorld;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  let area = 0;
  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i)).applyMatrix4(matrix);
      b.fromBufferAttribute(position, index.getX(i + 1)).applyMatrix4(matrix);
      c.fromBufferAttribute(position, index.getX(i + 2)).applyMatrix4(matrix);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      area += 0.5 * cross.length();
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i).applyMatrix4(matrix);
      b.fromBufferAttribute(position, i + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(position, i + 2).applyMatrix4(matrix);
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      area += 0.5 * cross.length();
    }
  }
  return area;
}

function computeEdgeLength(mesh: THREE.Mesh, thresholdAngle: number): number {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry)) return 0;
  const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const position = edges.getAttribute("position");
  if (!position || position.count < 2) {
    edges.dispose();
    return 0;
  }
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let length = 0;
  for (let i = 0; i < position.count; i += 2) {
    a.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, i + 1).applyMatrix4(mesh.matrixWorld);
    length += a.distanceTo(b);
  }
  edges.dispose();
  return length;
}

function applyStageTransform(
  positions: Float32Array,
  bbox: THREE.Box3
): void {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bbox.getCenter(center);
  bbox.getSize(size);

  const scale = Math.min(
    STAGE_WIDTH / Math.max(size.x, 1e-5),
    STAGE_HEIGHT / Math.max(size.y, 1e-5)
  );

  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 0] = (positions[i + 0] - center.x) * scale + STAGE_CENTER.x;
    positions[i + 1] = (positions[i + 1] - center.y) * scale + STAGE_CENTER.y;
    positions[i + 2] = (positions[i + 2] - center.z) * scale + STAGE_CENTER.z;
  }
}

function collectVisibleMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.visible) return;
    if (!(mesh.geometry instanceof THREE.BufferGeometry)) return;
    const pos = mesh.geometry.getAttribute("position");
    if (!pos || pos.count < 3) return;
    if (!mesh.geometry.getAttribute("normal")) {
      mesh.geometry.computeVertexNormals();
    }
    meshes.push(mesh);
  });
  return meshes;
}

export function createSurfaceSamples(
  mesh: THREE.Mesh,
  count: number
): { positions: Float32Array; normals: Float32Array } {
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const sampler = new MeshSurfaceSampler(mesh).build();

  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    sampler.sample(localPoint, localNormal);
    worldPoint.copy(localPoint);
    mesh.localToWorld(worldPoint);

    worldNormal.copy(localNormal).applyMatrix3(normalMatrix).normalize();

    positions[i3 + 0] = worldPoint.x;
    positions[i3 + 1] = worldPoint.y;
    positions[i3 + 2] = worldPoint.z;

    normals[i3 + 0] = worldNormal.x;
    normals[i3 + 1] = worldNormal.y;
    normals[i3 + 2] = worldNormal.z;
  }

  return { positions, normals };
}

export function createEdgeSamples(
  mesh: THREE.Mesh,
  count: number,
  thresholdAngle: number
): Float32Array {
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.BufferGeometry) || count <= 0) {
    return new Float32Array(0);
  }

  const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
  const edgePos = edges.getAttribute("position");
  if (!edgePos || edgePos.count < 2) {
    edges.dispose();
    return new Float32Array(0);
  }

  type Segment = {
    ax: number;
    ay: number;
    az: number;
    bx: number;
    by: number;
    bz: number;
    len: number;
  };
  const segments: Segment[] = [];
  const cumulative: number[] = [];
  let total = 0;

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < edgePos.count; i += 2) {
    a.fromBufferAttribute(edgePos, i).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(edgePos, i + 1).applyMatrix4(mesh.matrixWorld);
    const len = a.distanceTo(b);
    if (len < 1e-6) continue;
    segments.push({
      ax: a.x,
      ay: a.y,
      az: a.z,
      bx: b.x,
      by: b.y,
      bz: b.z,
      len,
    });
    total += len;
    cumulative.push(total);
  }
  edges.dispose();

  if (segments.length === 0 || total <= 0) {
    return new Float32Array(0);
  }

  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const pick = hash01(i, 1931) * total;
    let segIdx = 0;
    while (segIdx < cumulative.length - 1 && cumulative[segIdx] < pick) {
      segIdx++;
    }
    const seg = segments[segIdx];
    const t = hash01(i, 7799);
    out[i3 + 0] = THREE.MathUtils.lerp(seg.ax, seg.bx, t);
    out[i3 + 1] = THREE.MathUtils.lerp(seg.ay, seg.by, t);
    out[i3 + 2] = THREE.MathUtils.lerp(seg.az, seg.bz, t);
  }
  return out;
}

export async function loadGLBPointSets(
  url: string,
  surfaceCount: number,
  edgeCount: number,
  thresholdAngle = 22
): Promise<GLBPointSets> {
  const gltf = await loadGLTF(url);
  const meshes = collectVisibleMeshes(gltf.scene);
  if (meshes.length === 0) {
    throw new Error(`No visible meshes found in ${url}`);
  }

  const bbox = new THREE.Box3().setFromObject(gltf.scene);

  const areaWeights = meshes.map((mesh) => Math.max(1e-5, computeMeshArea(mesh)));
  const edgeWeights = meshes.map((mesh) =>
    Math.max(1e-5, computeEdgeLength(mesh, thresholdAngle))
  );

  const surfaceCounts = distributeCounts(surfaceCount, areaWeights);
  const edgeCounts = distributeCounts(edgeCount, edgeWeights);

  const surfaceChunks: Float32Array[] = [];
  const normalChunks: Float32Array[] = [];
  const edgeChunks: Float32Array[] = [];

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const sCount = surfaceCounts[i];
    const eCount = edgeCounts[i];

    if (sCount > 0) {
      const surface = createSurfaceSamples(mesh, sCount);
      surfaceChunks.push(surface.positions);
      normalChunks.push(surface.normals);
    }
    if (eCount > 0) {
      edgeChunks.push(createEdgeSamples(mesh, eCount, thresholdAngle));
    }
  }

  const surfacePositions = mergeFloat3(surfaceChunks, surfaceCount);
  const surfaceNormals = mergeFloat3(normalChunks, surfaceCount);
  const edgePositions = mergeFloat3(edgeChunks, edgeCount);

  applyStageTransform(surfacePositions, bbox);
  applyStageTransform(edgePositions, bbox);

  for (let i = 0; i < surfaceNormals.length; i += 3) {
    const nx = surfaceNormals[i + 0];
    const ny = surfaceNormals[i + 1];
    const nz = surfaceNormals[i + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-5) {
      surfaceNormals[i + 0] = nx / len;
      surfaceNormals[i + 1] = ny / len;
      surfaceNormals[i + 2] = nz / len;
    } else {
      surfaceNormals[i + 0] = 0;
      surfaceNormals[i + 1] = 1;
      surfaceNormals[i + 2] = 0;
    }
  }

  return { surfacePositions, edgePositions, surfaceNormals };
}

export function silhouetteProbability(
  normal: THREE.Vector3,
  viewDir: THREE.Vector3,
  threshold0 = 0.3,
  threshold1 = 0.95
): number {
  const silWeight = 1 - Math.abs(normal.dot(viewDir));
  const t = clamp01((silWeight - threshold0) / Math.max(1e-5, threshold1 - threshold0));
  return t * t * (3 - 2 * t);
}
