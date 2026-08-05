// Component name → chart. The `component` field on every widget blueprint is the
// key, so the spec sheet and the running app cannot drift: a widget whose name is
// not here renders its blueprint instead of a chart, visibly rather than silently.
import type { ComponentType } from 'react';
import type { ChartProps } from './types';
import {
  AnalogPriorLibrary, BasinAnalogFinder, BasinAnalogMap, BasinBenchmarkMap, BasinFrameworkMap,
  BasinPeerComparator, BasinScorecard, FrameworkEvidencePanel, TectonicCycleColumn,
} from './GroupBasin';
import {
  BasinModelCaseManager, BurialModel1D, ChanceFactorEditor, CommonRiskMap, DepositionalSystemMatrix,
  GenerationTimingChart, IntervalEvidenceLedger, PetroleumSystemColumn, PlayCalibrationPanel,
} from './GroupSystem';
import {
  DrillDropDecisionRecord, ExplorationPortfolioScenarios, OpportunityGateTracker, OpportunityMap,
  OpportunityRanking, OpportunityRegister, ResourceDistributionViewer, RiskValueBridge,
  VolumetricInputDeck,
} from './GroupOpportunity';

export const CHARTS: Record<string, ComponentType<ChartProps>> = {
  // Basin Intelligence
  BasinBenchmarkMap, BasinScorecard, BasinPeerComparator,
  TectonicCycleColumn, BasinFrameworkMap, FrameworkEvidencePanel,
  BasinAnalogFinder, BasinAnalogMap, AnalogPriorLibrary,
  // Petroleum-System Screening
  PetroleumSystemColumn, DepositionalSystemMatrix, IntervalEvidenceLedger,
  GenerationTimingChart, BurialModel1D, BasinModelCaseManager,
  CommonRiskMap, ChanceFactorEditor, PlayCalibrationPanel,
  // Opportunity Evaluation
  OpportunityRegister, OpportunityMap, OpportunityGateTracker,
  ResourceDistributionViewer, VolumetricInputDeck, RiskValueBridge,
  OpportunityRanking, ExplorationPortfolioScenarios, DrillDropDecisionRecord,
};

export type { ChartProps } from './types';
