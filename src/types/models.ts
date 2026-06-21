export type RecordStatus = string;

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  updatedByName: string;
  recordVersion: number;
  status: RecordStatus;
  isDeleted: boolean;
}

export type ClientStatus = 'Draft' | 'Pending Acceptance' | 'Active' | 'Suspended' | 'Inactive' | 'Rejected';
export type RiskRating = 'Low' | 'Medium' | 'High' | 'Critical';
export type StaffRole = 'Partner' | 'Manager' | 'Senior' | 'Assistant' | 'Accounts/Admin' | 'Quality Reviewer' | 'Read-only';
export type EngagementStatus = 'Draft' | 'Acceptance Pending' | 'Approved' | 'Planning' | 'Fieldwork' | 'Manager Review' | 'Partner Review' | 'Reporting' | 'Final Approved' | 'Report Issued' | 'Locked' | 'Closed' | 'Cancelled';
export type TaskStatus = 'Backlog' | 'Assigned' | 'In Progress' | 'Blocked' | 'Submitted' | 'Reviewed' | 'Completed' | 'Cancelled';
export type DeadlineStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled';
export type Priority = 'Low' | 'Normal' | 'High' | 'Critical';

export type AcceptanceStatus = 'Draft' | 'Information Pending' | 'Manager Review' | 'Partner Review' | 'Approved' | 'Rejected' | 'Locked';
export type IndependenceStatus = 'Draft' | 'Assessment in Progress' | 'Threat Identified' | 'Safeguard Pending' | 'Manager Review' | 'Partner Clearance' | 'Cleared' | 'Rejected' | 'Locked';
export type EngagementLetterStatus = 'Draft' | 'Internal Review' | 'Sent to Client' | 'Client Review' | 'Accepted' | 'Rejected' | 'Expired' | 'Superseded';
export type PlanningMemoStatus = 'Not Started' | 'Draft' | 'In Progress' | 'Manager Review' | 'Partner Review' | 'Approved' | 'Returned' | 'Locked';
export type ThreatResponse = 'Yes' | 'No' | 'Not Applicable';
export type AuditRiskStatus = 'Draft' | 'Identified' | 'Assessment in Progress' | 'Response Required' | 'Manager Review' | 'Partner Review' | 'Approved' | 'Closed' | 'Rejected';
export type AuditRiskType = 'Financial Statement Level' | 'Assertion Level' | 'Fraud Risk' | 'Significant Risk' | 'Compliance Risk' | 'Going Concern Risk' | 'Related Party Risk' | 'Other';
export type AuditAssertion = 'Existence' | 'Completeness' | 'Accuracy' | 'Valuation' | 'Rights and Obligations' | 'Classification' | 'Presentation' | 'Cut-off';
export type MaterialityStatus = 'Draft' | 'In Preparation' | 'Manager Review' | 'Partner Review' | 'Approved' | 'Superseded' | 'Locked';
export type ProgrammeProcedureStatus = 'Not Started' | 'Assigned' | 'In Progress' | 'Completed' | 'Not Applicable' | 'Review Pending' | 'Reviewed' | 'Returned';
export type WorkingPaperStatus = 'Draft' | 'In Preparation' | 'Prepared' | 'Submitted for Review' | 'Rework' | 'Manager Cleared' | 'Partner Cleared' | 'Final' | 'Locked';
export type EvidenceStatus = 'Requested' | 'Received' | 'Under Review' | 'Accepted' | 'Rejected' | 'Superseded';
export type SamplingStatus = 'Draft' | 'In Progress' | 'Completed' | 'Reviewed';
export type DocumentRequestStatus = 'Draft' | 'Sent' | 'Partially Received' | 'Received' | 'Under Review' | 'Accepted' | 'Rejected' | 'Resubmission Required' | 'Waived' | 'Closed';

export type ReviewNoteStatus = 'Open' | 'Assigned' | 'Response Submitted' | 'Reviewer Recheck' | 'Cleared' | 'Reopened' | 'Cancelled';
export type ReviewLevel = 'Manager' | 'Partner';
export type ReviewSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Observation';
export type CompletionItemStatus = 'Not Started' | 'In Progress' | 'Evidence Pending' | 'Completed' | 'Not Applicable' | 'Reviewed' | 'Exception';
export type AuditFindingStatus = 'Draft' | 'Confirmed' | 'Discussed' | 'Accepted' | 'Disputed' | 'Corrected' | 'Uncorrected' | 'Resolved' | 'Reported' | 'Closed';
export type AuditFindingType = 'Audit Difference' | 'Control Deficiency' | 'Compliance Issue' | 'Disclosure Issue' | 'Observation';
export type ReportVersionStatus = 'Draft' | 'Manager Review' | 'Returned' | 'Partner Review' | 'Final Approved' | 'Issued' | 'Superseded' | 'Withdrawn';
export type AuditOpinion = 'Unmodified' | 'Qualified' | 'Adverse' | 'Disclaimer';
export type ManagementLetterStatus = 'Draft' | 'Manager Review' | 'Partner Review' | 'Sent to Client' | 'Client Response Received' | 'Final' | 'Superseded';
export type RepresentationLetterStatus = 'Draft' | 'Internal Review' | 'Sent to Client' | 'Signed' | 'Rejected' | 'Superseded';
export type ReportIssueStatus = 'Ready to Issue' | 'Issued' | 'Reissued' | 'Withdrawn';
export type AmendmentStatus = 'Requested' | 'Manager Review' | 'Partner Review' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed' | 'Re-Locked' | 'Cancelled';
export type ReviewRecordStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Returned' | 'Reopened' | 'Approved' | 'Rejected';


