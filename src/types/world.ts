export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Dimensions = {
  width: number;
  height: number;
  depth: number;
};

export type AnalyzeRequest = {
  repoUrl: string;
};

export type RepoInfo = {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  cloneUrl: string;
  branch: string;
};

export type LanguageStats = {
  language: string;
  files: number;
  loc: number;
  bytes: number;
  color: string;
};

export type District = {
  id: string;
  name: string;
  path: string;
  fileCount: number;
  loc: number;
  bytes: number;
  dominantLanguage: string;
  color: string;
  position: Vec3;
  dimensions: Dimensions;
  languageStats: LanguageStats[];
};

export type Building = {
  id: string;
  kind: "file";
  districtId: string;
  name: string;
  path: string;
  language: string;
  bytes: number;
  loc: number;
  imports: number;
  symbols: number;
  todos: number;
  complexity: number;
  color: string;
  position: Vec3;
  dimensions: Dimensions;
  sourceUrl: string;
};

export type Connection = {
  id: string;
  kind: "import";
  from: string;
  to: string;
  fromPath: string;
  toPath: string;
  importPath: string;
};

export type Road = {
  id: string;
  name: string;
  kind: "sector_lane" | "connector";
  fromDistrictId?: string;
  toDistrictId?: string;
  points: Vec3[];
  width: number;
};

export type LandmarkKind =
  | "instruction_center"
  | "instruction_library"
  | "testing_yard"
  | "automation_panel"
  | "control_block";

export type Landmark = {
  id: string;
  kind: LandmarkKind;
  districtId: string;
  name: string;
  path: string;
  color: string;
  position: Vec3;
  dimensions: Dimensions;
  sourceUrl: string;
};

export type WorldStats = {
  files: number;
  renderedFiles: number;
  districts: number;
  buildings: number;
  connections: number;
  roads: number;
  landmarks: number;
  totalLoc: number;
  totalBytes: number;
  languages: LanguageStats[];
};

export type WorldManifest = {
  version: "1.0";
  generatedAt: string;
  repo: RepoInfo;
  stats: WorldStats;
  districts: District[];
  buildings: Building[];
  connections: Connection[];
  roads: Road[];
  landmarks: Landmark[];
  warnings: string[];
};

export type ViewMode = "overview" | "street" | "fly";

export type SelectableKind = "district" | "building" | "landmark" | "connection" | "road";

export type Selection = {
  kind: SelectableKind;
  id: string;
} | null;
