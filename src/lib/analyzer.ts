import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  Building,
  Connection,
  AnalysisArtifacts,
  Dimensions,
  District,
  Landmark,
  LandmarkKind,
  LanguageStats,
  RepoInfo,
  Road,
  Vec3,
  WorldManifest
} from "@/types/world";
import { languageForPath, sortLanguageStats } from "@/lib/language";
import { parseGitHubUrl } from "@/lib/github";
import { analyzeRepositoryHistory } from "@/lib/history";
import { createWorldArtifacts } from "@/lib/worldArtifacts";

const execFileAsync = promisify(execFile);
const MAX_RENDERED_FILES = 1_500;
const MAX_TRACKED_FILES = 20_000;
const MAX_TEXT_FILE_BYTES = 250 * 1024;
const CACHE_ROOT = path.join(os.tmpdir(), "repobricks-cache");

const SKIPPED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "third_party",
  "vendor"
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".py"];
const INDEX_NAMES = ["index.ts", "index.tsx", "index.js", "index.jsx", "__init__.py"];

export class RepoUnavailableError extends Error {
  constructor(message = "The repository could not be cloned. Confirm it is public and reachable.") {
    super(message);
    this.name = "RepoUnavailableError";
  }
}

export class RepoTooLargeError extends Error {
  constructor(message = "This repository is too large for the MVP analyzer.") {
    super(message);
    this.name = "RepoTooLargeError";
  }
}

type FileRecord = {
  path: string;
  districtId: string;
  language: string;
  color: string;
  bytes: number;
  loc: number;
  imports: number;
  symbols: number;
  todos: number;
  importSpecs: string[];
  isLandmark: boolean;
  landmarkKind?: LandmarkKind;
};

export type AnalyzeOptions = {
  generatedAt?: string;
  maxRenderedFiles?: number;
  repoInfo?: Partial<RepoInfo>;
  includeHistory?: boolean;
  maxHistoryFrames?: number;
};

export async function analyzeGitHubRepository(repoUrl: string, options: AnalyzeOptions = {}): Promise<WorldManifest> {
  const cloned = await cloneGitHubRepository(repoUrl, options);
  return analyzeRepositoryPath(cloned.repoPath, {
    ...options,
    repoInfo: await repoInfoForClonedRepository(cloned.repoPath, cloned.repoInfo, options.repoInfo)
  });
}

export async function analyzeGitHubRepositoryArtifacts(repoUrl: string, options: AnalyzeOptions = {}): Promise<AnalysisArtifacts> {
  const cloned = await cloneGitHubRepository(repoUrl, options);
  return analyzeRepositoryArtifacts(cloned.repoPath, {
    ...options,
    repoInfo: await repoInfoForClonedRepository(cloned.repoPath, cloned.repoInfo, options.repoInfo)
  });
}

export async function analyzeRepositoryArtifacts(repoPath: string, options: AnalyzeOptions = {}): Promise<AnalysisArtifacts> {
  const manifest = await analyzeRepositoryPath(repoPath, options);
  const historyFrames = options.includeHistory
    ? await analyzeRepositoryHistory(repoPath, { maxFrames: options.maxHistoryFrames })
    : [];
  return createWorldArtifacts(manifest, historyFrames);
}

async function cloneGitHubRepository(repoUrl: string, options: AnalyzeOptions): Promise<{ repoPath: string; repoInfo: Omit<RepoInfo, "branch"> }> {
  const parsed = parseGitHubUrl(repoUrl);
  const cacheKey = crypto.createHash("sha256").update(parsed.url).digest("hex").slice(0, 16);
  const repoPath = path.join(CACHE_ROOT, cacheKey);

  await fs.rm(repoPath, { recursive: true, force: true });
  await fs.mkdir(CACHE_ROOT, { recursive: true });

  try {
    const depth = options.includeHistory ? String(clamp(options.maxHistoryFrames ?? 60, 2, 250)) : "1";
    await execFileAsync("git", ["clone", "--depth", depth, "--single-branch", parsed.cloneUrl, repoPath], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024
    });
  } catch {
    throw new RepoUnavailableError();
  }

  return { repoPath, repoInfo: parsed };
}

async function repoInfoForClonedRepository(
  repoPath: string,
  parsed: Omit<RepoInfo, "branch">,
  overrides: Partial<RepoInfo> = {}
): Promise<Partial<RepoInfo>> {
  return {
    ...parsed,
    ...overrides,
    branch: overrides.branch ?? (await currentBranch(repoPath))
  };
}