export interface Client extends BaseRecord {
  clientCode: string;
  legalName: string;
  tradeName: string;
  entityType: string;
  industryId: string;
  clientCategoryId: string;
  status: ClientStatus;
  isListedPie: boolean;
  tin: string;
  bin: string;
  registrationNumber: string;
  financialYearEnd: string;
  registeredAddress: string;
  businessAddress: string;
  primaryPhone: string;
  primaryEmail: string;
  website: string;
  responsiblePartnerId: string;
  responsibleManagerId: string;
  riskRating: RiskRating;
  notes: string;
  duplicateOverrideReason?: string;
}

export interface ClientContact extends BaseRecord {
  clientId: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  communicationPreference: 'Email' | 'Phone' | 'Any';
  isPrimary: boolean;
  isActive: boolean;
  notes: string;
}

export interface Staff extends BaseRecord {
  staffCode: string;
  fullName: string;
  role: StaffRole;
  designation: string;
  email: string;
  phone: string;
  weeklyCapacityHours: number;
  joinDate: string;
  isActive: boolean;
  notes: string;
}

export interface EngagementFinancialSummary {
  proposedFee: number;
  approvedFee: number;
  budgetHours: number;
  billingStatus: 'Not Started' | 'Partially Billed' | 'Fully Billed' | 'Collected' | 'On Hold';
  amountBilled: number;
  amountCollected: number;
  outstandingAmount: number;
}

export interface Engagement extends BaseRecord {
  engagementCode: string;
  clientId: string;
  serviceType: string;
  engagementType: string;
  financialPeriodStart: string;
  financialPeriodEnd: string;
  startDate: string;
  targetCompletionDate: string;
  reportingDeadline: string;
  responsiblePartnerId: string;
  responsibleManagerId: string;
  riskRating: RiskRating;
  priority: Priority;
  listedPieWorkflowRequired: boolean;
  scopeSummary: string;
  status: EngagementStatus;
  notes: string;
  duplicateOverrideReason?: string;
  financial: EngagementFinancialSummary;
}

export interface EngagementTeam extends BaseRecord {
  engagementId: string;
  staffId: string;
  assignmentRole: string;
  estimatedHours: number;
  startDate: string;
  endDate: string;
  responsibilityArea?: string;
  responsibilityNotes: string;
  isActive: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  clientId: string;
  engagementId: string;
  taskType: 'Internal' | 'Client' | 'Engagement';
  assigneeId: string;
  reviewerId: string;
  priority: Priority;
  estimatedHours: number;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  blockerReason: string;
  description: string;
  completionDate: string;
}

export interface EngagementDeadline extends BaseRecord {
  clientId: string;
  engagementId: string;
  deadlineType: string;
  description: string;
  dueDate: string;
  ownerId: string;
  priority: Priority;
  status: DeadlineStatus;
  completionDate: string;
  changeReason: string;
}

export interface AcceptanceReview extends BaseRecord {
  engagementId: string;
  reviewType: 'New Client Acceptance' | 'Existing Client Continuance';
  clientBackgroundSummary: string;
  natureOfBusiness: string;
  ownershipManagementSummary: string;
  reasonForAppointment: string;
  previousAuditorDetails: string;
  managementIntegrityAssessment: string;
  engagementRiskRating: RiskRating;
  financialReportingFramework: string;
  regulatoryEnvironment: string;
  competenceResourcesAvailable: string;
  ethicalThreatsIdentified: string;
  safeguardsApplied: string;
  acceptanceRecommendation: string;
  managerReviewerId: string;
  partnerApproverId: string;
  managerReviewDate: string;
  partnerApprovalDate: string;
  rejectionReason: string;
  status: AcceptanceStatus;
  notes: string;
}

export interface IndependenceAssessment extends BaseRecord {
  engagementId: string;
  assessmentDate: string;
  assessedById: string;
  financialInterestThreat: ThreatResponse;
  businessRelationshipThreat: ThreatResponse;
  familyPersonalRelationshipThreat: ThreatResponse;
  employmentRelationshipThreat: ThreatResponse;
  longAssociationThreat: ThreatResponse;
  nonAuditServiceThreat: ThreatResponse;
  feeDependencyThreat: ThreatResponse;
  litigationThreat: ThreatResponse;
  otherThreat: ThreatResponse;
  conflictFound: ThreatResponse;
  threatDescription: string;
  safeguards: string;
  conclusion: string;
  managerReviewed: boolean;
  partnerCleared: boolean;
  status: IndependenceStatus;
  notes: string;
}

