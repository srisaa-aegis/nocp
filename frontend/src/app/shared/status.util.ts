import { ApplicationTypeCode, StatusId } from '../core/models';

export interface StatusPresentation {
  label: string;
  className: string;
}

const STATUS_PRESENTATION: Record<StatusId, StatusPresentation> = {
  1: { label: 'Draft', className: 'status--draft' },
  2: { label: 'Submitted', className: 'status--submitted' },
  3: { label: 'Inspected', className: 'status--inspected' },
  4: { label: 'Reviewed (ADFS)', className: 'status--review' },
  5: { label: 'Reviewed (DFS-CD)', className: 'status--review' },
  6: { label: 'Pending Final Approval', className: 'status--pending' },
  7: { label: 'Approved', className: 'status--approved' },
  8: { label: 'Returned with Comments', className: 'status--returned' },
  9: { label: 'Rejected', className: 'status--rejected' },
};

export function statusPresentation(statusId: StatusId): StatusPresentation {
  return STATUS_PRESENTATION[statusId] ?? { label: 'Unknown', className: 'status--draft' };
}

export interface ApplTypePresentation {
  label: string;
  icon: string;
}

const APPL_TYPE_PRESENTATION: Record<ApplicationTypeCode, ApplTypePresentation> = {
  P: { label: 'Provisional', icon: 'clipboard-list' },
  O: { label: 'Occupancy', icon: 'login' },
  R: { label: 'Renewal', icon: 'repeat' },
  RO: { label: 'Occupancy Renewal', icon: 'repeat' },
  D: { label: 'Declaration', icon: 'save' },
};

export function applTypePresentation(applType: ApplicationTypeCode): ApplTypePresentation {
  return APPL_TYPE_PRESENTATION[applType] ?? { label: applType, icon: 'file' };
}
