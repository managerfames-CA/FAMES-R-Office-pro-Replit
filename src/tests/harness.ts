import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import { LocalStorageRepository } from '../repositories/localStorage/LocalStorageRepository';
import { STORAGE_KEYS } from '../repositories/localStorage/keys';
import type {
  AcceptanceReview, AuditEvent, AuditMateriality, AuditPlanningMemo, AuditRisk, Client, ClientContact,
  DocumentRequest, DocumentRequestItem, DocumentRequestReminder, Engagement, EngagementDeadline,
  EngagementLetter, EngagementProgramme, EngagementTeam, EvidenceRecord, IndependenceAssessment,
  MasterRecord, PlanningMilestone, ProgrammeTemplate, SamplingRecord, Staff, Task, WorkingPaper, ReviewNote, AuditCompletionItem, AuditFinding, AuditReportVersion, ManagementLetter, RepresentationLetter, FinalReportIssue, EngagementFileLock, AmendmentRequest, ManagerReviewRecord, PartnerReviewRecord, ListedComplianceItem, RegulatoryDeadline, AuditCommitteeCommunication, QualityReview, KeyAuditMatter, TaxAssignment, VatAssignment, RjscAssignment, AccountingAssignment, AdvisoryAssignment, TimesheetEntry, ExpenseRecord, InvoiceRecord, CollectionRecord, CommunicationRecord, FollowUpRecord
} from '../types/models';
import { ActivityService } from '../services/ActivityService';
import { ClientService } from '../services/ClientService';
import { ClientContactService } from '../services/ClientContactService';
import { StaffService } from '../services/StaffService';
import { EngagementService } from '../services/EngagementService';
import { TeamService } from '../services/TeamService';
import { TaskService } from '../services/TaskService';
import { DeadlineService } from '../services/DeadlineService';
import { DashboardService } from '../services/DashboardService';
import { BackupService } from '../services/BackupService';
import { SettingsService } from '../services/SettingsService';
import { MasterDataService } from '../services/MasterDataService';
import { AcceptanceService } from '../services/AcceptanceService';
import { IndependenceService } from '../services/IndependenceService';
import { EngagementLetterService } from '../services/EngagementLetterService';
import { PlanningMemoService } from '../services/PlanningMemoService';
import { PlanningMilestoneService } from '../services/PlanningMilestoneService';
import { PlanningGateService } from '../services/PlanningGateService';
import { AuditRiskService } from '../services/AuditRiskService';
import { MaterialityService } from '../services/MaterialityService';
import { ProgrammeTemplateService } from '../services/ProgrammeTemplateService';
import { AuditProgrammeService } from '../services/AuditProgrammeService';
import { WorkingPaperService } from '../services/WorkingPaperService';
import { EvidenceService } from '../services/EvidenceService';
import { SamplingService } from '../services/SamplingService';
import { DocumentRequestService } from '../services/DocumentRequestService';
import { ReviewNoteService } from '../services/ReviewNoteService';
import { AuditCompletionService } from '../services/AuditCompletionService';
import { AuditFindingService } from '../services/AuditFindingService';
import { AuditReportingService } from '../services/AuditReportingService';
import { AuditReviewWorkflowService } from '../services/AuditReviewWorkflowService';
import { FileLockService } from '../services/FileLockService';
import { AmendmentService } from '../services/AmendmentService';
import { Phase4Service } from '../services/Phase4Service';
import { Phase5Service } from '../services/Phase5Service';
import { Phase6Service } from '../services/Phase6Service';
import {
  emptyAcceptance, emptyAuditRisk, emptyClient, emptyContact, emptyDeadline, emptyDocumentRequest,
  emptyDocumentRequestItem, emptyDocumentRequestReminder, emptyEngagement, emptyEngagementLetter,
  emptyEngagementProgramme, emptyEvidence, emptyIndependence, emptyMateriality, emptyPlanningMemo,
  emptyPlanningMilestone, emptyProgrammeTemplate, emptySampling, emptyStaff, emptyTask, emptyTeam,
  emptyWorkingPaper
} from '../constants/defaults';

