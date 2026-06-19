"use client";

import { ExternalLink, FileCode2, GitBranch, Landmark as LandmarkIcon, Map, Network } from "lucide-react";
import type { Building, Connection, District, Landmark, Road, Selection, WorldManifest } from "@/types/world";

type Props = {
  manifest: WorldManifest | null;
  selection: Selection;
};

export function Inspector({ manifest, selection }: Props) {
  const selected = resolveSelection(manifest, selection);

  return (
    <aside className="w-full border-t border-slate-200 bg-white md:w-[360px] md:border-l md:border-t-0">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inspector</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">{selected?.title ?? "Select a brick"}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!manifest ? <EmptyInspector /> : null}
          {manifest && !selected ? <RepoSummary manifest={manifest} /> : null}
          {selected?.type === "building" ? <BuildingDetails building={selected.item} manifest={manifest} /> : null}
          {selected?.type === "district" ? <DistrictDetails district={selected.item} /> : null}
          {selected?.type === "landmark" ? <LandmarkDetails landmark={selected.item} /> : null}
          {selected?.type === "connection" ? <ConnectionDetails connection={selected.item} /> : null}
          {selected?.type === "road" ? <RoadDetails road={selected.item} /> : null}
        </div>
      </div>
    </aside>
  );
}

function EmptyInspector() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      <p className="font-medium text-slate-900">Ready</p>
      <p className="mt-1 leading-5">The next generated model will appear here with file and dependency details.</p>
    </div>
  );
}

