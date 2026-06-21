import type {
  AcceptanceReview, AuditEvent, AuditMateriality, AuditPlanningMemo, AuditRisk, Client, ClientContact, DocumentRequest, DocumentRequestItem, DocumentRequestReminder, Engagement, EngagementDeadline,
  EngagementLetter, EngagementProgramme, EngagementTeam, EvidenceRecord, IndependenceAssessment, MasterRecord, PlanningMilestone, ProgrammeTemplate, SamplingRecord, Staff, Task, WorkingPaper,
  ReviewNote, AuditCompletionItem, AuditFinding, AuditReportVersion, ManagementLetter, RepresentationLetter, FinalReportIssue, EngagementFileLock, AmendmentRequest, ManagerReviewRecord, PartnerReviewRecord,
  ListedComplianceItem, RegulatoryDeadline, AuditCommitteeCommunication, QualityReview, KeyAuditMatter, TaxAssignment, VatAssignment, RjscAssignment, AccountingAssignment, AdvisoryAssignment, TimesheetEntry, ExpenseRecord, InvoiceRecord, CollectionRecord, CommunicationRecord, FollowUpRecord
} from '../types/models';
import { BrowserStorageGateway } from './localStorage/BrowserStorageGateway';
import { LocalStorageRepository } from './localStorage/LocalStorageRepository';
import { STORAGE_KEYS } from './localStorage/keys';

const gateway = new BrowserStorageGateway();

