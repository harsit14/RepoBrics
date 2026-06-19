import type { WorldManifest } from "@/types/world";

export const demoManifest: WorldManifest = {
  "version": "1.0",
  "generatedAt": "2026-06-18T00:00:00.000Z",
  "repo": {
    "owner": "demo",
    "name": "starter-app",
    "fullName": "demo/starter-app",
    "url": "https://github.com/demo/starter-app",
    "cloneUrl": "https://github.com/demo/starter-app.git",
    "branch": "main"
  },
  "stats": {
    "files": 9,
    "renderedFiles": 9,
    "districts": 5,
    "buildings": 4,
    "connections": 3,
    "roads": 9,
    "landmarks": 5,
    "totalLoc": 40,
    "totalBytes": 953,
    "languages": [
      {
        "language": "TypeScript",
        "files": 5,
        "loc": 25,
        "bytes": 575,
        "color": "#3178c6"
      },
      {
        "language": "JSON",
        "files": 1,
        "loc": 8,
        "bytes": 116,
        "color": "#d29922"
      },
      {
        "language": "Markdown",
        "files": 2,
        "loc": 5,
        "bytes": 242,
        "color": "#7c8798"
      },
      {
        "language": "YAML",
        "files": 1,
        "loc": 2,
        "bytes": 20,
        "color": "#cb4b16"
      }
    ]
  },
  "districts": [
    {
      "id": "src",
      "name": "Src",
      "path": "src",
      "fileCount": 4,
      "loc": 21,
      "bytes": 460,
      "dominantLanguage": "TypeScript",
      "color": "#3178c6",
      "position": {
        "x": -6,
        "y": 0,
        "z": -12.7
      },
      "dimensions": {
        "width": 8.6,
        "height": 0.25,
        "depth": 8.6
      },
      "languageStats": [
        {
          "language": "TypeScript",
          "files": 4,
          "loc": 21,
          "bytes": 460,
          "color": "#3178c6"
        }
      ]
    },
    {
      "id": "root",
      "name": "Root Baseplate",
      "path": "/",
      "fileCount": 2,
      "loc": 11,
      "bytes": 284,
      "dominantLanguage": "JSON",
      "color": "#d29922",
      "position": {
        "x": 6.4,
        "y": 0,
        "z": -12.75
      },
      "dimensions": {
        "width": 7.8,
        "height": 0.25,
        "depth": 8.5
      },
      "languageStats": [
        {
          "language": "JSON",
          "files": 1,
          "loc": 8,
          "bytes": 116,
          "color": "#d29922"
        },
        {
          "language": "Markdown",
          "files": 1,
          "loc": 3,
          "bytes": 168,
          "color": "#7c8798"
        }
      ]
    },
    {
      "id": ".github",
      "name": ".Github",
      "path": ".github",
      "fileCount": 1,
      "loc": 2,
      "bytes": 20,
      "dominantLanguage": "YAML",
      "color": "#cb4b16",
      "position": {
        "x": -7.3,
        "y": 0,
        "z": 0.05
      },
      "dimensions": {
        "width": 6,
        "height": 0.25,
        "depth": 8.5
      },
      "languageStats": [
        {
          "language": "YAML",
          "files": 1,
          "loc": 2,
          "bytes": 20,
          "color": "#cb4b16"
        }
      ]
    },
    {
      "id": "docs",
      "name": "Docs",
      "path": "docs",
      "fileCount": 1,
      "loc": 2,
      "bytes": 74,
      "dominantLanguage": "Markdown",
      "color": "#7c8798",
      "position": {
        "x": 2.9,
        "y": 0,
        "z": 0.05
      },
      "dimensions": {
        "width": 6,
        "height": 0.25,
        "depth": 8.5
      },
      "languageStats": [
        {
          "language": "Markdown",
          "files": 1,
          "loc": 2,
          "bytes": 74,
          "color": "#7c8798"
        }
      ]
    },
    {
      "id": "tests",
      "name": "Tests",
      "path": "tests",
      "fileCount": 1,
      "loc": 4,
      "bytes": 115,
      "dominantLanguage": "TypeScript",
      "color": "#3178c6",
      "position": {
        "x": -7.3,
        "y": 0,
        "z": 12.75
      },
      "dimensions": {
        "width": 6,
        "height": 0.25,
        "depth": 8.5
      },
      "languageStats": [
        {
          "language": "TypeScript",
          "files": 1,
          "loc": 4,
          "bytes": 115,
          "color": "#3178c6"
        }
      ]
    }
  ],
  "buildings": [
    {
      "id": "building:src/api.ts",
      "kind": "file",
      "districtId": "src",
      "name": "api.ts",
      "path": "src/api.ts",
      "language": "TypeScript",
      "bytes": 154,
      "loc": 5,
      "imports": 1,
      "symbols": 1,
      "todos": 1,
      "complexity": 4.72,
      "color": "#3178c6",
      "position": {
        "x": -7.3,
        "y": 0.93,
        "z": -14
      },
      "dimensions": {
        "width": 1.36,
        "height": 1.48,
        "depth": 1.36
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/src/api.ts"
    },
    {
      "id": "building:src/app.ts",
      "kind": "file",
      "districtId": "src",
      "name": "app.ts",
      "path": "src/app.ts",
      "language": "TypeScript",
      "bytes": 178,
      "loc": 9,
      "imports": 2,
      "symbols": 2,
      "todos": 0,
      "complexity": 5.44,
      "color": "#3178c6",
      "position": {
        "x": -4.7,
        "y": 1.07,
        "z": -14
      },
      "dimensions": {
        "width": 1.38,
        "height": 1.75,
        "depth": 1.38
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/src/app.ts"
    },
    {
      "id": "building:src/db.ts",
      "kind": "file",
      "districtId": "src",
      "name": "db.ts",
      "path": "src/db.ts",
      "language": "TypeScript",
      "bytes": 66,
      "loc": 3,
      "imports": 0,
      "symbols": 1,
      "todos": 0,
      "complexity": 1.21,
      "color": "#3178c6",
      "position": {
        "x": -7.3,
        "y": 0.83,
        "z": -11.4
      },
      "dimensions": {
        "width": 1.27,
        "height": 1.27,
        "depth": 1.27
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/src/db.ts"
    },
    {
      "id": "building:src/theme.ts",
      "kind": "file",
      "districtId": "src",
      "name": "theme.ts",
      "path": "src/theme.ts",
      "language": "TypeScript",
      "bytes": 62,
      "loc": 4,
      "imports": 0,
      "symbols": 1,
      "todos": 0,
      "complexity": 1.22,
      "color": "#3178c6",
      "position": {
        "x": -4.7,
        "y": 0.88,
        "z": -11.4
      },
      "dimensions": {
        "width": 1.26,
        "height": 1.39,
        "depth": 1.26
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/src/theme.ts"
    }
  ],
  "connections": [
    {
      "id": "c8d96960a866",
      "kind": "import",
      "from": "building:src/api.ts",
      "to": "building:src/db.ts",
      "fromPath": "src/api.ts",
      "toPath": "src/db.ts",
      "importPath": "./db"
    },
    {
      "id": "bd4d530672e6",
      "kind": "import",
      "from": "building:src/app.ts",
      "to": "building:src/api.ts",
      "fromPath": "src/app.ts",
      "toPath": "src/api.ts",
      "importPath": "./api"
    },
    {
      "id": "752065db851a",
      "kind": "import",
      "from": "building:src/app.ts",
      "to": "building:src/theme.ts",
      "fromPath": "src/app.ts",
      "toPath": "src/theme.ts",
      "importPath": "./theme"
    }
  ],
  "roads": [
    {
      "id": "road:root:lane",
      "name": "Root Baseplate Lane",
      "kind": "sector_lane",
      "fromDistrictId": "root",
      "points": [
        {
          "x": 0.7,
          "y": 0.05,
          "z": -7.25
        },
        {
          "x": 12.1,
          "y": 0.05,
          "z": -7.25
        }
      ],
      "width": 1.25
    },
    {
      "id": "road:src:lane",
      "name": "Src Lane",
      "kind": "sector_lane",
      "fromDistrictId": "src",
      "points": [
        {
          "x": -12.1,
          "y": 0.05,
          "z": -7.15
        },
        {
          "x": 0.1,
          "y": 0.05,
          "z": -7.15
        }
      ],
      "width": 1.25
    },
    {
      "id": "road:.github:lane",
      "name": ".Github Lane",
      "kind": "sector_lane",
      "fromDistrictId": ".github",
      "points": [
        {
          "x": -12.1,
          "y": 0.05,
          "z": 5.55
        },
        {
          "x": -2.5,
          "y": 0.05,
          "z": 5.55
        }
      ],
      "width": 1.25
    },
    {
      "id": "road:docs:lane",
      "name": "Docs Lane",
      "kind": "sector_lane",
      "fromDistrictId": "docs",
      "points": [
        {
          "x": -1.9,
          "y": 0.05,
          "z": 5.55
        },
        {
          "x": 7.7,
          "y": 0.05,
          "z": 5.55
        }
      ],
      "width": 1.25
    },
    {
      "id": "road:tests:lane",
      "name": "Tests Lane",
      "kind": "sector_lane",
      "fromDistrictId": "tests",
      "points": [
        {
          "x": -12.1,
          "y": 0.05,
          "z": 18.25
        },
        {
          "x": -2.5,
          "y": 0.05,
          "z": 18.25
        }
      ],
      "width": 1.25
    },
    {
      "id": "road:root:src",
      "name": "Root Baseplate Connector",
      "kind": "connector",
      "fromDistrictId": "root",
      "toDistrictId": "src",
      "points": [
        {
          "x": 6.4,
          "y": 0.06,
          "z": -7.25
        },
        {
          "x": 0.2,
          "y": 0.06,
          "z": -7.25
        },
        {
          "x": 0.2,
          "y": 0.06,
          "z": -7.15
        },
        {
          "x": -6,
          "y": 0.06,
          "z": -7.15
        }
      ],
      "width": 1.05
    },
    {
      "id": "road:src:.github",
      "name": "Src Connector",
      "kind": "connector",
      "fromDistrictId": "src",
      "toDistrictId": ".github",
      "points": [
        {
          "x": -6,
          "y": 0.06,
          "z": -7.15
        },
        {
          "x": -6.65,
          "y": 0.06,
          "z": -7.15
        },
        {
          "x": -6.65,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": -7.3,
          "y": 0.06,
          "z": 5.55
        }
      ],
      "width": 1.05
    },
    {
      "id": "road:.github:docs",
      "name": ".Github Connector",
      "kind": "connector",
      "fromDistrictId": ".github",
      "toDistrictId": "docs",
      "points": [
        {
          "x": -7.3,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": -2.2,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": -2.2,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": 2.9,
          "y": 0.06,
          "z": 5.55
        }
      ],
      "width": 1.05
    },
    {
      "id": "road:docs:tests",
      "name": "Docs Connector",
      "kind": "connector",
      "fromDistrictId": "docs",
      "toDistrictId": "tests",
      "points": [
        {
          "x": 2.9,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": -2.2,
          "y": 0.06,
          "z": 5.55
        },
        {
          "x": -2.2,
          "y": 0.06,
          "z": 18.25
        },
        {
          "x": -7.3,
          "y": 0.06,
          "z": 18.25
        }
      ],
      "width": 1.05
    }
  ],
  "landmarks": [
    {
      "id": "landmark:.github/workflows/ci.yml",
      "kind": "automation_panel",
      "districtId": ".github",
      "name": "Automation Panel",
      "path": ".github/workflows/ci.yml",
      "color": "#bb6bd9",
      "position": {
        "x": -7.3,
        "y": 0.99,
        "z": 2.2
      },
      "dimensions": {
        "width": 1.25,
        "height": 1.6,
        "depth": 1.25
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/.github/workflows/ci.yml"
    },
    {
      "id": "landmark:docs/overview.md",
      "kind": "instruction_library",
      "districtId": "docs",
      "name": "Instruction Library",
      "path": "docs/overview.md",
      "color": "#56ccf2",
      "position": {
        "x": 2.9,
        "y": 0.74,
        "z": 2.2
      },
      "dimensions": {
        "width": 1.35,
        "height": 1.1,
        "depth": 1.35
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/docs/overview.md"
    },
    {
      "id": "landmark:package.json",
      "kind": "control_block",
      "districtId": "root",
      "name": "package.json",
      "path": "package.json",
      "color": "#eb5757",
      "position": {
        "x": 7.5,
        "y": 0.69,
        "z": -10.6
      },
      "dimensions": {
        "width": 1.1,
        "height": 1,
        "depth": 1.1
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/package.json"
    },
    {
      "id": "landmark:README.md",
      "kind": "instruction_center",
      "districtId": "root",
      "name": "Instruction Center",
      "path": "README.md",
      "color": "#f2c94c",
      "position": {
        "x": 5.3,
        "y": 0.92,
        "z": -10.6
      },
      "dimensions": {
        "width": 1.65,
        "height": 1.45,
        "depth": 1.2
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/README.md"
    },
    {
      "id": "landmark:tests/app.test.ts",
      "kind": "testing_yard",
      "districtId": "tests",
      "name": "Testing Yard",
      "path": "tests/app.test.ts",
      "color": "#27ae60",
      "position": {
        "x": -7.3,
        "y": 0.59,
        "z": 14.9
      },
      "dimensions": {
        "width": 1.7,
        "height": 0.8,
        "depth": 1.7
      },
      "sourceUrl": "https://github.com/demo/starter-app/blob/main/tests/app.test.ts"
    }
  ],
  "warnings": []
};
