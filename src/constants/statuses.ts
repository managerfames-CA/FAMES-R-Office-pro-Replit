import type {
  AcceptanceStatus, AppSettings, ClientStatus, DeadlineStatus, EngagementLetterStatus,
  EngagementStatus, IndependenceStatus, PlanningMemoStatus, StaffRole, TaskStatus, ReviewNoteStatus, CompletionItemStatus, AuditFindingStatus, ReportVersionStatus, ManagementLetterStatus, RepresentationLetterStatus, ReportIssueStatus, AmendmentStatus, ReviewRecordStatus, ListedChecklistStatus, RegulatoryDeadlineStatus, AuditCommitteeCommunicationStatus, QualityReviewStatus, KamStatus, TaxAssignmentStatus, VatAssignmentStatus, RjscAssignmentStatus, AccountingAssignmentStatus, AdvisoryAssignmentStatus, TimesheetStatus, ExpenseStatus, InvoiceStatus, CollectionStatus, CommunicationStatus, FollowUpStatus
} from '../types/models';

export const CLIENT_STATUSES: ClientStatus[] = ['Draft', 'Pending Acceptance', 'Active', 'Suspended', 'Inactive', 'Rejected'];
export const STAFF_ROLES: StaffRole[] = ['Partner', 'Manager', 'Senior', 'Assistant', 'Accounts/Admin', 'Quality Reviewer', 'Read-only'];
export const ENGAGEMENT_STATUSES: EngagementStatus[] = ['Draft', 'Acceptance Pending', 'Approved', 'Planning', 'Fieldwork', 'Manager Review', 'Partner Review', 'Reporting', 'Final Approved', 'Report Issued', 'Locked', 'Closed', 'Cancelled'];
export const TASK_STATUSES: TaskStatus[] = ['Backlog', 'Assigned', 'In Progress', 'Blocked', 'Submitted', 'Reviewed', 'Completed', 'Cancelled'];
export const DEADLINE_STATUSES: DeadlineStatus[] = ['Open', 'In Progress', 'Completed', 'Cancelled'];
export const ACCEPTANCE_STATUSES: AcceptanceStatus[] = ['Draft', 'Information Pending', 'Manager Review', 'Partner Review', 'Approved', 'Rejected', 'Locked'];
export const INDEPENDENCE_STATUSES: IndependenceStatus[] = ['Draft', 'Assessment in Progress', 'Threat Identified', 'Safeguard Pending', 'Manager Review', 'Partner Clearance', 'Cleared', 'Rejected', 'Locked'];
export const ENGAGEMENT_LETTER_STATUSES: EngagementLetterStatus[] = ['Draft', 'Internal Review', 'Sent to Client', 'Client Review', 'Accepted', 'Rejected', 'Expired', 'Superseded'];
export const PLANNING_MEMO_STATUSES: PlanningMemoStatus[] = ['Not Started', 'Draft', 'In Progress', 'Manager Review', 'Partner Review', 'Approved', 'Returned', 'Locked'];
export const THREAT_RESPONSES = ['Yes', 'No', 'Not Applicable'] as const;

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  Backlog: ['Assigned', 'Cancelled'], Assigned: ['Backlog', 'In Progress', 'Cancelled'],
  'In Progress': ['Assigned', 'Blocked', 'Submitted', 'Cancelled'], Blocked: ['In Progress', 'Cancelled'],
  Submitted: ['In Progress', 'Reviewed', 'Cancelled'], Reviewed: ['In Progress', 'Submitted', 'Completed', 'Cancelled'],
  Completed: [], Cancelled: []
};

export const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  Draft: ['Acceptance Pending', 'Cancelled'], 'Acceptance Pending': ['Approved', 'Draft', 'Cancelled'],
  Approved: ['Planning', 'Cancelled'], Planning: ['Fieldwork', 'Cancelled'], Fieldwork: ['Manager Review', 'Cancelled'],
  'Manager Review': ['Fieldwork', 'Partner Review', 'Cancelled'], 'Partner Review': ['Manager Review', 'Reporting', 'Cancelled'],
  Reporting: ['Partner Review', 'Final Approved', 'Cancelled'], 'Final Approved': ['Report Issued'],
  'Report Issued': ['Locked', 'Closed'], Locked: ['Closed'], Closed: [], Cancelled: []
};

export const ACCEPTANCE_TRANSITIONS: Record<AcceptanceStatus, AcceptanceStatus[]> = {
  Draft: ['Information Pending', 'Manager Review', 'Rejected'],
  'Information Pending': ['Draft', 'Manager Review', 'Rejected'],
  'Manager Review': ['Information Pending', 'Partner Review', 'Rejected'],
  'Partner Review': ['Manager Review', 'Approved', 'Rejected'],
  Approved: ['Locked'], Rejected: ['Draft'], Locked: []
};