export interface EngagementLetter extends BaseRecord {
  engagementId: string;
  letterReference: string;
  letterVersion: number;
  draftDate: string;
  sentToClientDate: string;
  clientAcceptanceDate: string;
  effectiveDate: string;
  expiryDate: string;
  scopeSummary: string;
  responsibilitiesSummary: string;
  reportingFramework: string;
  feeTermsSummary: string;
  signedByFirm: boolean;
  signedByClient: boolean;
  clientSignatory: string;
  fileReference: string;
  status: EngagementLetterStatus;
  notes: string;
}

export interface AuditPlanningMemo extends BaseRecord {
  engagementId: string;
  entityUnderstanding: string;
  businessModelSummary: string;
  industryRegulatoryFactors: string;
  ownershipGovernance: string;
  keyManagement: string;
  financialReportingFramework: string;
  significantAccountingPolicies: string;
  priorYearAuditIssues: string;
  currentYearSignificantChanges: string;
  internalControlEnvironmentSummary: string;
  useOfExperts: string;
  useOfInternalAudit: string;
  componentBranchConsiderations: string;
  goingConcernPreliminaryAssessment: string;
  fraudConsiderations: string;
  relatedPartyConsiderations: string;
  plannedAuditApproach: string;
  keyMilestones: string;
  reportingDeliverables: string;
  managerReviewerId: string;
  partnerApproverId: string;
  managerReviewDate: string;
  partnerApprovalDate: string;
  status: PlanningMemoStatus;
  notes: string;
}

export interface PlanningMilestone extends BaseRecord {
  engagementId: string;
  milestoneType: string;
  description: string;
  dueDate: string;
  ownerId: string;
  priority: Priority;
  status: DeadlineStatus;
  completionDate: string;
  changeReason: string;
}


export interface AuditRisk extends BaseRecord {
  engagementId: string;
  riskCode: string;
  auditArea: string;
  riskTitle: string;
  riskDescription: string;
  riskSource: string;
  riskType: AuditRiskType;
  financialStatementCaption: string;
  assertions: AuditAssertion[];
  likelihood: RiskRating;
  impact: RiskRating;
  inherentRiskRating: RiskRating;
  controlReliancePlanned: boolean;
  residualRiskRating: RiskRating;
  significantRisk: boolean;
  fraudRisk: boolean;
  plannedAuditResponse: string;
  assignedStaffId: string;
  preparedById: string;
  managerReviewerId: string;
  partnerReviewerId: string;
  status: AuditRiskStatus;
  conclusion: string;
  notes: string;
}

export interface AuditMateriality extends BaseRecord {
  engagementId: string;
  version: number;
  benchmark: string;
  benchmarkAmount: number;
  selectedPercentage: number;
  overallMateriality: number;
  performanceMaterialityPercentage: number;
  performanceMateriality: number;
  clearlyTrivialPercentage: number;
  clearlyTrivialThreshold: number;
  specificMaterialityRequired: boolean;
  specificMaterialityDetails: string;
  rationaleForBenchmark: string;
  rationaleForPercentage: string;
  priorYearMateriality: number;
  significantChanges: string;
  preparedById: string;
  managerReviewerId: string;
  partnerApproverId: string;
  managerReviewDate: string;
  partnerApprovalDate: string;
  status: MaterialityStatus;
  notes: string;
}

export interface ProgrammeTemplate extends BaseRecord {
  templateCode: string;
  templateName: string;
  auditArea: string;
  applicableIndustryId: string;
  applicableClientType: string;
  objective: string;
  procedureCode: string;
  procedureDescription: string;
  mandatory: boolean;
  defaultAssigneeRole: StaffRole | '';
  isActive: boolean;
  version: number;
  notes: string;
}

export interface EngagementProgramme extends BaseRecord {
  engagementId: string;
  templateId: string;
  programmeArea: string;
  procedureCode: string;
  objective: string;
  procedureDescription: string;
  linkedRiskIds: string[];
  assertionCoverage: AuditAssertion[];
  mandatory: boolean;
  assigneeId: string;
  reviewerId: string;
  dueDate: string;
  status: ProgrammeProcedureStatus;
  notApplicableReason: string;
  completionComment: string;
  managerReviewComment: string;
  notes: string;
}

export interface WorkingPaper extends BaseRecord {
  engagementId: string;
  wpReference: string;
  auditArea: string;
  title: string;
  objective: string;
  linkedProgrammeProcedureId: string;
  linkedRiskIds: string[];
  assertions: AuditAssertion[];
  procedurePerformed: string;
  populationDescription: string;
  sampleDescription: string;
  evidenceSummary: string;
  result: string;
  exceptions: string;
  conclusion: string;
  preparedById: string;
  preparedDate: string;
  reviewerId: string;
  reviewDate: string;
  status: WorkingPaperStatus;
  crossReferences: string[];
  localPhysicalFileReference: string;
  notes: string;
}