export const repositories = {
  clients: new LocalStorageRepository<Client>(STORAGE_KEYS.clients, gateway),
  clientContacts: new LocalStorageRepository<ClientContact>(STORAGE_KEYS.clientContacts, gateway),
  staff: new LocalStorageRepository<Staff>(STORAGE_KEYS.staff, gateway),
  engagements: new LocalStorageRepository<Engagement>(STORAGE_KEYS.engagements, gateway),
  engagementTeam: new LocalStorageRepository<EngagementTeam>(STORAGE_KEYS.engagementTeam, gateway),
  engagementDeadlines: new LocalStorageRepository<EngagementDeadline>(STORAGE_KEYS.engagementDeadlines, gateway),
  tasks: new LocalStorageRepository<Task>(STORAGE_KEYS.tasks, gateway),
  services: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.services, gateway),
  clientCategories: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.clientCategories, gateway),
  industries: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.industries, gateway),
  auditEvents: new LocalStorageRepository<AuditEvent>(STORAGE_KEYS.auditEvents, gateway),
  acceptanceReviews: new LocalStorageRepository<AcceptanceReview>(STORAGE_KEYS.acceptanceReviews, gateway),
  independenceAssessments: new LocalStorageRepository<IndependenceAssessment>(STORAGE_KEYS.independenceAssessments, gateway),
  engagementLetters: new LocalStorageRepository<EngagementLetter>(STORAGE_KEYS.engagementLetters, gateway),
  auditPlans: new LocalStorageRepository<AuditPlanningMemo>(STORAGE_KEYS.auditPlans, gateway),
  planningMilestones: new LocalStorageRepository<PlanningMilestone>(STORAGE_KEYS.planningMilestones, gateway),
  auditRisks: new LocalStorageRepository<AuditRisk>(STORAGE_KEYS.auditRisks, gateway),
  auditMateriality: new LocalStorageRepository<AuditMateriality>(STORAGE_KEYS.auditMateriality, gateway),
  programmeTemplates: new LocalStorageRepository<ProgrammeTemplate>(STORAGE_KEYS.programmeTemplates, gateway),
  engagementProgrammes: new LocalStorageRepository<EngagementProgramme>(STORAGE_KEYS.engagementProgrammes, gateway),
  workingPapers: new LocalStorageRepository<WorkingPaper>(STORAGE_KEYS.workingPapers, gateway),
  evidenceRegister: new LocalStorageRepository<EvidenceRecord>(STORAGE_KEYS.evidenceRegister, gateway),
  samplingRegister: new LocalStorageRepository<SamplingRecord>(STORAGE_KEYS.samplingRegister, gateway),
  documentRequests: new LocalStorageRepository<DocumentRequest>(STORAGE_KEYS.documentRequests, gateway),
  documentRequestItems: new LocalStorageRepository<DocumentRequestItem>(STORAGE_KEYS.documentRequestItems, gateway),
  documentRequestReminders: new LocalStorageRepository<DocumentRequestReminder>(STORAGE_KEYS.documentRequestReminders, gateway),
  reviewNotes: new LocalStorageRepository<ReviewNote>(STORAGE_KEYS.reviewNotes, gateway),
  auditCompletionItems: new LocalStorageRepository<AuditCompletionItem>(STORAGE_KEYS.auditCompletionItems, gateway),
  auditFindings: new LocalStorageRepository<AuditFinding>(STORAGE_KEYS.auditFindings, gateway),
  reportVersions: new LocalStorageRepository<AuditReportVersion>(STORAGE_KEYS.reportVersions, gateway),
  managementLetters: new LocalStorageRepository<ManagementLetter>(STORAGE_KEYS.managementLetters, gateway),
  representationLetters: new LocalStorageRepository<RepresentationLetter>(STORAGE_KEYS.representationLetters, gateway),
  reportIssues: new LocalStorageRepository<FinalReportIssue>(STORAGE_KEYS.reportIssues, gateway),
  engagementLocks: new LocalStorageRepository<EngagementFileLock>(STORAGE_KEYS.engagementLocks, gateway),
  amendmentRequests: new LocalStorageRepository<AmendmentRequest>(STORAGE_KEYS.amendmentRequests, gateway),
  managerReviewRecords: new LocalStorageRepository<ManagerReviewRecord>(STORAGE_KEYS.managerReviewRecords, gateway),
  partnerReviewRecords: new LocalStorageRepository<PartnerReviewRecord>(STORAGE_KEYS.partnerReviewRecords, gateway),
  listedComplianceItems: new LocalStorageRepository<ListedComplianceItem>(STORAGE_KEYS.listedComplianceItems, gateway),
  regulatoryDeadlines: new LocalStorageRepository<RegulatoryDeadline>(STORAGE_KEYS.regulatoryDeadlines, gateway),
  auditCommitteeCommunications: new LocalStorageRepository<AuditCommitteeCommunication>(STORAGE_KEYS.auditCommitteeCommunications, gateway),
  qualityReviews: new LocalStorageRepository<QualityReview>(STORAGE_KEYS.qualityReviews, gateway),
  keyAuditMatters: new LocalStorageRepository<KeyAuditMatter>(STORAGE_KEYS.keyAuditMatters, gateway),
  taxAssignments: new LocalStorageRepository<TaxAssignment>(STORAGE_KEYS.taxAssignments, gateway),
  vatAssignments: new LocalStorageRepository<VatAssignment>(STORAGE_KEYS.vatAssignments, gateway),
  rjscAssignments: new LocalStorageRepository<RjscAssignment>(STORAGE_KEYS.rjscAssignments, gateway),
  accountingAssignments: new LocalStorageRepository<AccountingAssignment>(STORAGE_KEYS.accountingAssignments, gateway),
  advisoryAssignments: new LocalStorageRepository<AdvisoryAssignment>(STORAGE_KEYS.advisoryAssignments, gateway),
  timesheets: new LocalStorageRepository<TimesheetEntry>(STORAGE_KEYS.timesheets, gateway),
  expenses: new LocalStorageRepository<ExpenseRecord>(STORAGE_KEYS.expenses, gateway),
  invoices: new LocalStorageRepository<InvoiceRecord>(STORAGE_KEYS.invoices, gateway),
  collections: new LocalStorageRepository<CollectionRecord>(STORAGE_KEYS.collections, gateway),
  communications: new LocalStorageRepository<CommunicationRecord>(STORAGE_KEYS.communications, gateway),
  followUps: new LocalStorageRepository<FollowUpRecord>(STORAGE_KEYS.followUps, gateway)
};

export type RepositoryRegistry = typeof repositories;
export { gateway };
