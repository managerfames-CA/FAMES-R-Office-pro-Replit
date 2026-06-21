import type { ClientInput } from '../services/ClientService';
import type { StaffInput } from '../services/StaffService';
import type { EngagementInput } from '../services/EngagementService';
import type { TaskInput } from '../services/TaskService';
import type { DeadlineInput } from '../services/DeadlineService';
import type { ClientContactInput } from '../services/ClientContactService';
import type { TeamInput } from '../services/TeamService';
import type { AcceptanceInput } from '../services/AcceptanceService';
import type { IndependenceInput } from '../services/IndependenceService';
import type { EngagementLetterInput } from '../services/EngagementLetterService';
import type { PlanningMemoInput } from '../services/PlanningMemoService';
import type { PlanningMilestoneInput } from '../services/PlanningMilestoneService';

export const emptyClient: ClientInput = { clientCode: '', legalName: '', tradeName: '', entityType: '', industryId: '', clientCategoryId: '', status: 'Draft', isListedPie: false, tin: '', bin: '', registrationNumber: '', financialYearEnd: '', registeredAddress: '', businessAddress: '', primaryPhone: '', primaryEmail: '', website: '', responsiblePartnerId: '', responsibleManagerId: '', riskRating: 'Medium', notes: '', duplicateOverrideReason: '' };
export const emptyStaff: StaffInput = { staffCode: '', fullName: '', role: 'Assistant', designation: '', email: '', phone: '', weeklyCapacityHours: 40, joinDate: '', isActive: true, status: 'Active', notes: '' };
export const emptyEngagement: EngagementInput = { engagementCode: '', clientId: '', serviceType: 'Audit', engagementType: '', financialPeriodStart: '', financialPeriodEnd: '', startDate: '', targetCompletionDate: '', reportingDeadline: '', responsiblePartnerId: '', responsibleManagerId: '', riskRating: 'Medium', priority: 'Normal', listedPieWorkflowRequired: false, scopeSummary: '', status: 'Draft', notes: '', duplicateOverrideReason: '', financial: { proposedFee: 0, approvedFee: 0, budgetHours: 0, billingStatus: 'Not Started', amountBilled: 0, amountCollected: 0, outstandingAmount: 0 } };
export const emptyTask: TaskInput = { title: '', clientId: '', engagementId: '', taskType: 'Internal', assigneeId: '', reviewerId: '', priority: 'Normal', estimatedHours: 0, startDate: '', dueDate: '', status: 'Backlog', blockerReason: '', description: '', completionDate: '' };
export const emptyDeadline: DeadlineInput = { clientId: '', engagementId: '', deadlineType: '', description: '', dueDate: '', ownerId: '', priority: 'Normal', status: 'Open', completionDate: '', changeReason: '' };
export const emptyContact: ClientContactInput = { clientId: '', name: '', designation: '', department: '', email: '', phone: '', communicationPreference: 'Email', isPrimary: false, isActive: true, status: 'Active', notes: '' };
export const emptyTeam: TeamInput = { engagementId: '', staffId: '', assignmentRole: '', estimatedHours: 1, startDate: '', endDate: '', responsibilityArea: '', responsibilityNotes: '', isActive: true, status: 'Active' };

export const emptyAcceptance: AcceptanceInput = {
  engagementId: '', reviewType: 'New Client Acceptance', clientBackgroundSummary: '', natureOfBusiness: '', ownershipManagementSummary: '', reasonForAppointment: '', previousAuditorDetails: '', managementIntegrityAssessment: '', engagementRiskRating: 'Medium', financialReportingFramework: '', regulatoryEnvironment: '', competenceResourcesAvailable: '', ethicalThreatsIdentified: '', safeguardsApplied: '', acceptanceRecommendation: '', managerReviewerId: '', partnerApproverId: '', managerReviewDate: '', partnerApprovalDate: '', rejectionReason: '', status: 'Draft', notes: ''
};
export const emptyIndependence: IndependenceInput = {
  engagementId: '', assessmentDate: '', assessedById: '', financialInterestThreat: 'No', businessRelationshipThreat: 'No', familyPersonalRelationshipThreat: 'No', employmentRelationshipThreat: 'No', longAssociationThreat: 'No', nonAuditServiceThreat: 'No', feeDependencyThreat: 'No', litigationThreat: 'No', otherThreat: 'No', conflictFound: 'No', threatDescription: '', safeguards: '', conclusion: '', managerReviewed: false, partnerCleared: false, status: 'Draft', notes: ''
};
export const emptyEngagementLetter: EngagementLetterInput = {
  engagementId: '', letterReference: '', letterVersion: 1, draftDate: '', sentToClientDate: '', clientAcceptanceDate: '', effectiveDate: '', expiryDate: '', scopeSummary: '', responsibilitiesSummary: '', reportingFramework: '', feeTermsSummary: '', signedByFirm: false, signedByClient: false, clientSignatory: '', fileReference: '', status: 'Draft', notes: ''
};
export const emptyPlanningMemo: PlanningMemoInput = {
  engagementId: '', entityUnderstanding: '', businessModelSummary: '', industryRegulatoryFactors: '', ownershipGovernance: '', keyManagement: '', financialReportingFramework: '', significantAccountingPolicies: '', priorYearAuditIssues: '', currentYearSignificantChanges: '', internalControlEnvironmentSummary: '', useOfExperts: '', useOfInternalAudit: '', componentBranchConsiderations: '', goingConcernPreliminaryAssessment: '', fraudConsiderations: '', relatedPartyConsiderations: '', plannedAuditApproach: '', keyMilestones: '', reportingDeliverables: '', managerReviewerId: '', partnerApproverId: '', managerReviewDate: '', partnerApprovalDate: '', status: 'Not Started', notes: ''
};
export const emptyPlanningMilestone: PlanningMilestoneInput = { engagementId: '', milestoneType: 'Planning Completion', description: '', dueDate: '', ownerId: '', priority: 'Normal', status: 'Open', completionDate: '', changeReason: '' };