export interface EvidenceRecord extends BaseRecord {
  engagementId: string;
  workingPaperId: string;
  evidenceReference: string;
  description: string;
  evidenceType: string;
  source: string;
  sourceDate: string;
  receivedDate: string;
  reliabilityRating: RiskRating;
  version: number;
  fileName: string;
  localPhysicalFileReference: string;
  acceptedById: string;
  acceptanceDate: string;
  status: EvidenceStatus;
  rejectionReason: string;
  notes: string;
}

export interface SamplingRecord extends BaseRecord {
  engagementId: string;
  workingPaperId: string;
  population: string;
  populationSize: number;
  samplingMethod: string;
  sampleSize: number;
  selectionBasis: string;
  exceptionsFound: number;
  conclusion: string;
  preparedById: string;
  reviewerId: string;
  status: SamplingStatus;
  notes: string;
}

export interface DocumentRequest extends BaseRecord {
  engagementId: string;
  requestReference: string;
  requestTitle: string;
  clientContactId: string;
  sentDate: string;
  overallDueDate: string;
  priority: Priority;
  responsibleStaffId: string;
  status: DocumentRequestStatus;
  waiverReason: string;
  notes: string;
}

export interface DocumentRequestItem extends BaseRecord {
  requestId: string;
  itemCode: string;
  description: string;
  category: string;
  period: string;
  dueDate: string;
  priority: Priority;
  assignedClientContactId: string;
  receivedDate: string;
  fileName: string;
  localPhysicalFileReference: string;
  version: number;
  reviewResult: string;
  rejectionReason: string;
  linkedWorkingPaperId: string;
  status: DocumentRequestStatus;
  waiverReason: string;
  notes: string;
}

export interface DocumentRequestReminder extends BaseRecord {
  requestId: string;
  requestItemId: string;
  reminderDate: string;
  method: 'Manual Note' | 'Phone' | 'Meeting' | 'Other';
  recipient: string;
  note: string;
}


export interface ReviewNote extends BaseRecord {
  reviewNoteReference: string;
  engagementId: string;
  relatedRecordType: string;
  relatedRecordId: string;
  reviewLevel: ReviewLevel;
  severity: ReviewSeverity;
  reviewNote: string;
  raisedById: string;
  raisedDate: string;
  assignedToId: string;
  response: string;
  responseById: string;
  responseDate: string;
  reviewerRecheckComment: string;
  clearedById: string;
  clearedDate: string;
  reopenReason: string;
  cancellationReason: string;
  status: ReviewNoteStatus;
  notes: string;
}

export interface AuditCompletionItem extends BaseRecord {
  engagementId: string;
  checklistCode: string;
  checklistItem: string;
  responsiblePersonId: string;
  required: boolean;
  status: CompletionItemStatus;
  evidenceReference: string;
  completionComment: string;
  completedById: string;
  completionDate: string;
  reviewerId: string;
  reviewDate: string;
  notApplicableReason: string;
  notes: string;
}

export interface AuditFinding extends BaseRecord {
  engagementId: string;
  findingReference: string;
  findingType: AuditFindingType;
  auditArea: string;
  description: string;
  criteria: string;
  condition: string;
  cause: string;
  effect: string;
  recommendation: string;
  managementResponse: string;
  amount: number;
  corrected: boolean;
  uncorrectedAmount: number;
  materialityImpact: RiskRating;
  severity: ReviewSeverity;
  reportable: boolean;
  linkedRiskId: string;
  linkedWorkingPaperId: string;
  partnerReviewed: boolean;
  status: AuditFindingStatus;
  conclusion: string;
  notes: string;
}

export interface AuditReportVersion extends BaseRecord {
  engagementId: string;
  reportType: string;
  versionNumber: number;
  versionDate: string;
  financialStatementVersionReference: string;
  proposedOpinion: AuditOpinion;
  basisSummary: string;
  emphasisOfMatter: string;
  otherMatter: string;
  goingConcernSection: string;
  otherInformationSection: string;
  responsibilitiesSummary: string;
  auditorResponsibilitiesSummary: string;
  managerReviewerId: string;
  partnerApproverId: string;
  managerReviewDate: string;
  partnerApprovalDate: string;
  currentVersion: boolean;
  finalVersion: boolean;
  status: ReportVersionStatus;
  fileReference: string;
  returnReason: string;
  notes: string;
}

export interface ManagementLetter extends BaseRecord {
  engagementId: string;
  reference: string;
  version: number;
  letterDate: string;
  findingIds: string[];
  recipient: string;
  managerReviewerId: string;
  partnerApproverId: string;
  managerReviewDate: string;
  partnerApprovalDate: string;
  clientResponseStatus: string;
  currentVersion: boolean;
  finalVersion: boolean;
  fileReference: string;
  status: ManagementLetterStatus;
  notes: string;
}

export interface RepresentationLetter extends BaseRecord {
  engagementId: string;
  reference: string;
  version: number;
  draftDate: string;
  sentDate: string;
  signedDate: string;
  signatory: string;
  representationPeriod: string;
  currentVersion: boolean;
  mandatory: boolean;
  fileReference: string;
  status: RepresentationLetterStatus;
  notes: string;
}

