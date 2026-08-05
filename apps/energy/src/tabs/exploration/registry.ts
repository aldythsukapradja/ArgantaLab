// The parked v1 workbench's tab order. The study spine that used to live here
// (STUDY_STAGES, consumed by the old StudyTree left rail and the placeholder
// SuiteCanvas) is gone: the ribbon in workflow.ts replaced the rail, and the
// widget canvas replaced the placeholder. Both files were dead — nothing
// imported them — so they were removed rather than left to rot.
export const LEGACY_TAB_NAMES = [
  'Overview', 'Basemap', 'Seismic', 'Wells', 'Interpretation',
  'Plays & Prospects', 'Volumetrics', 'Risk & Uncertainty',
] as const;
