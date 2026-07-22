// ReportView — the Report-zone tab switcher, ported 1:1 from COSMO_Final.html
// (function ReportView): Manager | Report (hierarchy) | Document | Presentation.
import { ReportManager } from './ReportManager';
import { ReportHub } from './ReportHub';
import { ReportDocument } from './ReportDocument';
import { ReportPresentation } from './ReportPresentation';

export function ReportView({ tab, goTab }: { tab: string; goTab: (tab: string) => void }) {
  if (tab === 'Report') return <ReportHub />;
  if (tab === 'Document') return <ReportDocument />;
  if (tab === 'Presentation') return <ReportPresentation />;
  return <ReportManager goTab={goTab} />;
}