export interface FinalReportIssue extends BaseRecord {
  engagementId: string;
  finalReportVersionId: string;
  reportDate: string;
  issueDate: string;
  opinionType: AuditOpinion;
  signedByPartnerId: string;
  recipient: string;
  deliveryMethod: string;
  financialStatementVersion: string;
  managementLetterIssued: boolean;
  representationLetterReceived: boolean;
  finalFileReference: string;
  issueReference: string;
  status: ReportIssueStatus;
  notes: string;
}

export interface EngagementFileLock extends BaseRecord {
  engagementId: string;
  lockDate: string;
  lockedById: string;
  lockReason: string;
  finalRecordCounts: Record<string, number>;
  status: 'Locked' | 'Re-Locked';
  notes: string;
}

export interface AmendmentRequest extends BaseRecord {
  engagementId: string;
  amendmentReference: string;
  requestedById: string;
  requestDate: string;
  reason: string;
  affectedRecordType: string;
  affectedRecordId: string;
  proposedChange: string;
  managerRecommendation: string;
  partnerDecision: string;
  approvalDate: string;
  amendmentStatus: AmendmentStatus;
  completionDate: string;
  reLockDate: string;
  status: AmendmentStatus;
  notes: string;
}

export interface ManagerReviewRecord extends BaseRecord {
  engagementId: string;
  managerId: string;
  completionDate: string;
  reopenReason: string;
  returnComment: string;
  readinessPercentage: number;
  blockingItems: string[];
  status: ReviewRecordStatus;
  notes: string;
}

export interface PartnerReviewRecord extends BaseRecord {
  engagementId: string;
  partnerId: string;
  approvalDate: string;
  selectedReportVersionId: string;
  decisionComment: string;
  reopenReason: string;
  readinessPercentage: number;
  blockingItems: string[];
  status: ReviewRecordStatus;
  notes: string;
}


export type ListedChecklistStatus = 'Not Started' | 'In Progress' | 'Evidence Pending' | 'Manager Review' | 'Partner Review' | 'Completed' | 'Exception' | 'Not Applicable';
export type RegulatoryDeadlineStatus = 'Draft' | 'Upcoming' | 'In Progress' | 'Submitted' | 'Completed' | 'Overdue' | 'Waived' | 'Cancelled';
export type AuditCommitteeCommunicationStatus = 'Draft' | 'Internal Review' | 'Ready' | 'Communicated' | 'Follow-up Pending' | 'Closed';
export type QualityReviewStatus = 'Not Required' | 'Planned' | 'In Progress' | 'Findings Raised' | 'Response Pending' | 'Review Complete' | 'Cleared' | 'Rejected';
export type KamStatus = 'Draft' | 'Under Consideration' | 'Manager Review' | 'Partner Review' | 'Quality Review' | 'Approved' | 'Not a KAM' | 'Reported';
export type TaxAssignmentStatus = 'Draft' | 'Documents Pending' | 'Computation in Progress' | 'Manager Review' | 'Client Confirmation' | 'Submission Ready' | 'Submitted' | 'Assessment/Hearing' | 'Completed' | 'Closed' | 'Cancelled';
export type VatAssignmentStatus = 'Draft' | 'Records Pending' | 'Preparation' | 'Reconciliation' | 'Manager Review' | 'Client Approval' | 'Submission Ready' | 'Submitted' | 'Notice/Audit Follow-up' | 'Completed' | 'Closed' | 'Cancelled';
export type RjscAssignmentStatus = 'Draft' | 'Information Pending' | 'Documents Prepared' | 'Internal Review' | 'Client Sign-off' | 'Filing Ready' | 'Filed' | 'Accepted' | 'Rejected' | 'Completed' | 'Closed';
export type AccountingAssignmentStatus = 'Draft' | 'Records Pending' | 'Processing' | 'Reconciliation' | 'Internal Review' | 'Draft Accounts' | 'Client Review' | 'Finalised' | 'Closed' | 'Cancelled';
export type AdvisoryAssignmentStatus = 'Proposal' | 'Client Review' | 'Approved' | 'Planning' | 'Information Gathering' | 'Analysis' | 'Draft Deliverable' | 'Internal Review' | 'Client Presentation' | 'Final Deliverable' | 'Closed' | 'Cancelled';