export class MemoryStorage implements IStorageGateway {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

export function createHarness(storage: IStorageGateway = new MemoryStorage()) {
  const repositories = {
    clients: new LocalStorageRepository<Client>(STORAGE_KEYS.clients, storage),
    clientContacts: new LocalStorageRepository<ClientContact>(STORAGE_KEYS.clientContacts, storage),
    staff: new LocalStorageRepository<Staff>(STORAGE_KEYS.staff, storage),
    engagements: new LocalStorageRepository<Engagement>(STORAGE_KEYS.engagements, storage),
    engagementTeam: new LocalStorageRepository<EngagementTeam>(STORAGE_KEYS.engagementTeam, storage),
    engagementDeadlines: new LocalStorageRepository<EngagementDeadline>(STORAGE_KEYS.engagementDeadlines, storage),
    tasks: new LocalStorageRepository<Task>(STORAGE_KEYS.tasks, storage),
    services: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.services, storage),
    clientCategories: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.clientCategories, storage),
    industries: new LocalStorageRepository<MasterRecord>(STORAGE_KEYS.industries, storage),
    auditEvents: new LocalStorageRepository<AuditEvent>(STORAGE_KEYS.auditEvents, storage),
    acceptanceReviews: new LocalStorageRepository<AcceptanceReview>(STORAGE_KEYS.acceptanceReviews, storage),
    independenceAssessments: new LocalStorageRepository<IndependenceAssessment>(STORAGE_KEYS.independenceAssessments, storage),
    engagementLetters: new LocalStorageRepository<EngagementLetter>(STORAGE_KEYS.engagementLetters, storage),
    auditPlans: new LocalStorageRepository<AuditPlanningMemo>(STORAGE_KEYS.auditPlans, storage),
    planningMilestones: new LocalStorageRepository<PlanningMilestone>(STORAGE_KEYS.planningMilestones, storage),
    auditRisks: new LocalStorageRepository<AuditRisk>(STORAGE_KEYS.auditRisks, storage),
    auditMateriality: new LocalStorageRepository<AuditMateriality>(STORAGE_KEYS.auditMateriality, storage),
    programmeTemplates: new LocalStorageRepository<ProgrammeTemplate>(STORAGE_KEYS.programmeTemplates, storage),
    engagementProgrammes: new LocalStorageRepository<EngagementProgramme>(STORAGE_KEYS.engagementProgrammes, storage),
    workingPapers: new LocalStorageRepository<WorkingPaper>(STORAGE_KEYS.workingPapers, storage),
    evidenceRegister: new LocalStorageRepository<EvidenceRecord>(STORAGE_KEYS.evidenceRegister, storage),
    samplingRegister: new LocalStorageRepository<SamplingRecord>(STORAGE_KEYS.samplingRegister, storage),
    documentRequests: new LocalStorageRepository<DocumentRequest>(STORAGE_KEYS.documentRequests, storage),
    documentRequestItems: new LocalStorageRepository<DocumentRequestItem>(STORAGE_KEYS.documentRequestItems, storage),
    documentRequestReminders: new LocalStorageRepository<DocumentRequestReminder>(STORAGE_KEYS.documentRequestReminders, storage),
    reviewNotes: new LocalStorageRepository<ReviewNote>(STORAGE_KEYS.reviewNotes, storage),
    auditCompletionItems: new LocalStorageRepository<AuditCompletionItem>(STORAGE_KEYS.auditCompletionItems, storage),
    auditFindings: new LocalStorageRepository<AuditFinding>(STORAGE_KEYS.auditFindings, storage),
    reportVersions: new LocalStorageRepository<AuditReportVersion>(STORAGE_KEYS.reportVersions, storage),
    managementLetters: new LocalStorageRepository<ManagementLetter>(STORAGE_KEYS.managementLetters, storage),
    representationLetters: new LocalStorageRepository<RepresentationLetter>(STORAGE_KEYS.representationLetters, storage),
    reportIssues: new LocalStorageRepository<FinalReportIssue>(STORAGE_KEYS.reportIssues, storage),
    engagementLocks: new LocalStorageRepository<EngagementFileLock>(STORAGE_KEYS.engagementLocks, storage),
    amendmentRequests: new LocalStorageRepository<AmendmentRequest>(STORAGE_KEYS.amendmentRequests, storage),
    managerReviewRecords: new LocalStorageRepository<ManagerReviewRecord>(STORAGE_KEYS.managerReviewRecords, storage),
    partnerReviewRecords: new LocalStorageRepository<PartnerReviewRecord>(STORAGE_KEYS.partnerReviewRecords, storage),
    listedComplianceItems: new LocalStorageRepository<ListedComplianceItem>(STORAGE_KEYS.listedComplianceItems, storage),
    regulatoryDeadlines: new LocalStorageRepository<RegulatoryDeadline>(STORAGE_KEYS.regulatoryDeadlines, storage),
    auditCommitteeCommunications: new LocalStorageRepository<AuditCommitteeCommunication>(STORAGE_KEYS.auditCommitteeCommunications, storage),
    qualityReviews: new LocalStorageRepository<QualityReview>(STORAGE_KEYS.qualityReviews, storage),
    keyAuditMatters: new LocalStorageRepository<KeyAuditMatter>(STORAGE_KEYS.keyAuditMatters, storage),
    taxAssignments: new LocalStorageRepository<TaxAssignment>(STORAGE_KEYS.taxAssignments, storage),
    vatAssignments: new LocalStorageRepository<VatAssignment>(STORAGE_KEYS.vatAssignments, storage),
    rjscAssignments: new LocalStorageRepository<RjscAssignment>(STORAGE_KEYS.rjscAssignments, storage),
    accountingAssignments: new LocalStorageRepository<AccountingAssignment>(STORAGE_KEYS.accountingAssignments, storage),
    advisoryAssignments: new LocalStorageRepository<AdvisoryAssignment>(STORAGE_KEYS.advisoryAssignments, storage),
    timesheets: new LocalStorageRepository<TimesheetEntry>(STORAGE_KEYS.timesheets, storage),
    expenses: new LocalStorageRepository<ExpenseRecord>(STORAGE_KEYS.expenses, storage),
    invoices: new LocalStorageRepository<InvoiceRecord>(STORAGE_KEYS.invoices, storage),
    collections: new LocalStorageRepository<CollectionRecord>(STORAGE_KEYS.collections, storage),
    communications: new LocalStorageRepository<CommunicationRecord>(STORAGE_KEYS.communications, storage),
    followUps: new LocalStorageRepository<FollowUpRecord>(STORAGE_KEYS.followUps, storage)
  };
  const activity = new ActivityService(repositories.auditEvents);
  const settings = new SettingsService(storage);
  const planningGates = new PlanningGateService(repositories, activity);
  const completion = new AuditCompletionService(repositories, activity);
  const findings = new AuditFindingService(repositories, activity);
  const reviewWorkflow = new AuditReviewWorkflowService(repositories, activity, completion, findings);
  const backup = new BackupService(storage, () => settings.get());
  const services = {
    activity,
    settings,
    clients: new ClientService(repositories.clients, activity),
    contacts: new ClientContactService(repositories.clientContacts, repositories.clients, activity),
    staff: new StaffService(repositories.staff, activity),
    engagements: new EngagementService(repositories.engagements, repositories.clients, repositories.staff, activity, planningGates),
    team: new TeamService(repositories.engagementTeam, repositories.engagements, repositories.staff, activity),
    tasks: new TaskService(repositories.tasks, repositories.clients, repositories.engagements, repositories.staff, activity),
    deadlines: new DeadlineService(repositories.engagementDeadlines, repositories.clients, repositories.engagements, repositories.staff, activity),
    acceptance: new AcceptanceService(repositories.acceptanceReviews, repositories.engagements, repositories.staff, activity),
    independence: new IndependenceService(repositories.independenceAssessments, repositories.engagements, repositories.staff, activity),
    engagementLetters: new EngagementLetterService(repositories.engagementLetters, repositories.engagements, activity),
    planningMemos: new PlanningMemoService(repositories.auditPlans, repositories.engagements, repositories.acceptanceReviews, repositories.independenceAssessments, repositories.engagementLetters, repositories.staff, activity),
    planningMilestones: new PlanningMilestoneService(repositories.planningMilestones, repositories.engagements, repositories.staff, activity),
    auditRisks: new AuditRiskService(repositories.auditRisks, repositories.engagements, repositories.acceptanceReviews, repositories.independenceAssessments, repositories.staff, activity),
    materiality: new MaterialityService(repositories.auditMateriality, repositories.engagements, repositories.staff, activity),
    programmeTemplates: new ProgrammeTemplateService(repositories.programmeTemplates, repositories.engagementProgrammes, activity),
    auditProgrammes: new AuditProgrammeService(repositories.engagementProgrammes, repositories.programmeTemplates, repositories.auditRisks, repositories.engagements, repositories.staff, activity),
    workingPapers: new WorkingPaperService(repositories.workingPapers, repositories.engagementProgrammes, repositories.auditRisks, repositories.engagements, repositories.staff, activity),
    evidence: new EvidenceService(repositories.evidenceRegister, repositories.workingPapers, repositories.engagements, repositories.staff, activity),
    sampling: new SamplingService(repositories.samplingRegister, repositories.workingPapers, repositories.engagements, repositories.staff, activity),
    documentRequests: new DocumentRequestService(repositories.documentRequests, repositories.documentRequestItems, repositories.documentRequestReminders, repositories.engagements, repositories.clientContacts, repositories.staff, repositories.workingPapers, activity),
    reviewNotes: new ReviewNoteService(repositories, activity),
    completion,
    findings,
    reporting: new AuditReportingService(repositories, activity),
    reviewWorkflow,
    fileLock: new FileLockService(repositories, activity, reviewWorkflow, completion, findings),
    amendments: new AmendmentService(repositories, activity),
    phase4: new Phase4Service(repositories, activity),
    phase5: new Phase5Service(repositories, activity, () => settings.get()),
    phase6: new Phase6Service(repositories, storage, backup, () => settings.get()),
    planningGates,
    dashboard: new DashboardService(repositories),
    backup,
    industryMaster: new MasterDataService('Industry', repositories.industries, activity, async () => false)
  };
  return { storage, repositories, services };
}