import type { AuditRiskInput } from '../services/AuditRiskService';
import type { MaterialityInput } from '../services/MaterialityService';
import type { ProgrammeTemplateInput } from '../services/ProgrammeTemplateService';
import type { EngagementProgrammeInput } from '../services/AuditProgrammeService';
import type { WorkingPaperInput } from '../services/WorkingPaperService';
import type { EvidenceInput } from '../services/EvidenceService';
import type { SamplingInput } from '../services/SamplingService';
import type { DocumentRequestInput, DocumentRequestItemInput, DocumentRequestReminderInput } from '../services/DocumentRequestService';

export const emptyAuditRisk: AuditRiskInput = { engagementId: '', riskCode: '', auditArea: '', riskTitle: '', riskDescription: '', riskSource: '', riskType: 'Financial Statement Level', financialStatementCaption: '', assertions: [], likelihood: 'Medium', impact: 'Medium', inherentRiskRating: 'Medium', controlReliancePlanned: false, residualRiskRating: 'Medium', significantRisk: false, fraudRisk: false, plannedAuditResponse: '', assignedStaffId: '', preparedById: '', managerReviewerId: '', partnerReviewerId: '', status: 'Draft', conclusion: '', notes: '' };
export const emptyMateriality: MaterialityInput = { engagementId: '', version: 1, benchmark: '', benchmarkAmount: 0, selectedPercentage: 0, overallMateriality: 0, performanceMaterialityPercentage: 75, performanceMateriality: 0, clearlyTrivialPercentage: 5, clearlyTrivialThreshold: 0, specificMaterialityRequired: false, specificMaterialityDetails: '', rationaleForBenchmark: '', rationaleForPercentage: '', priorYearMateriality: 0, significantChanges: '', preparedById: '', managerReviewerId: '', partnerApproverId: '', managerReviewDate: '', partnerApprovalDate: '', status: 'Draft', notes: '' };
export const emptyProgrammeTemplate: ProgrammeTemplateInput = { templateCode: '', templateName: '', auditArea: '', applicableIndustryId: '', applicableClientType: '', objective: '', procedureCode: '', procedureDescription: '', mandatory: false, defaultAssigneeRole: '', isActive: true, version: 1, status: 'Active', notes: '' };
export const emptyEngagementProgramme: EngagementProgrammeInput = { engagementId: '', templateId: '', programmeArea: '', procedureCode: '', objective: '', procedureDescription: '', linkedRiskIds: [], assertionCoverage: [], mandatory: false, assigneeId: '', reviewerId: '', dueDate: '', status: 'Not Started', notApplicableReason: '', completionComment: '', managerReviewComment: '', notes: '' };
export const emptyWorkingPaper: WorkingPaperInput = { engagementId: '', wpReference: '', auditArea: '', title: '', objective: '', linkedProgrammeProcedureId: '', linkedRiskIds: [], assertions: [], procedurePerformed: '', populationDescription: '', sampleDescription: '', evidenceSummary: '', result: '', exceptions: '', conclusion: '', preparedById: '', preparedDate: '', reviewerId: '', reviewDate: '', status: 'Draft', crossReferences: [], localPhysicalFileReference: '', notes: '' };
export const emptyEvidence: EvidenceInput = { engagementId: '', workingPaperId: '', evidenceReference: '', description: '', evidenceType: '', source: '', sourceDate: '', receivedDate: '', reliabilityRating: 'Medium', version: 1, fileName: '', localPhysicalFileReference: '', acceptedById: '', acceptanceDate: '', status: 'Requested', rejectionReason: '', notes: '' };
export const emptySampling: SamplingInput = { engagementId: '', workingPaperId: '', population: '', populationSize: 0, samplingMethod: '', sampleSize: 0, selectionBasis: '', exceptionsFound: 0, conclusion: '', preparedById: '', reviewerId: '', status: 'Draft', notes: '' };
export const emptyDocumentRequest: DocumentRequestInput = { engagementId: '', requestReference: '', requestTitle: '', clientContactId: '', sentDate: '', overallDueDate: '', priority: 'Normal', responsibleStaffId: '', status: 'Draft', waiverReason: '', notes: '' };
export const emptyDocumentRequestItem: DocumentRequestItemInput = { requestId: '', itemCode: '', description: '', category: '', period: '', dueDate: '', priority: 'Normal', assignedClientContactId: '', receivedDate: '', fileName: '', localPhysicalFileReference: '', version: 1, reviewResult: '', rejectionReason: '', linkedWorkingPaperId: '', status: 'Draft', waiverReason: '', notes: '' };
export const emptyDocumentRequestReminder: DocumentRequestReminderInput = { requestId: '', requestItemId: '', reminderDate: '', method: 'Manual Note', recipient: '', note: '', status: 'Recorded' };