export interface ListedComplianceItem extends BaseRecord {
  engagementId: string; checklistCode: string; requirement: string; category: string; ownerId: string; dueDate: string; required: boolean;
  evidenceReference: string; completionComment: string; completedById: string; completionDate: string; reviewerId: string; reviewDate: string;
  status: ListedChecklistStatus; exceptionReason: string; notApplicableReason: string; notes: string;
}
export interface RegulatoryDeadline extends BaseRecord {
  clientId: string; engagementId: string; regulatoryBody: string; requirement: string; reportingPeriod: string; dueDate: string;
  responsiblePersonId: string; priority: Priority; status: RegulatoryDeadlineStatus; submissionCompletionDate: string; reference: string; changeReason: string; notes: string;
}
export interface AuditCommitteeCommunication extends BaseRecord {
  engagementId: string; communicationReference: string; communicationStage: 'Planning' | 'Interim' | 'Completion' | 'Special Matter'; communicationDate: string;
  meetingDate: string; recipient: string; subject: string; significantRisksCommunicated: boolean; independenceCommunicated: boolean;
  uncorrectedMisstatementsCommunicated: boolean; controlDeficienciesCommunicated: boolean; keyAuditMattersDiscussed: boolean; goingConcernDiscussed: boolean;
  followUpActions: string; responsiblePersonId: string; status: AuditCommitteeCommunicationStatus; fileReference: string; notes: string;
}
export interface QualityReview extends BaseRecord {
  engagementId: string; qualityReviewerId: string; reviewStartDate: string; reviewCompletionDate: string; significantJudgementsReviewed: boolean;
  significantRisksReviewed: boolean; materialityReviewed: boolean; independenceReviewed: boolean; goingConcernReviewed: boolean; keyAuditMattersReviewed: boolean;
  financialStatementsReviewed: boolean; auditOpinionReviewed: boolean; uncorrectedMisstatementsReviewed: boolean; reviewFindings: string; reviewerConclusion: string;
  managerResponse: string; partnerResponse: string; status: QualityReviewStatus; approvalDate: string; waiverReason: string; notes: string;
}
export interface KeyAuditMatter extends BaseRecord {
  engagementId: string; kamReference: string; title: string; relatedSignificantRiskId: string; whyMatterWasSignificant: string; howMatterWasAddressed: string;
  relatedWorkingPaperIds: string[]; auditCommitteeDiscussionReference: string; proposedReportWording: string; managerReviewerId: string;
  partnerApproverId: string; qualityReviewerId: string; status: KamStatus; decisionReason: string; notes: string;
}
export interface TaxAssignment extends BaseRecord {
  engagementId: string; assessmentYear: string; taxAssignmentType: string; taxpayerTin: string; filingDeadline: string; documentsRequired: string;
  computationVersion: string; taxableIncome: number; taxLiability: number; advanceTax: number; withholdingTax: number; taxPayableRefundable: number;
  clientConfirmationDate: string; managerReviewDate: string; submissionDate: string; submissionReference: string; assessmentHearingDate: string;
  responsibleStaffId: string; managerReviewerId: string; status: TaxAssignmentStatus; notes: string;
}
export interface VatAssignment extends BaseRecord {
  engagementId: string; vatPeriod: string; bin: string; assignmentType: string; filingDeadline: string; outputVat: number; inputVat: number;
  adjustments: number; netVatPayableRefundable: number; reconciliationStatus: string; clientApprovalDate: string; managerReviewDate: string;
  submissionDate: string; submissionReference: string; noticeReference: string; noticeResponseDeadline: string; responsibleStaffId: string;
  managerReviewerId: string; status: VatAssignmentStatus; notes: string;
}
export interface RjscAssignment extends BaseRecord {
  engagementId: string; companyRegistrationNumber: string; filingType: string; filingPeriod: string; filingDeadline: string; documentsRequired: string;
  clientSignOffDate: string; filingDate: string; filingReference: string; acceptanceDate: string; responsibleStaffId: string; reviewerId: string;
  status: RjscAssignmentStatus; notes: string;
}
export interface AccountingAssignment extends BaseRecord {
  engagementId: string; accountingPeriodStart: string; accountingPeriodEnd: string; scope: string; openingBalanceConfirmed: boolean; recordsReceived: boolean;
  processingStatus: string; bankReconciliationStatus: string; unreconciledItems: string; trialBalanceStatus: string; draftAccountsVersion: string;
  clientReviewDate: string; finalAccountsVersion: string; responsibleStaffId: string; reviewerId: string; reviewerApprovalDate: string;
  status: AccountingAssignmentStatus; notes: string;
}
export interface AdvisoryAssignment extends BaseRecord {
  engagementId: string; advisoryType: string; scope: string; exclusions: string; deliverables: string; milestones: string; budgetAmount: number; budgetHours: number;
  responsiblePartnerId: string; responsibleManagerId: string; clientAcceptanceDate: string; draftDeliverableReference: string; internalReviewDate: string;
  clientPresentationDate: string; finalDeliverableReference: string; status: AdvisoryAssignmentStatus; notes: string;
}


export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Returned' | 'Locked';
export type ExpenseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Reimbursed' | 'Cancelled';
export type InvoiceStatus = 'Draft' | 'Review Pending' | 'Approved' | 'Issued' | 'Partially Collected' | 'Paid' | 'Overdue' | 'Adjusted' | 'Written Off' | 'Cancelled';
export type CollectionStatus = 'Draft' | 'Confirmed' | 'Reversed';
export type CommunicationStatus = 'Draft' | 'Final' | 'Amended' | 'Closed';
export type FollowUpStatus = 'Open' | 'In Progress' | 'Waiting' | 'Completed' | 'Cancelled' | 'Overdue';
export type WorkloadCategory = 'Available' | 'Normal' | 'High' | 'Overloaded' | 'Unavailable';