export const INDEPENDENCE_TRANSITIONS: Record<IndependenceStatus, IndependenceStatus[]> = {
  Draft: ['Assessment in Progress', 'Threat Identified', 'Manager Review', 'Rejected'],
  'Assessment in Progress': ['Draft', 'Threat Identified', 'Safeguard Pending', 'Manager Review', 'Rejected'],
  'Threat Identified': ['Safeguard Pending', 'Manager Review', 'Rejected'],
  'Safeguard Pending': ['Threat Identified', 'Manager Review', 'Rejected'],
  'Manager Review': ['Assessment in Progress', 'Partner Clearance', 'Rejected'],
  'Partner Clearance': ['Manager Review', 'Cleared', 'Rejected'],
  Cleared: ['Locked'], Rejected: ['Draft'], Locked: []
};

export const PLANNING_MEMO_TRANSITIONS: Record<PlanningMemoStatus, PlanningMemoStatus[]> = {
  'Not Started': ['Draft', 'In Progress'], Draft: ['In Progress', 'Manager Review'],
  'In Progress': ['Draft', 'Manager Review'], 'Manager Review': ['In Progress', 'Partner Review', 'Returned'],
  'Partner Review': ['Manager Review', 'Approved', 'Returned'], Approved: ['Locked'],
  Returned: ['In Progress', 'Manager Review'], Locked: []
};

export const SERVICE_TYPES = ['Audit', 'Tax', 'VAT', 'RJSC', 'Accounting', 'Advisory', 'Internal Firm Work', 'Other'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;
export const RISK_RATINGS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const PLANNING_MILESTONE_TYPES = ['Planning Completion', 'Fieldwork Start', 'Fieldwork Completion', 'Manager Review Deadline', 'Partner Review Deadline', 'Reporting Deadline', 'Other'] as const;
export const REQUIRED_PLANNING_MILESTONES = PLANNING_MILESTONE_TYPES.filter(item => item !== 'Other');

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: '7.0', appVersion: '7.0.0', operatorName: 'Local Operator', upcomingDeadlineDays: 14, expenseReceiptThreshold: 5000,
  numbering: {
    clientPrefix: 'CL-', engagementPrefix: 'ENG-', startingSequence: 1, numberPadding: 4,
    referencePrefixes: {
      reviewNote: 'RN-', finding: 'FND-', invoice: 'INV-', documentRequest: 'PBC-', amendment: 'AMD-',
      collection: 'COL-', followUp: 'FU-', managementLetter: 'ML-', representationLetter: 'RL-'
    }
  },
  statusSettings: [
    ...CLIENT_STATUSES.map(value => ({ entity: 'Client' as const, value, isActive: true })),
    ...ENGAGEMENT_STATUSES.map(value => ({ entity: 'Engagement' as const, value, isActive: true })),
    ...TASK_STATUSES.map(value => ({ entity: 'Task' as const, value, isActive: true })),
    ...DEADLINE_STATUSES.map(value => ({ entity: 'Deadline' as const, value, isActive: true }))
  ]
};

export const AUDIT_RISK_STATUSES = ['Draft', 'Identified', 'Assessment in Progress', 'Response Required', 'Manager Review', 'Partner Review', 'Approved', 'Closed', 'Rejected'] as const;
export const MATERIALITY_STATUSES = ['Draft', 'In Preparation', 'Manager Review', 'Partner Review', 'Approved', 'Superseded', 'Locked'] as const;
export const PROGRAMME_STATUSES = ['Not Started', 'Assigned', 'In Progress', 'Completed', 'Not Applicable', 'Review Pending', 'Reviewed', 'Returned'] as const;
export const WORKING_PAPER_STATUSES = ['Draft', 'In Preparation', 'Prepared', 'Submitted for Review', 'Rework', 'Manager Cleared', 'Partner Cleared', 'Final', 'Locked'] as const;
export const EVIDENCE_STATUSES = ['Requested', 'Received', 'Under Review', 'Accepted', 'Rejected', 'Superseded'] as const;
export const SAMPLING_STATUSES = ['Draft', 'In Progress', 'Completed', 'Reviewed'] as const;
export const DOCUMENT_REQUEST_STATUSES = ['Draft', 'Sent', 'Partially Received', 'Received', 'Under Review', 'Accepted', 'Rejected', 'Resubmission Required', 'Waived', 'Closed'] as const;
export const AUDIT_ASSERTIONS = ['Existence', 'Completeness', 'Accuracy', 'Valuation', 'Rights and Obligations', 'Classification', 'Presentation', 'Cut-off'] as const;
export const AUDIT_RISK_TYPES = ['Financial Statement Level', 'Assertion Level', 'Fraud Risk', 'Significant Risk', 'Compliance Risk', 'Going Concern Risk', 'Related Party Risk', 'Other'] as const;

