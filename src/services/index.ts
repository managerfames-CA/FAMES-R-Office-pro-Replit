import { repositories, gateway } from '../repositories';
import { ActivityService } from './ActivityService';
import { BackupService } from './BackupService';
import { ClientContactService } from './ClientContactService';
import { ClientService } from './ClientService';
import { DashboardService } from './DashboardService';
import { DeadlineService } from './DeadlineService';
import { EngagementService } from './EngagementService';
import { MasterDataService } from './MasterDataService';
import { SettingsService } from './SettingsService';
import { StaffService } from './StaffService';
import { TaskService } from './TaskService';
import { TeamService } from './TeamService';
import { AcceptanceService } from './AcceptanceService';
import { IndependenceService } from './IndependenceService';
import { EngagementLetterService } from './EngagementLetterService';
import { PlanningMemoService } from './PlanningMemoService';
import { PlanningMilestoneService } from './PlanningMilestoneService';
import { PlanningGateService } from './PlanningGateService';
import { AuditRiskService } from './AuditRiskService';
import { MaterialityService } from './MaterialityService';
import { ProgrammeTemplateService } from './ProgrammeTemplateService';
import { AuditProgrammeService } from './AuditProgrammeService';
import { WorkingPaperService } from './WorkingPaperService';
import { EvidenceService } from './EvidenceService';
import { SamplingService } from './SamplingService';
import { DocumentRequestService } from './DocumentRequestService';
import { ReviewNoteService } from './ReviewNoteService';
import { AuditCompletionService } from './AuditCompletionService';
import { AuditFindingService } from './AuditFindingService';
import { AuditReportingService } from './AuditReportingService';
import { AuditReviewWorkflowService } from './AuditReviewWorkflowService';
import { FileLockService } from './FileLockService';
import { AmendmentService } from './AmendmentService';
import { Phase4Service } from './Phase4Service';
import { Phase5Service } from './Phase5Service';
import { Phase6Service } from './Phase6Service';

const activity = new ActivityService(repositories.auditEvents);
const settings = new SettingsService(gateway);
const backup = new BackupService(gateway, () => settings.get());
const planningGates = new PlanningGateService(repositories, activity);
const completion = new AuditCompletionService(repositories, activity);
const findings = new AuditFindingService(repositories, activity);
const reviewWorkflow = new AuditReviewWorkflowService(repositories, activity, completion, findings);

export const services = {
  activity,
  settings,
  clients: new ClientService(repositories.clients, activity),
  clientContacts: new ClientContactService(repositories.clientContacts, repositories.clients, activity),
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
  phase6: new Phase6Service(repositories, gateway, backup, () => settings.get()),
  planningGates,
  dashboard: new DashboardService(repositories),
  backup,
  serviceMaster: new MasterDataService('Service', repositories.services, activity, async id => (await repositories.engagements.list({ includeDeleted: true })).some(item => item.serviceType === id)),
  categoryMaster: new MasterDataService('Client Category', repositories.clientCategories, activity, async id => (await repositories.clients.list({ includeDeleted: true })).some(item => item.clientCategoryId === id)),
  industryMaster: new MasterDataService('Industry', repositories.industries, activity, async id => (await repositories.clients.list({ includeDeleted: true })).some(item => item.industryId === id))
};
