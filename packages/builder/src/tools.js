// ─────────────────────────────────────────────────────────────────────────
// B1 · Builder tool specs  (Opus, contract-freeze)
// The things Arganta Core can do WITH the builder. Same ToolSpec shape as
// @arganta/agent's TOOL_SPECS (name/title/description/params/backing/costClass/
// dataClass/sideEffect/autonomySafe) so the app merges them into one registry
// at call time — @arganta/agent stays generic, @arganta/builder owns these.
// A cross-package test asserts the shape matches.
//
// THE governance call (ADR-0005): publish_artifact is the ONLY builder tool
// that reaches the outside world (public runtime), so it alone is
// sideEffect:true, autonomySafe:false — a headless mission can never publish
// founder HTML to the internet without an explicit human/grant (autonomy.js
// enforces this shape, same as it already does for media publishing).
// ─────────────────────────────────────────────────────────────────────────

export const BUILDER_TOOL_SPECS = Object.freeze([
  {
    name: 'create_website', title: 'Build a website', backing: 'builder', costClass: 1, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Create a complete single-file website (landing/product/company/portfolio/…) from a brief. Returns a draft artifact — does NOT publish.',
    params: { type: 'object', properties: { brief: { type: 'string' }, websiteType: { type: 'string' }, brandKitId: { type: 'string' } }, required: ['brief'] },
  },
  {
    name: 'create_application', title: 'Build an app', backing: 'builder', costClass: 1, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Create a complete single-file interactive application (dashboard/tracker/planner/CRM/…) from a brief. Returns a draft artifact — does NOT publish.',
    params: { type: 'object', properties: { brief: { type: 'string' }, templateId: { type: 'string' }, useCircleSdk: { type: 'boolean' }, brandKitId: { type: 'string' } }, required: ['brief'] },
  },
  {
    name: 'revise_artifact', title: 'Revise', backing: 'builder', costClass: 1, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Revise an existing artifact with a natural-language instruction, preserving unrelated functionality. Returns the updated HTML as a new draft version.',
    params: { type: 'object', properties: { artifactId: { type: 'string' }, instruction: { type: 'string' } }, required: ['artifactId', 'instruction'] },
  },
  {
    name: 'validate_artifact', title: 'Validate', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Run the deterministic structural/security/quality checks on an artifact and report what passed and failed.',
    params: { type: 'object', properties: { artifactId: { type: 'string' } }, required: ['artifactId'] },
  },
  {
    name: 'save_version', title: 'Save version', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Save the current HTML as a new immutable version of the artifact.',
    params: { type: 'object', properties: { artifactId: { type: 'string' } }, required: ['artifactId'] },
  },
  {
    name: 'restore_version', title: 'Restore version', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Make a previous version current again. Does not delete history.',
    params: { type: 'object', properties: { artifactId: { type: 'string' }, versionNumber: { type: 'number' } }, required: ['artifactId', 'versionNumber'] },
  },
  {
    name: 'insert_component', title: 'Insert a block', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Insert a portable component block (nav/hero/chart/table/form/…) into an artifact.',
    params: { type: 'object', properties: { artifactId: { type: 'string' }, componentId: { type: 'string' } }, required: ['artifactId', 'componentId'] },
  },
  {
    name: 'apply_brand', title: 'Apply a brand kit', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: false, autonomySafe: true,
    description: 'Apply a brand kit (palette + type) to an artifact via its brand CSS variables.',
    params: { type: 'object', properties: { artifactId: { type: 'string' }, brandKitId: { type: 'string' } }, required: ['artifactId'] },
  },
  {
    // THE governed one. Publishing puts founder HTML on the public internet.
    name: 'publish_artifact', title: 'Publish', backing: 'builder', costClass: 0, dataClass: 'internal', sideEffect: true, autonomySafe: false,
    description: 'Publish a selected version of an artifact to a real public URL (build.arganta.app). Requires the artifact to pass validation. This is a public, outside-world action — always confirm with the founder.',
    params: { type: 'object', properties: { artifactId: { type: 'string' }, versionNumber: { type: 'number' } }, required: ['artifactId'] },
  },
]);

export const builderToolByName = (name) => BUILDER_TOOL_SPECS.find((t) => t.name === name) || null;