export async function seedActiveClient(h: ReturnType<typeof createHarness>, overrides = {}) {
  return h.services.clients.create({ ...emptyClient, clientCode: 'CL-0001', legalName: 'Example Client', status: 'Active', ...overrides }, 'Tester');
}

export async function seedStaff(h: ReturnType<typeof createHarness>, role: Staff['role'], code: string, active = true) {
  return h.services.staff.save({ ...emptyStaff, staffCode: code, fullName: `${role} Person`, role, isActive: active, status: active ? 'Active' : 'Inactive' }, 'Tester');
}

export async function seedEngagement(h: ReturnType<typeof createHarness>, overrides = {}) {
  const client = await seedActiveClient(h);
  const partner = await seedStaff(h, 'Partner', 'P-001');
  const manager = await seedStaff(h, 'Manager', 'M-001');
  return h.services.engagements.create({ ...emptyEngagement, engagementCode: 'ENG-0001', clientId: client.id, engagementType: 'Statutory Audit', serviceType: 'Audit', responsiblePartnerId: partner.id, responsibleManagerId: manager.id, ...overrides }, 'Tester');
}

export {
  emptyAcceptance, emptyAuditRisk, emptyClient, emptyContact, emptyDeadline, emptyDocumentRequest,
  emptyDocumentRequestItem, emptyDocumentRequestReminder, emptyEngagement, emptyEngagementLetter,
  emptyEngagementProgramme, emptyEvidence, emptyIndependence, emptyMateriality, emptyPlanningMemo,
  emptyPlanningMilestone, emptyProgrammeTemplate, emptySampling, emptyStaff, emptyTask, emptyTeam,
  emptyWorkingPaper
};
