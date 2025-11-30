/**
 * Dashboard Configuration
 * Central configuration for the PR-CYBR Meshtastic BBS Dashboard
 */

const CONFIG = {
  // GitHub repository info
  owner: 'PR-CYBR',
  repo: 'PR-CYBR-M3SH-BBS',
  
  // Key workflow files to monitor
  workflows: {
    meshPublic: {
      file: 'pr-mesh-bbs-generate.yml',
      name: 'PR-MESH-BBS Generate',
      description: 'Public bulletin scheduler (09:00, 18:00 AST)'
    },
    cybrQr: {
      file: 'pr-cybr-bbs-qrs.yml',
      name: 'PR-CYBR-BBS QR Codes',
      description: 'QR code generator for private channels'
    },
    ci: {
      file: 'ci.yml',
      name: 'CI',
      description: 'Continuous integration tests and validation'
    }
  },
  
  // JSON data source paths (relative to repo root for Pages)
  jsonSources: {
    publicBulletins: 'out/pr-mesh-bbs/bulletins.json',
    privateChannel: (n) => `out/pr-cybr-bbs/channel-${n}.json`,
    nodeStatus: 'data/status/nodes.json',
    dashboardState: 'dashboard/state.json'
  },
  
  // QR code asset paths
  qrAssets: {
    basePath: 'assets/qr/pr-cybr-bbs',
    channels: {
      1: { name: 'OPS-SITREP', file: 'channel-1-OPS-SITREP.png' },
      2: { name: 'S2-INTEL', file: 'channel-2-S2-INTEL.png' },
      3: { name: 'S3-PLANS', file: 'channel-3-S3-PLANS.png' },
      4: { name: 'M3SH-OPS', file: 'channel-4-M3SH-OPS.png' },
      5: { name: 'LOG-RES', file: 'channel-5-LOG-RES.png' },
      6: { name: 'MAILB0X', file: 'channel-6-MAILB0X.png' }
    }
  },
  
  // Channel info for UI
  channels: {
    1: { name: 'OPS-SITREP', description: 'Island/division situational reports' },
    2: { name: 'S2-INTEL', description: 'Threats, incidents, BOLOs, Amber Alerts' },
    3: { name: 'S3-PLANS', description: 'Planned operations, deployments, FTXs' },
    4: { name: 'M3SH-OPS', description: 'PR-CYBR-MAP updates, node status, sensor status' },
    5: { name: 'LOG-RES', description: 'Logistics and resources' },
    6: { name: 'MAILB0X', description: 'Encrypted user messaging (Reticulum bridge)' }
  },
  
  // Refresh settings
  autoRefreshInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
  
  // GitHub API base URL
  githubApiBase: 'https://api.github.com'
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.workflows);
Object.freeze(CONFIG.jsonSources);
Object.freeze(CONFIG.qrAssets);
Object.freeze(CONFIG.channels);