export const REVIEW_NOTE_STATUSES: ReviewNoteStatus[] = ['Open','Assigned','Response Submitted','Reviewer Recheck','Cleared','Reopened','Cancelled'];
export const REVIEW_LEVELS = ['Manager','Partner'] as const;
export const REVIEW_SEVERITIES = ['Critical','High','Medium','Low','Observation'] as const;
export const COMPLETION_ITEM_STATUSES: CompletionItemStatus[] = ['Not Started','In Progress','Evidence Pending','Completed','Not Applicable','Reviewed','Exception'];
export const AUDIT_FINDING_STATUSES: AuditFindingStatus[] = ['Draft','Confirmed','Discussed','Accepted','Disputed','Corrected','Uncorrected','Resolved','Reported','Closed'];
export const AUDIT_FINDING_TYPES = ['Audit Difference','Control Deficiency','Compliance Issue','Disclosure Issue','Observation'] as const;
export const REPORT_VERSION_STATUSES: ReportVersionStatus[] = ['Draft','Manager Review','Returned','Partner Review','Final Approved','Issued','Superseded','Withdrawn'];
export const AUDIT_OPINIONS = ['Unmodified','Qualified','Adverse','Disclaimer'] as const;
export const MANAGEMENT_LETTER_STATUSES: ManagementLetterStatus[] = ['Draft','Manager Review','Partner Review','Sent to Client','Client Response Received','Final','Superseded'];
export const REPRESENTATION_LETTER_STATUSES: RepresentationLetterStatus[] = ['Draft','Internal Review','Sent to Client','Signed','Rejected','Superseded'];
export const REPORT_ISSUE_STATUSES: ReportIssueStatus[] = ['Ready to Issue','Issued','Reissued','Withdrawn'];
export const AMENDMENT_STATUSES: AmendmentStatus[] = ['Requested','Manager Review','Partner Review','Approved','Rejected','In Progress','Completed','Re-Locked','Cancelled'];
export const REVIEW_RECORD_STATUSES: ReviewRecordStatus[] = ['Not Started','In Progress','Completed','Returned','Reopened','Approved','Rejected'];


export const LISTED_CHECKLIST_STATUSES: ListedChecklistStatus[] = ['Not Started','In Progress','Evidence Pending','Manager Review','Partner Review','Completed','Exception','Not Applicable'];
export const REGULATORY_DEADLINE_STATUSES: RegulatoryDeadlineStatus[] = ['Draft','Upcoming','In Progress','Submitted','Completed','Overdue','Waived','Cancelled'];
export const AUDIT_COMMITTEE_STATUSES: AuditCommitteeCommunicationStatus[] = ['Draft','Internal Review','Ready','Communicated','Follow-up Pending','Closed'];
export const QUALITY_REVIEW_STATUSES: QualityReviewStatus[] = ['Not Required','Planned','In Progress','Findings Raised','Response Pending','Review Complete','Cleared','Rejected'];
export const KAM_STATUSES: KamStatus[] = ['Draft','Under Consideration','Manager Review','Partner Review','Quality Review','Approved','Not a KAM','Reported'];
export const TAX_ASSIGNMENT_STATUSES: TaxAssignmentStatus[] = ['Draft','Documents Pending','Computation in Progress','Manager Review','Client Confirmation','Submission Ready','Submitted','Assessment/Hearing','Completed','Closed','Cancelled'];
export const VAT_ASSIGNMENT_STATUSES: VatAssignmentStatus[] = ['Draft','Records Pending','Preparation','Reconciliation','Manager Review','Client Approval','Submission Ready','Submitted','Notice/Audit Follow-up','Completed','Closed','Cancelled'];
export const RJSC_ASSIGNMENT_STATUSES: RjscAssignmentStatus[] = ['Draft','Information Pending','Documents Prepared','Internal Review','Client Sign-off','Filing Ready','Filed','Accepted','Rejected','Completed','Closed'];
export const ACCOUNTING_ASSIGNMENT_STATUSES: AccountingAssignmentStatus[] = ['Draft','Records Pending','Processing','Reconciliation','Internal Review','Draft Accounts','Client Review','Finalised','Closed','Cancelled'];
export const ADVISORY_ASSIGNMENT_STATUSES: AdvisoryAssignmentStatus[] = ['Proposal','Client Review','Approved','Planning','Information Gathering','Analysis','Draft Deliverable','Internal Review','Client Presentation','Final Deliverable','Closed','Cancelled'];

export const TIMESHEET_STATUSES: TimesheetStatus[] = ['Draft','Submitted','Approved','Returned','Locked'];
export const EXPENSE_STATUSES: ExpenseStatus[] = ['Draft','Submitted','Approved','Rejected','Reimbursed','Cancelled'];
export const INVOICE_STATUSES: InvoiceStatus[] = ['Draft','Review Pending','Approved','Issued','Partially Collected','Paid','Overdue','Adjusted','Written Off','Cancelled'];
export const COLLECTION_STATUSES: CollectionStatus[] = ['Draft','Confirmed','Reversed'];
export const COMMUNICATION_STATUSES: CommunicationStatus[] = ['Draft','Final','Amended','Closed'];
export const FOLLOW_UP_STATUSES: FollowUpStatus[] = ['Open','In Progress','Waiting','Completed','Cancelled','Overdue'];
export const COMMUNICATION_TYPES = ['Email','Phone','Meeting','Letter','Messaging','Internal Discussion','Other'] as const;
