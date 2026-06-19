import type {
  AnalysisArtifacts,
  Bounds,
  Building,
  Connection,
  District,
  HistoryFrame,
  Landmark,
  Road,
  Vec3,
  WorldChunk,
  WorldChunkStats,
  WorldIndex,
  WorldManifest
} from "@/types/world";

export function createWorldArtifacts(manifest: WorldManifest, historyFrames: HistoryFrame[] = []): AnalysisArtifacts {
  const chunks = createWorldChunks(manifest);
  const index: WorldIndex = {
    version: "1.0",
    kind: "world_index",
    generatedAt: manifest.generatedAt,
    repo: manifest.repo,
    stats: manifest.stats,
    bounds: manifestBounds(manifest),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      name: chunk.districts.map((district) => district.name).join(", "),
      districtIds: chunk.districtIds,
      bounds: chunk.bounds,
      stats: chunk.stats,
      artifactId: chunk.id
    })),
    history: historyFrames.length > 0
      ? {
          frameCount: historyFrames.length,
          firstCommit: historyFrames[0]?.commit,
          lastCommit: historyFrames[historyFrames.length - 1]?.commit,
          artifactIds: historyFrames.map((frame) => frame.id)
        }
      : undefined,
    warnings: manifest.warnings
  };

  return { manifest, index, chunks, historyFrames };
}

export function createWorldChunks(manifest: WorldManifest): WorldChunk[] {
  const buildingsByDistrict = groupBy(manifest.buildings, (building) => building.districtId);
  const landmarksByDistrict = groupBy(manifest.landmarks, (landmark) => landmark.districtId);
  const roadsByDistrict = groupBy(manifest.roads, (road) => road.fromDistrictId ?? "global");
  const buildingDistrict = new Map(manifest.buildings.map((building) => [building.id, building.districtId]));
  const connectionsByDistrict = groupBy(manifest.connections, (connection) => buildingDistrict.get(connection.from) ?? "global");

  return manifest.districts.map((district) => {
    const buildings = buildingsByDistrict.get(district.id) ?? [];
    const landmarks = landmarksByDistrict.get(district.id) ?? [];
    const roads = roadsByDistrict.get(district.id) ?? [];
    const connections = connectionsByDistrict.get(district.id) ?? [];
    const stats = chunkStats([district], buildings, connections, roads, landmarks);

    return {
      version: "1.0",
      kind: "world_chunk",
      id: chunkIdForDistrict(district.id),
      generatedAt: manifest.generatedAt,
      repo: manifest.repo,
      districtIds: [district.id],
      bounds: boundsForItems([district], buildings, roads, landmarks),
      stats,
      districts: [district],
      buildings,
      connections,
      roads,
      landmarks
    };
  });
}

export function composeManifestFromArtifacts(index: WorldIndex, chunks: WorldChunk[]): WorldManifest {
  const orderedChunks = [...chunks].sort((a, b) => {
    const left = index.chunks.findIndex((chunk) => chunk.id === a.id);
    const right = index.chunks.findIndex((chunk) => chunk.id === b.id);
    return left - right || a.id.localeCompare(b.id);
  });

  return {
    version: "1.0",
    generatedAt: index.generatedAt,
    repo: index.repo,
    stats: index.stats,
    districts: orderedChunks.flatMap((chunk) => chunk.districts),
    buildings: orderedChunks.flatMap((chunk) => chunk.buildings).sort((a, b) => a.path.localeCompare(b.path)),
    connections: orderedChunks.flatMap((chunk) => chunk.connections).sort((a, b) => a.fromPath.localeCompare(b.fromPath) || a.toPath.localeCompare(b.toPath)),
    roads: orderedChunks.flatMap((chunk) => chunk.roads),
    landmarks: orderedChunks.flatMap((chunk) => chunk.landmarks).sort((a, b) => a.path.localeCompare(b.path)),
    warnings: index.warnings
  };
}

export function manifestBounds(manifest: WorldManifest): Bounds {
  return boundsForItems(manifest.districts, manifest.buildings, manifest.roads, manifest.landmarks);
}

function chunkStats(
  districts: District[],
  buildings: Building[],
  connections: Connection[],
  roads: Road[],
  landmarks: Landmark[]
): WorldChunkStats {
  return {
    districts: districts.length,
    buildings: buildings.length,
    connections: connections.length,
    roads: roads.length,
    landmarks: landmarks.length,
    loc: districts.reduce((sum, district) => sum + district.loc, 0),
    bytes: districts.reduce((sum, district) => sum + district.bytes, 0)
  };
}

function boundsForItems(districts: District[], buildings: Building[], roads: Road[], landmarks: Landmark[]): Bounds {
  const points: Vec3[] = [];

  for (const district of districts) {
    pushBoxPoints(points, district.position, district.dimensions);
  }
  for (const building of buildings) {
    pushBoxPoints(points, building.position, building.dimensions);
  }
  for (const landmark of landmarks) {
    pushBoxPoints(points, landmark.position, landmark.dimensions);
  }
  for (const road of roads) {
    for (const point of road.points) {
      points.push(point);
    }
  }

  if (points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      radius: 1
    };
  }

  const min = {
    x: round(Math.min(...points.map((point) => point.x))),
    y: round(Math.min(...points.map((point) => point.y))),
    z: round(Math.min(...points.map((point) => point.z)))
  };
  const max = {
    x: round(Math.max(...points.map((point) => point.x))),
    y: round(Math.max(...points.map((point) => point.y))),
    z: round(Math.max(...points.map((point) => point.z)))
  };
  const center = {
    x: round((min.x + max.x) / 2),
    y: round((min.y + max.y) / 2),
    z: round((min.z + max.z) / 2)
  };
  const radius = round(Math.max(...points.map((point) => distance(point, center)), 1));

  return { min, max, center, radius };
}

function pushBoxPoints(points: Vec3[], position: Vec3, dimensions: { width: number; height: number; depth: number }) {
  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  const halfDepth = dimensions.depth / 2;
  points.push(
    { x: position.x - halfWidth, y: position.y - halfHeight, z: position.z - halfDepth },
    { x: position.x + halfWidth, y: position.y + halfHeight, z: position.z + halfDepth }
  );
}

function chunkIdForDistrict(districtId: string): string {
  return `chunk-${districtId.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