function RepoSummary({ manifest }: { manifest: WorldManifest }) {
  return (
    <div className="space-y-5">
      <StatGrid
        items={[
          ["Files", manifest.stats.files.toLocaleString()],
          ["Rendered", manifest.stats.renderedFiles.toLocaleString()],
          ["Districts", manifest.stats.districts.toLocaleString()],
          ["Roads", manifest.stats.roads.toLocaleString()],
          ["LOC", manifest.stats.totalLoc.toLocaleString()]
        ]}
      />
      <section>
        <h3 className="text-sm font-semibold text-slate-950">Languages</h3>
        <div className="mt-3 space-y-2">
          {manifest.stats.languages.slice(0, 7).map((language) => (
            <div key={language.language} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: language.color }} />
                <span className="truncate">{language.language}</span>
              </span>
              <span className="shrink-0 text-slate-500">{language.files} files</span>
            </div>
          ))}
        </div>
      </section>
      <LandmarkLegend manifest={manifest} />
      {manifest.warnings.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {manifest.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

const LANDMARK_LEGEND: Array<{ kind: string; label: string; color: string }> = [
  { kind: "instruction_center", label: "Instruction Center · README", color: "#f2c94c" },
  { kind: "instruction_library", label: "Instruction Library · docs", color: "#56ccf2" },
  { kind: "testing_yard", label: "Testing Yard · tests", color: "#27ae60" },
  { kind: "automation_panel", label: "Automation Panel · CI", color: "#bb6bd9" },
  { kind: "control_block", label: "Control Block · config", color: "#eb5757" }
];

function LandmarkLegend({ manifest }: { manifest: WorldManifest }) {
  const present = LANDMARK_LEGEND.filter((entry) => manifest.landmarks.some((landmark) => landmark.kind === entry.kind));
  if (present.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950">Landmarks</h3>
      <div className="mt-3 space-y-2">
        {present.map((entry) => (
          <div key={entry.kind} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: entry.color }} />
            <span className="truncate text-slate-700">{entry.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BuildingDetails({ building, manifest }: { building: Building; manifest: WorldManifest | null }) {
  const related = manifest?.connections.filter((connection) => connection.from === building.id || connection.to === building.id) ?? [];

  return (
    <div className="space-y-5">
      <InfoHeader icon={<FileCode2 size={18} aria-hidden="true" />} label="File" path={building.path} sourceUrl={building.sourceUrl} />
      <StatGrid
        items={[
          ["Language", building.language],
          ["LOC", building.loc.toLocaleString()],
          ["Imports", building.imports.toLocaleString()],
          ["Symbols", building.symbols.toLocaleString()],
          ["TODOs", building.todos.toLocaleString()],
          ["Complexity", building.complexity.toLocaleString()]
        ]}
      />
      <RelatedConnections connections={related} currentId={building.id} />
    </div>
  );
}

function DistrictDetails({ district }: { district: District }) {
  return (
    <div className="space-y-5">
      <InfoHeader icon={<Map size={18} aria-hidden="true" />} label="District" path={district.path} />
      <StatGrid
        items={[
          ["Files", district.fileCount.toLocaleString()],
          ["LOC", district.loc.toLocaleString()],
          ["Bytes", district.bytes.toLocaleString()],
          ["Dominant", district.dominantLanguage]
        ]}
      />
      <section>
        <h3 className="text-sm font-semibold text-slate-950">Breakdown</h3>
        <div className="mt-3 space-y-2">
          {district.languageStats.map((language) => (
            <div key={language.language} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: language.color }} />
                {language.language}
              </span>
              <span className="text-slate-500">{language.files}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LandmarkDetails({ landmark }: { landmark: Landmark }) {
  return (
    <div className="space-y-5">
      <InfoHeader icon={<LandmarkIcon size={18} aria-hidden="true" />} label={formatKind(landmark.kind)} path={landmark.path} sourceUrl={landmark.sourceUrl} />
      <StatGrid
        items={[
          ["District", landmark.districtId],
          ["Width", landmark.dimensions.width.toString()],
          ["Height", landmark.dimensions.height.toString()],
          ["Depth", landmark.dimensions.depth.toString()]
        ]}
      />
    </div>
  );
}

function ConnectionDetails({ connection }: { connection: Connection }) {
  return (
    <div className="space-y-5">
      <InfoHeader icon={<Network size={18} aria-hidden="true" />} label="Dependency" path={connection.importPath} />
      <div className="rounded-lg border border-slate-200 p-3 text-sm">
        <p className="break-words font-medium text-slate-950">{connection.fromPath}</p>
        <div className="my-3 flex items-center gap-2 text-slate-500">
          <GitBranch size={16} aria-hidden="true" />
          <span>imports</span>
        </div>
        <p className="break-words font-medium text-slate-950">{connection.toPath}</p>
      </div>
    </div>
  );
}

function RoadDetails({ road }: { road: Road }) {
  return (
    <div className="space-y-5">
      <InfoHeader icon={<Map size={18} aria-hidden="true" />} label={road.kind === "sector_lane" ? "Sector Road" : "Connector Road"} path={road.name} />
      <StatGrid
        items={[
          ["Width", road.width.toString()],
          ["Points", road.points.length.toString()],
          ["From", road.fromDistrictId ?? "World"],
          ["To", road.toDistrictId ?? road.fromDistrictId ?? "World"]
        ]}
      />
    </div>
  );
}

function InfoHeader({ icon, label, path, sourceUrl }: { icon: React.ReactNode; label: string; path: string; sourceUrl?: string }) {
  return (
    <section className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-sm text-slate-950">{path}</p>
      {sourceUrl ? (
        <a className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-900" href={sourceUrl} target="_blank" rel="noreferrer">
          Source
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : null}
    </section>
  );
}

function StatGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedConnections({ connections, currentId }: { connections: Connection[]; currentId: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950">Related Links</h3>
      <div className="mt-3 space-y-2">
        {connections.length === 0 ? <p className="text-sm text-slate-500">No resolved repo-local imports.</p> : null}
        {connections.map((connection) => {
          const outgoing = connection.from === currentId;
          return (
            <div key={connection.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{outgoing ? "Imports" : "Imported by"}</p>
              <p className="mt-1 break-words text-slate-950">{outgoing ? connection.toPath : connection.fromPath}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function resolveSelection(manifest: WorldManifest | null, selection: Selection) {
  if (!manifest || !selection) {
    return null;
  }

  if (selection.kind === "building") {
    const item = manifest.buildings.find((building) => building.id === selection.id);
    return item ? { type: "building" as const, title: item.name, item } : null;
  }
  if (selection.kind === "district") {
    const item = manifest.districts.find((district) => district.id === selection.id);
    return item ? { type: "district" as const, title: item.name, item } : null;
  }
  if (selection.kind === "landmark") {
    const item = manifest.landmarks.find((landmark) => landmark.id === selection.id);
    return item ? { type: "landmark" as const, title: item.name, item } : null;
  }
  if (selection.kind === "connection") {
    const item = manifest.connections.find((connection) => connection.id === selection.id);
    return item ? { type: "connection" as const, title: item.importPath, item } : null;
  }
  const item = manifest.roads.find((road) => road.id === selection.id);
  return item ? { type: "road" as const, title: item.name, item } : null;
}

function formatKind(kind: string): string {
  return kind
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
