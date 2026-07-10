// Shared castle/cottage skin catalog — used by the Castle hotspot panel
// (HotspotPanels.jsx) AND the Home hub's House tab (Panels.jsx) so both
// pickers stay in sync instead of drifting apart.
export const CASTLE_SKINS = [
  ['house', 'Old house'], ['shack', 'Shack'], ['cottage', 'Cottage'], ['farmhouse', 'Farmhouse'],
  ['storybook', 'Storybook'], ['fairytale', 'Fairytale'], ['royal', 'Royal'], ['whimsical', 'Whimsical'],
];
// Thumbnails — mirror farm-art-bundled.js lashira.castleskin.* files.
export const CASTLE_SKIN_FILE = {
  house: 'house.png', shack: 'lib/house_t1_shack.png', cottage: 'lib/house_t2_cottage.png',
  farmhouse: 'lib/house_t3_farmhouse.png', storybook: 'lib/castle_opt1_storybook.png',
  fairytale: 'lib/castle_opt2_fairytale.png', royal: 'lib/castle_opt3_royal.png',
  whimsical: 'lib/castle_opt4_whimsical.png',
};
export const castleSkinLabel = (id) => (CASTLE_SKINS.find(([sid]) => sid === id) || [null, 'Cottage'])[1];
export const castleSkinThumbUrl = (id) => new URL('farm-art/' + (CASTLE_SKIN_FILE[id] || CASTLE_SKIN_FILE.cottage), document.baseURI).href;
