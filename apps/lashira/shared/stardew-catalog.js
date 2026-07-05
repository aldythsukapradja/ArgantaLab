import catalog from './stardew-catalog.generated.json';

export const STARDEW_CATALOG_META = catalog.meta;
export const STARDEW_ASSET_CATALOG = catalog.assets;

export const STARDEW_CATALOG_SECTIONS = Object.entries(STARDEW_CATALOG_META.sections).map(([section]) => ({
  section,
  assets: STARDEW_ASSET_CATALOG.filter((asset) => asset.section === section),
}));

export const STARDEW_RUNTIME_WORLD_ASSETS = STARDEW_ASSET_CATALOG.filter((asset) => asset.runtimeRole === 'world-material');
export const STARDEW_RUNTIME_ENTITY_ASSETS = STARDEW_ASSET_CATALOG.filter((asset) => asset.runtimeRole === 'entity-material');
export const STARDEW_CHARACTER_REFERENCE_ASSETS = STARDEW_ASSET_CATALOG.filter((asset) => asset.runtimeRole === 'reference-only-character');