export interface TimesheetEntry extends BaseRecord {
  staffId: string;
  engagementId: string;
  activityCode: string;
  activityType: string;
  workDate: string;
  hours: number;
  description: string;
  billable: boolean;
  reviewerId: string;
  reviewDate: string;
  status: TimesheetStatus;
  returnReason: string;
  notes: string;
}

export interface ExpenseRecord extends BaseRecord {
  engagementId: string;
  expenseDate: string;
  expenseCategory: string;
  amount: number;
  currency: string;
  description: string;
  receiptReference: string;
  claimedById: string;
  reviewerId: string;
  approvalDate: string;
  reimbursementDate: string;
  status: ExpenseStatus;
  rejectionReason: string;
  notes: string;
}

export interface InvoiceRecord extends BaseRecord {
  invoiceNumber: string;
  clientId: string;
  engagementId: string;
  invoiceDate: string;
  dueDate: string;
  serviceType: string;
  billingPeriod: string;
  currency: string;
  grossAmount: number;
  discount: number;
  taxVatAmount: number;
  netAmount: number;
  amountCollected: number;
  outstandingAmount: number;
  billingBasis: string;
  billingStatus: string;
  preparedById: string;
  reviewerId: string;
  approvalDate: string;
  issueDate: string;
  fileReference: string;
  adjustmentReason: string;
  status: InvoiceStatus;
  notes: string;
}

export interface CollectionRecord extends BaseRecord {
  collectionReference: string;
  invoiceId: string;
  clientId: string;
  engagementId: string;
  collectionDate: string;
  amount: number;
  method: string;
  bankCashReference: string;
  recordedById: string;
  status: CollectionStatus;
  reversalReason: string;
  notes: string;
}

export interface CommunicationRecord extends BaseRecord {
  clientId: string;
  engagementId: string;
  communicationDateTime: string;
  communicationType: 'Email' | 'Phone' | 'Meeting' | 'Letter' | 'Messaging' | 'Internal Discussion' | 'Other';
  contactPerson: string;
  subject: string;
  summary: string;
  commitments: string;
  followUpRequired: boolean;
  followUpOwnerId: string;
  followUpDate: string;
  confidentialityLevel: string;
  fileReference: string;
  status: CommunicationStatus;
  amendmentReason: string;
  notes: string;
}

export interface FollowUpRecord extends BaseRecord {
  followUpReference: string;
  sourceType: string;
  sourceId: string;
  clientId: string;
  engagementId: string;
  ownerId: string;
  dueDate: string;
  priority: Priority;
  actionRequired: string;
  completionComment: string;
  completedDate: string;
  status: FollowUpStatus;
  cancellationReason: string;
  notes: string;
}

export interface WorkloadView {
  staffId: string;
  staffName: string;
  role: StaffRole;
  periodStart: string;
  periodEnd: string;
  capacityHours: number;
  assignedHours: number;
  plannedEngagementHours: number;
  openTaskHours: number;
  timesheetActualHours: number;
  leaveUnavailableHours: number;
  remainingCapacity: number;
  utilisationPercentage: number;
  overAllocation: boolean;
  availabilityStatus: WorkloadCategory;
  engagementAllocation: number;
  deadlinePressure: number;
  notes: string;
}

export interface BillingSummary {
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueInvoices: number;
  unbilledEngagements: number;
  collectionThisPeriod: number;
  ageing: Record<string, number>;
  clientOutstanding: Record<string, number>;
  serviceBilling: Record<string, number>;
  engagementOutstanding: Record<string, number>;
}

export type ActivityAction = 'Create' | 'Update' | 'Archive' | 'Restore' | 'Status Change' | 'Assignment Change' | 'Backup Export' | 'Backup Import' | 'Lock Attempt' | 'Duplicate Override' | 'Review Action' | 'Approval' | 'Issue' | 'File Lock' | 'Amendment';

export interface AuditEvent extends BaseRecord {
  entityType: string;
  entityId: string;
  action: ActivityAction;
  previousStatus: string;
  newStatus: string;
  changedFieldSummary: string;
  operatorName: string;
  occurredAt: string;
  reason: string;
}