export async function analyzeRepositoryPath(repoPath: string, options: AnalyzeOptions = {}): Promise<WorldManifest> {
  const repoInfo = normalizeRepoInfo(repoPath, {
    ...(options.repoInfo ?? {}),
    branch: options.repoInfo?.branch ?? (await currentBranch(repoPath))
  });
  const allFiles = (await listTrackedFiles(repoPath)).filter(shouldIncludePath).sort();
  if (allFiles.length > MAX_TRACKED_FILES) {
    throw new RepoTooLargeError(`This repo has ${allFiles.length} tracked files; the MVP limit is ${MAX_TRACKED_FILES}.`);
  }

  const warnings: string[] = [];
  const selectedFiles = allFiles.slice(0, options.maxRenderedFiles ?? MAX_RENDERED_FILES);
  if (allFiles.length > selectedFiles.length) {
    warnings.push(`Rendered ${selectedFiles.length} of ${allFiles.length} files. Later files were skipped for MVP performance.`);
  }

  const pathSet = new Set(selectedFiles);
  const records: FileRecord[] = [];

  for (const filePath of selectedFiles) {
    records.push(await analyzeFile(repoPath, filePath));
  }

  const layout = computeDistrictLayout(records);
  const buildings = buildBuildings(layout, repoInfo);
  const landmarks = buildLandmarks(layout, repoInfo);
  const districts = buildDistricts(layout);
  const connections = buildConnections(records, buildings, pathSet);
  const roads = buildRoads(districts, records, pathSet);
  const languageStats = aggregateLanguages(records);

  return {
    version: "1.0",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repo: repoInfo,
    stats: {
      files: allFiles.length,
      renderedFiles: records.length,
      districts: districts.length,
      buildings: buildings.length,
      connections: connections.length,
      roads: roads.length,
      landmarks: landmarks.length,
      totalLoc: records.reduce((sum, file) => sum + file.loc, 0),
      totalBytes: records.reduce((sum, file) => sum + file.bytes, 0),
      languages: languageStats
    },
    districts,
    buildings,
    connections,
    roads,
    landmarks,
    warnings
  };
}

export function extractImportSpecs(filePath: string, text: string): string[] {
  const specs = new Set<string>();
  const ext = path.extname(filePath);

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    const jsPattern = /\b(?:import|export)\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of text.matchAll(jsPattern)) {
      specs.add(match[1] || match[2]);
    }
  }

  if (ext === ".py") {
    const pyPattern = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
    for (const match of text.matchAll(pyPattern)) {
      specs.add(match[1] || match[2]);
    }
  }

  return [...specs].sort();
}

export function resolveImportPath(fromPath: string, spec: string, pathSet: Set<string>): string | null {
  if (!spec || spec.startsWith("node:")) {
    return null;
  }

  if (spec.startsWith(".")) {
    const fromDir = path.posix.dirname(fromPath);
    const candidate = path.posix.normalize(path.posix.join(fromDir, spec));
    return findCandidate(candidate, pathSet);
  }

  const asPath = spec.replaceAll(".", "/");
  return findCandidate(asPath, pathSet);
}

function findCandidate(base: string, pathSet: Set<string>): string | null {
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...INDEX_NAMES.map((name) => `${base}/${name}`)
  ];
  return candidates.find((candidate) => pathSet.has(candidate)) ?? null;
}

async function analyzeFile(repoPath: string, filePath: string): Promise<FileRecord> {
  const absolute = path.join(repoPath, filePath);
  const stat = await fs.stat(absolute);
  const language = languageForPath(filePath);
  const districtId = districtIdForPath(filePath);
  const landmarkKind = landmarkKindForPath(filePath);

  if (stat.size > MAX_TEXT_FILE_BYTES || (await looksBinary(absolute))) {
    return {
      path: filePath,
      districtId,
      language: language.language,
      color: language.color,
      bytes: stat.size,
      loc: 0,
      imports: 0,
      symbols: 0,
      todos: 0,
      importSpecs: [],
      isLandmark: Boolean(landmarkKind),
      landmarkKind
    };
  }

  const text = await fs.readFile(absolute, "utf8");
  const importSpecs = extractImportSpecs(filePath, text);
  return {
    path: filePath,
    districtId,
    language: language.language,
    color: language.color,
    bytes: stat.size,
    loc: countLoc(text),
    imports: importSpecs.length,
    symbols: countSymbols(filePath, text),
    todos: countTodos(text),
    importSpecs,
    isLandmark: Boolean(landmarkKind),
    landmarkKind
  };
}

