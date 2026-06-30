import * as S from './scenes'

export interface SceneDef { id: string; title: string; el: React.ReactNode }
export interface FlightDef { id: string; title: string; product: boolean; laneY: number; scenes: SceneDef[] }

// Each flight is a horizontal lane the camera travels along; products sit in a
// band below the hub, company above, vision far below.
export const FLIGHTS: FlightDef[] = [
  {
    id: 'argantalab', title: 'ArgantaLab', product: true, laneY: 1600,
    scenes: [
      { id: 'dive', title: 'The dive', el: <S.ALDive /> },
      { id: 'identity', title: 'Meet Buddy', el: <S.ALIdentity /> },
      { id: 'shop', title: 'The shop', el: <S.ALShop /> },
      { id: 'worlds', title: 'Six worlds', el: <S.ALWorlds /> },
      { id: 'journey', title: 'The journey', el: <S.ALJourney /> },
      { id: 'lesson', title: 'A lesson', el: <S.ALLesson /> },
      { id: 'kin', title: 'Openworld & Kin', el: <S.ALKin /> },
      { id: 'kintown', title: 'KinWorld town', el: <S.ALKinTown /> },
      { id: 'build', title: 'Build a game', el: <S.ALBuild /> },
      { id: 'prompt', title: 'Prompt engineering', el: <S.ALPrompt /> },
      { id: 'pitch', title: 'Pitch it', el: <S.ALPitch /> },
      { id: 'ship', title: 'Ship it', el: <S.ALShip /> },
      { id: 'parent', title: 'Parent view', el: <S.ALParent /> },
    ],
  },
  {
    id: 'kinetik', title: 'KinetikCircle', product: true, laneY: 3500,
    scenes: [
      { id: 'today', title: 'Today', el: <S.KToday /> },
      { id: 'calendar', title: 'Calendar', el: <S.KCalendar /> },
      { id: 'moments', title: 'Moments', el: <S.KMoments /> },
      { id: 'milestone', title: 'Milestones', el: <S.KMilestone /> },
      { id: 'apps', title: 'Apps', el: <S.KApps /> },
      { id: 'me', title: 'The passport', el: <S.KMe /> },
    ],
  },
  {
    id: 'circleapps', title: 'Circle Apps', product: true, laneY: 5200,
    scenes: [
      { id: 'overview', title: 'Nine apps', el: <S.CAOverview /> },
      { id: 'montage', title: 'The suite', el: <S.CAMontage /> },
      { id: 'spine', title: 'The shared spine', el: <S.CASpine /> },
    ],
  },
  {
    id: 'company', title: 'Company', product: false, laneY: -1900,
    scenes: [
      { id: 'mission', title: 'Mission', el: <S.CMission /> },
      { id: 'whynow', title: 'Why now', el: <S.CWhyNow /> },
      { id: 'wedge', title: 'The wedge', el: <S.CWedge /> },
      { id: 'agents', title: 'The AI company', el: <S.CAgents /> },
      { id: 'builders', title: 'Command center', el: <S.CBuilders /> },
      { id: 'metrics', title: 'Insight', el: <S.CMetrics /> },
      { id: 'model', title: 'Business model', el: <S.CModel /> },
      { id: 'ask', title: 'Traction & ask', el: <S.CTractionAsk /> },
    ],
  },
  {
    id: 'vision', title: 'Vision', product: false, laneY: 6900,
    scenes: [
      { id: 'child', title: 'One child', el: <S.VChild /> },
      { id: 'family', title: 'One family', el: <S.VFamily /> },
      { id: 'all', title: 'Every family', el: <S.VAll /> },
      { id: 'flywheel', title: 'The flywheel', el: <S.VFlywheel /> },
      { id: 'line', title: 'Kids play, parents grow', el: <S.VLine /> },
      { id: 'invite', title: 'Join the flight', el: <S.VInvite /> },
    ],
  },
]

export const FLIGHT_BY_ID: Record<string, FlightDef> = Object.fromEntries(FLIGHTS.map(f => [f.id, f]))

// coordinates
export const HUB_POS = { x: 0, y: 0 }
export const SUBHUB_POS = { x: 0, y: 1600 }
export const LANE_X0 = 1900
export const LANE_STEP = 1680

export function flightScenePos(flightId: string, i: number) {
  const f = FLIGHT_BY_ID[flightId]
  return { x: LANE_X0 + i * LANE_STEP, y: f.laneY }
}