export interface MasterRecord extends BaseRecord {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface ReferencePrefixSettings {
  reviewNote: string;
  finding: string;
  invoice: string;
  documentRequest: string;
  amendment: string;
  collection: string;
  followUp: string;
  managementLetter: string;
  representationLetter: string;
}

export interface NumberingSettings {
  clientPrefix: string;
  engagementPrefix: string;
  startingSequence: number;
  numberPadding: number;
  referencePrefixes: ReferencePrefixSettings;
}

export interface StatusSetting {
  entity: 'Client' | 'Engagement' | 'Task' | 'Deadline';
  value: string;
  isActive: boolean;
}

export interface AppSettings {
  schemaVersion: string;
  appVersion: string;
  operatorName: string;
  upcomingDeadlineDays: number;
  expenseReceiptThreshold: number;
  numbering: NumberingSettings;
  statusSettings: StatusSetting[];
}

export interface DashboardFilters {
  period: string;
  partnerId: string;
  managerId: string;
  service: string;
  clientType: string;
  engagementStatus: string;
}

export interface DashboardSummary {
  activeClients: number;
  listedPieClients: number;
  activeEngagements: number;
  engagementsAwaitingAction: number;
  openTasks: number;
  overdueTasks: number;
  overdueDeadlines: number;
  upcomingDeadlines: number;
  activeStaff: number;
  auditPendingAcceptance: number;
  independencePending: number;
  lettersPendingAcceptance: number;
  planningAwaitingManagerReview: number;
  planningAwaitingPartnerApproval: number;
  auditReadyForFieldwork: number;
  risksAwaitingResponse: number;
  unresolvedSignificantFraudRisks: number;
  materialityAwaitingApproval: number;
  programmeProceduresOverdue: number;
  workingPapersAwaitingReview: number;
  documentRequestsOverdue: number;
  documentsPendingAcceptance: number;
  workingPapersAwaitingManagerReview: number;
  openManagerReviewNotes: number;
  openPartnerReviewNotes: number;
  criticalHighReviewNotes: number;
  engagementsAwaitingManagerCompletion: number;
  engagementsAwaitingPartnerApproval: number;
  reportsAwaitingManagerReview: number;
  reportsAwaitingPartnerApproval: number;
  reportsReadyToIssue: number;
  issuedReportsAwaitingFileLock: number;
  lockedEngagements: number;
  openAmendments: number;
  listedEngagementsOverdueCompliance: number;
  eqrAwaitingCompletion: number;
  auditCommitteeCommunicationsPending: number;
  kamDecisionsPending: number;
  regulatoryDeadlinesOverdue: number;
  listedReportsBlocked: number;
  taxReturnsDueSoon: number;
  taxSubmissionsOverdue: number;
  taxAssessmentsHearingsPending: number;
  vatReturnsDueSoon: number;
  vatSubmissionsOverdue: number;
  vatNoticesPending: number;
  rjscFilingsDueSoon: number;
  rjscFilingsOverdue: number;
  accountingRecordsPending: number;
  accountingReconciliationsPending: number;
  accountingAwaitingReview: number;
  advisoryDeliverablesDueSoon: number;
  advisoryAwaitingClientAction: number;
  staffCurrentlyOverloaded: number;
  timesheetsAwaitingReview: number;
  expensesAwaitingApproval: number;
  invoicesAwaitingIssue: number;
  overdueInvoices: number;
  collectionsPendingConfirmation: number;
  outstandingFeesByAgeing: number;
  followUpsDueToday: number;
  overdueFollowUps: number;
  clientCommunicationsRequiringAction: number;
  unbilledEngagements: number;
  workloadConflicts: number;
  totalOutstandingFees: number;
  recentEngagements: Engagement[];
  overdueTaskRecords: Task[];
  upcomingDeadlineRecords: EngagementDeadline[];
  engagementStatusSummary: Record<string, number>;
  clientTypeSummary: Record<string, number>;
  recentActivity: AuditEvent[];
}

export interface PlanningReadiness {
  percentage: number;
  completedCriteria: number;
  totalCriteria: number;
  blockingItems: string[];
  acceptanceStatus: AcceptanceStatus | 'Not Started';
  independenceStatus: IndependenceStatus | 'Not Started';
  letterStatus: EngagementLetterStatus | 'Not Started';
  planningMemoStatus: PlanningMemoStatus | 'Not Started';
  materialityStatus: MaterialityStatus | 'Not Started';
  significantFraudRisksReady: boolean;
  teamSize: number;
  plannedHours: number;
  upcomingMilestones: PlanningMilestone[];
  overdueMilestones: PlanningMilestone[];
}

export interface BackupModuleCounts {
  [key: string]: number;
}

export interface AppMeta {
  schemaVersion: string;
  appVersion: string;
  initializedAt: string;
  lastBackupAt: string;
}

export type BackupType = 'full' | 'module';

export interface BackupEnvelope {
  schemaVersion: string;
  appVersion: string;
  backupDate: string;
  backupType: BackupType;
  moduleKey?: string;
  checksum: string;
  integritySummary: string;
  moduleCounts: BackupModuleCounts;
  data: Record<string, unknown[]>;
  settings: AppSettings;
  meta: AppMeta;
}

export interface RestoreConflict {
  module: string;
  recordId: string;
  reason: string;
}

export interface RestorePreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  moduleCounts: BackupModuleCounts;
  conflicts: RestoreConflict[];
  checksumMatches: boolean;
}

export interface RestoreResult {
  successCount: number;
  failureCount: number;
  conflictCount: number;
  failures: string[];
  conflicts: RestoreConflict[];
  rolledBack: boolean;
  rollbackSuccessful: boolean;
  preImportBackupKey: string;
}