async function looksBinary(filePath: string): Promise<boolean> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}

function countLoc(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function countTodos(text: string): number {
  return text.match(/\b(?:TODO|FIXME)\b/gi)?.length ?? 0;
}

function countSymbols(filePath: string, text: string): number {
  const ext = path.extname(filePath);
  const patterns = ext === ".py"
    ? [/^\s*(?:def|class)\s+\w+/gm]
    : [/\b(?:function|class|interface|type|const|let|var)\s+\w+/g, /=>/g];

  return patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
}

// --- Deterministic city layout -------------------------------------------------
// Each district is a baseplate sized to snugly fit its building grid plus a front
// row of landmarks. Baseplates are then shelf-packed into rows so they never
// overlap and the whole city stays roughly square, then recentered on the origin.

const CELL = 2.6; // world units per building cell (footprint + breathing room)
const PLATE_MARGIN = 1.7; // studded border around the building grid
const LANDMARK_GAP = 2.2; // spacing between landmarks in the front row
const LANDMARK_ROW_DEPTH = 2.5; // depth reserved at the plate front for landmarks
const DISTRICT_GAP = 4.2; // gap between baseplates (room for roads)
const PLATE_TOP = 0.19; // height of a baseplate's top surface

type DistrictLayout = {
  id: string;
  records: FileRecord[];
  files: FileRecord[];
  landmarks: FileRecord[];
  cols: number;
  rows: number;
  position: Vec3;
  dimensions: Dimensions;
};

function computeDistrictLayout(records: FileRecord[]): DistrictLayout[] {
  const byDistrict = groupBy(records, (record) => record.districtId);
  const ordered = [...byDistrict.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const sized = ordered.map(([id, districtRecords]) => {
    const files = [...districtRecords].filter((record) => !record.isLandmark).sort((a, b) => a.path.localeCompare(b.path));
    const landmarks = [...districtRecords]
      .filter((record) => record.isLandmark && record.landmarkKind)
      .sort((a, b) => landmarkRank(a) - landmarkRank(b) || a.path.localeCompare(b.path))
      .slice(0, 5);

    const count = Math.max(files.length, 1);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const landmarkDepth = landmarks.length > 0 ? LANDMARK_ROW_DEPTH : 0;
    const gridWidth = Math.max(cols * CELL, landmarks.length * LANDMARK_GAP);
    const width = round(gridWidth + PLATE_MARGIN * 2);
    const depth = round(rows * CELL + landmarkDepth + PLATE_MARGIN * 2);

    return { id, records: districtRecords, files, landmarks, cols, rows, width, depth };
  });

  const totalArea = sized.reduce((sum, plate) => sum + plate.width * plate.depth, 0);
  const widest = sized.reduce((max, plate) => Math.max(max, plate.width), 0);
  const rowLimit = Math.max(widest, Math.sqrt(totalArea) * 1.3);

  const placements: Array<{ plate: (typeof sized)[number]; x: number; z: number }> = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;

  for (const plate of sized) {
    if (cursorX > 0 && cursorX + plate.width > rowLimit) {
      cursorX = 0;
      cursorZ += rowDepth + DISTRICT_GAP;
      rowDepth = 0;
    }
    placements.push({ plate, x: cursorX + plate.width / 2, z: cursorZ + plate.depth / 2 });
    cursorX += plate.width + DISTRICT_GAP;
    rowDepth = Math.max(rowDepth, plate.depth);
  }

  const minX = Math.min(...placements.map((item) => item.x - item.plate.width / 2));
  const maxX = Math.max(...placements.map((item) => item.x + item.plate.width / 2));
  const minZ = Math.min(...placements.map((item) => item.z - item.plate.depth / 2));
  const maxZ = Math.max(...placements.map((item) => item.z + item.plate.depth / 2));
  const offsetX = -(minX + maxX) / 2;
  const offsetZ = -(minZ + maxZ) / 2;

  return placements.map(({ plate, x, z }) => ({
    id: plate.id,
    records: plate.records,
    files: plate.files,
    landmarks: plate.landmarks,
    cols: plate.cols,
    rows: plate.rows,
    position: { x: round(x + offsetX), y: 0, z: round(z + offsetZ) },
    dimensions: { width: plate.width, height: 0.25, depth: plate.depth }
  }));
}

function buildBuildings(layout: DistrictLayout[], repo: RepoInfo): Building[] {
  const output: Building[] = [];

  for (const district of layout) {
    const { cols, rows } = district;
    const landmarkDepth = district.landmarks.length > 0 ? LANDMARK_ROW_DEPTH : 0;
    const gridCenterZ = -landmarkDepth / 2; // push the grid back, leaving the front strip for landmarks

    district.files.forEach((file, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const folderDepth = Math.max(0, file.path.split("/").length - 2);
      const nestingBonus = clamp(folderDepth * 0.22, 0, 1.5);
      const height = clamp(0.55 + Math.log10(file.loc + 1) * 1.2 + nestingBonus, 0.7, 7.8);
      const footprint = clamp(0.8 + Math.log2(file.bytes + 1) / 13, 0.8, CELL * 0.72);
      const localX = (col + 0.5 - cols / 2) * CELL;
      const localZ = gridCenterZ + (row + 0.5 - rows / 2) * CELL;

      output.push({
        id: idForPath("building", file.path),
        kind: "file",
        districtId: district.id,
        name: file.path.split("/").pop() ?? file.path,
        path: file.path,
        language: file.language,
        bytes: file.bytes,
        loc: file.loc,
        imports: file.imports,
        symbols: file.symbols,
        todos: file.todos,
        complexity: complexityScore(file),
        color: file.color,
        position: {
          x: round(district.position.x + localX),
          y: round(PLATE_TOP + height / 2),
          z: round(district.position.z + localZ)
        },
        dimensions: {
          width: round(footprint),
          height: round(height),
          depth: round(footprint)
        },
        sourceUrl: sourceUrl(repo, file.path)
      });
    });
  }

  return output.sort((a, b) => a.path.localeCompare(b.path));
}

function buildLandmarks(layout: DistrictLayout[], repo: RepoInfo): Landmark[] {
  const output: Landmark[] = [];

  for (const district of layout) {
    const count = district.landmarks.length;
    if (count === 0) {
      continue;
    }
    const frontZ = district.dimensions.depth / 2 - PLATE_MARGIN - 0.4;

    district.landmarks.forEach((file, index) => {
      const kind = file.landmarkKind ?? "control_block";
      const dimensions = landmarkDimensions(kind);
      const localX = (index + 0.5 - count / 2) * LANDMARK_GAP;

      output.push({
        id: idForPath("landmark", file.path),
        kind,
        districtId: district.id,
        name: landmarkName(file),
        path: file.path,
        color: landmarkColor(kind),
        position: {
          x: round(district.position.x + localX),
          y: round(PLATE_TOP + dimensions.height / 2),
          z: round(district.position.z + frontZ)
        },
        dimensions,
        sourceUrl: sourceUrl(repo, file.path)
      });
    });
  }

  return output.sort((a, b) => a.path.localeCompare(b.path));
}

function buildDistricts(layout: DistrictLayout[]): District[] {
  return layout.map((district) => {
    const languageStats = aggregateLanguages(district.records);
    const dominant = languageStats[0];

    return {
      id: district.id,
      name: districtName(district.id),
      path: district.id === "root" ? "/" : district.id,
      fileCount: district.records.length,
      loc: district.records.reduce((sum, record) => sum + record.loc, 0),
      bytes: district.records.reduce((sum, record) => sum + record.bytes, 0),
      dominantLanguage: dominant?.language ?? "Other",
      color: dominant?.color ?? "#8b95a5",
      position: district.position,
      dimensions: district.dimensions,
      languageStats
    };
  });
}

function buildConnections(records: FileRecord[], buildings: Building[], pathSet: Set<string>): Connection[] {
  const buildingByPath = new Map(buildings.map((building) => [building.path, building]));
  const output: Connection[] = [];
  const seen = new Set<string>();

  for (const file of records) {
    const fromBuilding = buildingByPath.get(file.path);
    if (!fromBuilding) {
      continue;
    }

    for (const spec of file.importSpecs) {
      const targetPath = resolveImportPath(file.path, spec, pathSet);
      const toBuilding = targetPath ? buildingByPath.get(targetPath) : undefined;
      if (!targetPath || !toBuilding || targetPath === file.path) {
        continue;
      }

      const key = `${file.path}->${targetPath}:${spec}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      output.push({
        id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
        kind: "import",
        from: fromBuilding.id,
        to: toBuilding.id,
        fromPath: file.path,
        toPath: targetPath,
        importPath: spec
      });
    }
  }

  return output.sort((a, b) => a.fromPath.localeCompare(b.fromPath) || a.toPath.localeCompare(b.toPath));
}

function buildRoads(districts: District[], records: FileRecord[], pathSet: Set<string>): Road[] {
  const sorted = [...districts].sort((a, b) => a.position.z - b.position.z || a.position.x - b.position.x || a.id.localeCompare(b.id));
  const roads: Road[] = [];
  const districtById = new Map(districts.map((district) => [district.id, district]));
  const recordByPath = new Map(records.map((record) => [record.path, record]));

  for (const district of sorted) {
    const halfWidth = district.dimensions.width / 2;
    const z = roadLaneZ(district);
    roads.push({
      id: `road:${district.id}:lane`,
      name: `${district.name} Lane`,
      kind: "sector_lane",
      fromDistrictId: district.id,
      points: [
        { x: round(district.position.x - halfWidth - 1.8), y: 0.05, z: round(z) },
        { x: round(district.position.x + halfWidth + 1.8), y: 0.05, z: round(z) }
      ],
      width: 1.25
    });
  }

  const districtOrder = new Map(sorted.map((district, index) => [district.id, index]));
  const linkedDistricts = new Map<string, { from: District; to: District; count: number }>();

  for (const record of records) {
    for (const spec of record.importSpecs) {
      const targetPath = resolveImportPath(record.path, spec, pathSet);
      const target = targetPath ? recordByPath.get(targetPath) : undefined;
      if (!target || target.path === record.path || target.districtId === record.districtId) {
        continue;
      }

      const fromDistrict = districtById.get(record.districtId);
      const toDistrict = districtById.get(target.districtId);
      if (!fromDistrict || !toDistrict) {
        continue;
      }

      const orderedPair = orderDistrictPair(fromDistrict, toDistrict, districtOrder);
      const key = `${orderedPair.from.id}:${orderedPair.to.id}`;
      const existing = linkedDistricts.get(key);
      linkedDistricts.set(key, {
        ...orderedPair,
        count: (existing?.count ?? 0) + 1
      });
    }
  }

  const connectors = [...linkedDistricts.values()].sort(
    (a, b) => (districtOrder.get(a.from.id) ?? 0) - (districtOrder.get(b.from.id) ?? 0) || (districtOrder.get(a.to.id) ?? 0) - (districtOrder.get(b.to.id) ?? 0)
  );

  for (const connector of connectors) {
    const startZ = roadLaneZ(connector.from);
    const endZ = roadLaneZ(connector.to);
    const midX = round((connector.from.position.x + connector.to.position.x) / 2);

    roads.push({
      id: `road:${connector.from.id}:${connector.to.id}`,
      name: `${connector.from.name} to ${connector.to.name} Route`,
      kind: "connector",
      fromDistrictId: connector.from.id,
      toDistrictId: connector.to.id,
      points: [
        { x: round(connector.from.position.x), y: 0.06, z: round(startZ) },
        { x: midX, y: 0.06, z: round(startZ) },
        { x: midX, y: 0.06, z: round(endZ) },
        { x: round(connector.to.position.x), y: 0.06, z: round(endZ) }
      ],
      width: 1.05
    });
  }

  return roads;
}

function roadLaneZ(district: District): number {
  return district.position.z + district.dimensions.depth / 2 + 1.25;
}

function orderDistrictPair(
  first: District,
  second: District,
  order: Map<string, number>
): { from: District; to: District } {
  const firstOrder = order.get(first.id) ?? 0;
  const secondOrder = order.get(second.id) ?? 0;

  if (firstOrder < secondOrder || (firstOrder === secondOrder && first.id.localeCompare(second.id) <= 0)) {
    return { from: first, to: second };
  }
  return { from: second, to: first };
}

function aggregateLanguages(files: FileRecord[]): LanguageStats[] {
  const stats = new Map<string, LanguageStats>();
  for (const file of files) {
    const existing = stats.get(file.language) ?? {
      language: file.language,
      files: 0,
      loc: 0,
      bytes: 0,
      color: file.color
    };
    existing.files += 1;
    existing.loc += file.loc;
    existing.bytes += file.bytes;
    stats.set(file.language, existing);
  }
  return sortLanguageStats(stats);
}

async function listTrackedFiles(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, "-c", "core.quotepath=false", "ls-files"], {
      maxBuffer: 10 * 1024 * 1024
    });
    const files = stdout.split(/\r?\n/).filter(Boolean);
    if (files.length > 0) {
      return files;
    }
  } catch {
    // Test fixtures can be plain folders. Production GitHub repos always use git ls-files.
  }

  return walkFiles(repoPath);
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        files.push(...(await walkFiles(root, absolute)));
      }
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files.sort();
}

async function currentBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, "branch", "--show-current"]);
    return stdout.trim() || "HEAD";
  } catch {
    return "HEAD";
  }
}

function shouldIncludePath(filePath: string): boolean {
  return filePath.split("/").every((segment) => !SKIPPED_DIRS.has(segment));
}

function normalizeRepoInfo(repoPath: string, info: Partial<RepoInfo> = {}): RepoInfo {
  const fallbackName = path.basename(repoPath);
  const owner = info.owner ?? "local";
  const name = info.name ?? fallbackName;
  const url = info.url ?? `https://github.com/${owner}/${name}`;

  return {
    owner,
    name,
    fullName: info.fullName ?? `${owner}/${name}`,
    url,
    cloneUrl: info.cloneUrl ?? `${url}.git`,
    branch: info.branch ?? "HEAD"
  };
}

function districtIdForPath(filePath: string): string {
  return filePath.includes("/") ? filePath.split("/")[0] : "root";
}

function districtName(districtId: string): string {
  if (districtId === "root") {
    return "Root Baseplate";
  }
  return districtId
    .replaceAll(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function landmarkKindForPath(filePath: string): LandmarkKind | undefined {
  const lower = filePath.toLowerCase();
  const base = lower.split("/").pop() ?? lower;

  if (/^readme(\.[a-z0-9]+)?$/.test(base)) {
    return "instruction_center";
  }
  if (lower.startsWith("docs/") || lower.includes("/docs/")) {
    return "instruction_library";
  }
  if (lower.startsWith("test/") || lower.startsWith("tests/") || lower.includes("/tests/")) {
    return "testing_yard";
  }
  if (lower.startsWith(".github/")) {
    return "automation_panel";
  }
  if (isConfigFile(base)) {
    return "control_block";
  }
  return undefined;
}

function isConfigFile(base: string): boolean {
  return [
    "package.json",
    "pyproject.toml",
    "cargo.toml",
    "go.mod",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "next.config.mjs",
    "next.config.js",
    "vite.config.ts",
    "tailwind.config.ts",
    "tsconfig.json"
  ].includes(base);
}

function landmarkRank(file: FileRecord): number {
  const order: LandmarkKind[] = [
    "instruction_center",
    "control_block",
    "automation_panel",
    "testing_yard",
    "instruction_library"
  ];
  return order.indexOf(file.landmarkKind ?? "control_block");
}

function landmarkName(file: FileRecord): string {
  const base = file.path.split("/").pop() ?? file.path;
  switch (file.landmarkKind) {
    case "instruction_center":
      return "Instruction Center";
    case "instruction_library":
      return "Instruction Library";
    case "testing_yard":
      return "Testing Yard";
    case "automation_panel":
      return "Automation Panel";
    case "control_block":
    default:
      return base;
  }
}

function landmarkColor(kind: LandmarkKind): string {
  switch (kind) {
    case "instruction_center":
      return "#f2c94c";
    case "instruction_library":
      return "#56ccf2";
    case "testing_yard":
      return "#27ae60";
    case "automation_panel":
      return "#bb6bd9";
    case "control_block":
      return "#eb5757";
  }
}

function landmarkDimensions(kind: LandmarkKind): Dimensions {
  switch (kind) {
    case "instruction_center":
      return { width: 1.65, height: 1.45, depth: 1.2 };
    case "instruction_library":
      return { width: 1.35, height: 1.1, depth: 1.35 };
    case "testing_yard":
      return { width: 1.7, height: 0.8, depth: 1.7 };
    case "automation_panel":
      return { width: 1.25, height: 1.6, depth: 1.25 };
    case "control_block":
      return { width: 1.1, height: 1.0, depth: 1.1 };
  }
}

function sourceUrl(repo: RepoInfo, filePath: string): string {
  return `${repo.url}/blob/${repo.branch}/${filePath}`;
}

function idForPath(prefix: string, filePath: string): string {
  return `${prefix}:${filePath}`;
}

function complexityScore(file: FileRecord): number {
  return round(file.imports * 1.5 + file.symbols * 1.2 + file.todos * 2 + file.loc / 220);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
