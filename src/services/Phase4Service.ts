import type { RepositoryRegistry } from '../repositories';
import type {
  AccountingAssignment, AdvisoryAssignment, AuditCommitteeCommunication, Engagement, KeyAuditMatter,
  ListedComplianceItem, QualityReview, RegulatoryDeadline, RjscAssignment, Staff, TaxAssignment, VatAssignment
} from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';
import { isPastDue, isUpcoming } from '../utils/dates';

export type ListedComplianceInput = Omit<ListedComplianceItem,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type RegulatoryDeadlineInput = Omit<RegulatoryDeadline,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type CommitteeCommunicationInput = Omit<AuditCommitteeCommunication,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type QualityReviewInput = Omit<QualityReview,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type KeyAuditMatterInput = Omit<KeyAuditMatter,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type TaxAssignmentInput = Omit<TaxAssignment,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type VatAssignmentInput = Omit<VatAssignment,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type RjscAssignmentInput = Omit<RjscAssignment,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type AccountingAssignmentInput = Omit<AccountingAssignment,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type AdvisoryAssignmentInput = Omit<AdvisoryAssignment,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;

const LISTED_DEFAULTS = [
  ['LPIE-01','Listed/PIE classification confirmed','Classification'],['LPIE-02','Team independence declarations completed','Independence'],
  ['LPIE-03','Non-audit service threats reviewed','Independence'],['LPIE-04','Regulatory reporting deadlines confirmed','Regulatory'],
  ['LPIE-05','Audit committee planning communication completed','Audit Committee'],['LPIE-06','Significant risks communicated','Audit Committee'],
  ['LPIE-07','Key Audit Matter consideration completed','Reporting'],['LPIE-08','Going concern assessment completed','Reporting'],
  ['LPIE-09','Related-party review completed','Reporting'],['LPIE-10','Management override and fraud review completed','Risk'],
  ['LPIE-11','Subsequent events completed','Completion'],['LPIE-12','Legal and regulatory compliance completed','Completion'],
  ['LPIE-13','Audit committee completion communication completed','Audit Committee'],['LPIE-14','Engagement Quality Review completed','Quality'],
  ['LPIE-15','Final report checklist completed','Reporting'],['LPIE-16','Partner consultation completed','Quality'],
  ['LPIE-17','Final report approved','Reporting'],['LPIE-18','File lock completed','Finalisation']
] as const;

async function validateStaff(repositories:RepositoryRegistry,id:string,label:string,role?:Staff['role']):Promise<string[]> {
  if(!id) return [`${label} is required.`];
  const member=await repositories.staff.getById(id);
  if(!member||member.isDeleted||!member.isActive) return [`${label} must be active staff.`];
  if(role&&member.role!==role) return [`${label} must have the ${role} role.`];
  return [];
}

export async function getListedGateBlockers(repositories:RepositoryRegistry,engagementId:string):Promise<string[]> {
  const engagement=await repositories.engagements.getById(engagementId);const client=engagement?await repositories.clients.getById(engagement.clientId):null;
  if(!engagement||engagement.serviceType!=='Audit'||(!engagement.listedPieWorkflowRequired&&!client?.isListedPie))return[];
  const blockers:string[]=[];const items=(await repositories.listedComplianceItems.list()).filter(i=>i.engagementId===engagementId&&!i.isDeleted);
  if(!items.length)blockers.push('Listed/PIE Compliance Checklist has not been initialized.');else{for(const i of items.filter(i=>i.required))if(!['Completed','Not Applicable'].includes(i.status))blockers.push(`${i.checklistCode} is not complete.`);if(items.some(i=>i.status==='Exception'))blockers.push('Unresolved Listed compliance exception exists.');}
  const eqr=(await repositories.qualityReviews.list()).find(x=>x.engagementId===engagementId&&!x.isDeleted);if(!eqr||!['Cleared','Not Required'].includes(eqr.status))blockers.push('Engagement Quality Review must be Cleared or formally waived.');
  const comms=(await repositories.auditCommitteeCommunications.list()).filter(x=>x.engagementId===engagementId&&!x.isDeleted);if(!comms.some(x=>x.communicationStage==='Completion'&&['Communicated','Closed'].includes(x.status)))blockers.push('Audit Committee completion communication is required.');
  const kams=(await repositories.keyAuditMatters.list()).filter(x=>x.engagementId===engagementId&&!x.isDeleted);if(kams.some(x=>!['Approved','Not a KAM','Reported'].includes(x.status)))blockers.push('All KAM decisions must be completed.');
  const deadlines=(await repositories.regulatoryDeadlines.list()).filter(x=>x.engagementId===engagementId&&!x.isDeleted);if(deadlines.some(x=>isPastDue(x.dueDate,['Submitted','Completed','Waived','Cancelled'].includes(x.status))&&x.priority==='Critical'))blockers.push('Critical regulatory deadline is overdue.');
  return [...new Set(blockers)];
}

export class Phase4Service {
  constructor(private readonly repositories:RepositoryRegistry,private readonly activity:ActivityService){}
  private async engagement(id:string,operatorName:string,operation:string):Promise<Engagement>{return requireMutableEngagement(this.repositories.engagements,this.activity,id,operatorName,operation);}
  private async listed(id:string,operatorName:string,operation:string):Promise<Engagement>{
    const engagement=await this.engagement(id,operatorName,operation); const client=await this.repositories.clients.getById(engagement.clientId);
    if(engagement.serviceType!=='Audit'||(!engagement.listedPieWorkflowRequired&&!client?.isListedPie)) throw new ValidationError('Listed/PIE workflow is unavailable.',['Only Listed/PIE Audit engagements may use this module.']);
    return engagement;
  }
  private async serviceEngagement(id:string,service:string,operatorName:string,operation:string):Promise<Engagement>{
    const engagement=await this.engagement(id,operatorName,operation); if(engagement.serviceType!==service) throw new ValidationError(`${service} workspace is unavailable.`,[`This engagement is ${engagement.serviceType}, not ${service}.`]); return engagement;
  }
  private async saveRecord<T extends {id:string;status:string;isDeleted:boolean;createdAt:string;updatedAt:string;createdByName:string;updatedByName:string;recordVersion:number}>(repo:{getById(id:string):Promise<T|null>;create(r:T):Promise<T>;update(r:T):Promise<T>},input:Omit<T,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>,operatorName:string,entityType:string,id?:string):Promise<T>{
    const existing=id?await repo.getById(id):null; if(id&&!existing)throw new AppError(`${entityType} was not found.`,'NOT_FOUND');
    if(existing){const candidate={...existing,...input} as T;const summary=summarizeChanges(existing,candidate);if(!summary)return existing;const saved=await repo.update(updateMetadata(candidate,operatorName));await this.activity.log({entityType,entityId:saved.id,action:existing.status===saved.status?'Update':'Status Change',previousStatus:existing.status,newStatus:saved.status,changedFieldSummary:summary,operatorName});return saved;}
    const saved=await repo.create({...createMetadata(input.status,operatorName),...input} as T);await this.activity.log({entityType,entityId:saved.id,action:'Create',newStatus:saved.status,changedFieldSummary:`${entityType} created`,operatorName});return saved;
  }

  async initializeListedChecklist(engagementId:string,operatorName:string):Promise<ListedComplianceItem[]>{
    await this.listed(engagementId,operatorName,'Listed compliance checklist initialization'); const existing=(await this.repositories.listedComplianceItems.list()).filter(i=>i.engagementId===engagementId); if(existing.length)return existing;
    const created:ListedComplianceItem[]=[]; for(const [code,requirement,category] of LISTED_DEFAULTS){created.push(await this.repositories.listedComplianceItems.create({...createMetadata('Not Started',operatorName),engagementId,checklistCode:code,requirement,category,ownerId:'',dueDate:'',required:true,evidenceReference:'',completionComment:'',completedById:'',completionDate:'',reviewerId:'',reviewDate:'',status:'Not Started',exceptionReason:'',notApplicableReason:'',notes:''}));}
    await this.activity.log({entityType:'Listed Compliance',entityId:engagementId,action:'Create',operatorName,changedFieldSummary:'18 default Listed/PIE compliance items created'}); return created;
  }
  async saveListedCompliance(input:ListedComplianceInput,operatorName:string,id?:string){
    await this.listed(input.engagementId,operatorName,'Listed compliance mutation'); const errors:string[]=[];
    if(!input.checklistCode.trim()||!input.requirement.trim())errors.push('Checklist Code and Requirement are required.');
    if(input.status==='Not Applicable'&&!input.notApplicableReason.trim())errors.push('Not Applicable requires a reason.');
    if(input.status==='Exception'&&!input.exceptionReason.trim())errors.push('Exception requires a reason and resolution.');
    if(input.status==='Completed'&&!input.evidenceReference.trim()&&!input.completionComment.trim())errors.push('Completion requires evidence/reference or a completion comment.');
    if(input.reviewerId&&input.completedById&&input.reviewerId===input.completedById)errors.push('Reviewer cannot equal preparer/completer.');
    const all=await this.repositories.listedComplianceItems.list({includeDeleted:true});if(all.some(x=>x.id!==id&&!x.isDeleted&&x.engagementId===input.engagementId&&x.checklistCode.toLowerCase()===input.checklistCode.toLowerCase()))errors.push('Checklist Code must be unique within the engagement.');
    if(errors.length)throw new ValidationError('Listed compliance item could not be saved.',errors);return this.saveRecord(this.repositories.listedComplianceItems,input,operatorName,'Listed Compliance Item',id);
  }
  async saveRegulatoryDeadline(input:RegulatoryDeadlineInput,operatorName:string,id?:string){
    await this.listed(input.engagementId,operatorName,'regulatory deadline mutation'); const errors:string[]=[];if(!input.clientId||!input.regulatoryBody.trim()||!input.requirement.trim()||!input.dueDate)errors.push('Client, Regulatory Body, Requirement and Due Date are required.');
    const existing=id?await this.repositories.regulatoryDeadlines.getById(id):null;if(existing&&existing.priority==='Critical'&&existing.dueDate!==input.dueDate&&!input.changeReason.trim())errors.push('Critical deadline changes require a reason.');
    if(['Submitted','Completed'].includes(input.status)&&!input.submissionCompletionDate)errors.push('Submission/Completion Date is required.');if(input.status==='Waived'&&!input.changeReason.trim())errors.push('Waiver requires a reason.');
    if(errors.length)throw new ValidationError('Regulatory deadline could not be saved.',errors);return this.saveRecord(this.repositories.regulatoryDeadlines,input,operatorName,'Regulatory Deadline',id);
  }
  computedDeadlineStatus(item:RegulatoryDeadline):RegulatoryDeadline['status']{if(['Submitted','Completed','Waived','Cancelled'].includes(item.status))return item.status;return isPastDue(item.dueDate)?'Overdue':item.status==='Draft'?'Draft':'Upcoming';}
  async saveCommitteeCommunication(input:CommitteeCommunicationInput,operatorName:string,id?:string){
    await this.listed(input.engagementId,operatorName,'Audit Committee communication mutation');const errors:string[]=[];if(!input.communicationReference.trim()||!input.subject.trim())errors.push('Communication Reference and Subject are required.');if(input.status==='Communicated'&&(!input.communicationDate||!input.recipient.trim()))errors.push('Communicated status requires Communication Date and Recipient.');const all=await this.repositories.auditCommitteeCommunications.list({includeDeleted:true});if(all.some(x=>x.id!==id&&!x.isDeleted&&x.engagementId===input.engagementId&&x.communicationReference.toLowerCase()===input.communicationReference.toLowerCase()))errors.push('Communication Reference must be unique within the engagement.');if(errors.length)throw new ValidationError('Audit Committee communication could not be saved.',errors);return this.saveRecord(this.repositories.auditCommitteeCommunications,input,operatorName,'Audit Committee Communication',id);
  }
  async saveQualityReview(input:QualityReviewInput,operatorName:string,id?:string){
    const engagement=await this.listed(input.engagementId,operatorName,'Engagement Quality Review mutation');const errors:string[]=[];
    if(input.status==='Not Required'&&!input.waiverReason.trim())errors.push('EQR waiver requires an explicit Partner reason.');
    if(input.status!=='Not Required'){errors.push(...await validateStaff(this.repositories,input.qualityReviewerId,'Quality Reviewer','Quality Reviewer'));if([engagement.responsiblePartnerId,engagement.responsibleManagerId].includes(input.qualityReviewerId))errors.push('Quality Reviewer must not be the engagement Partner or Manager.');}
    const mandatory=[input.significantJudgementsReviewed,input.significantRisksReviewed,input.materialityReviewed,input.independenceReviewed,input.goingConcernReviewed,input.keyAuditMattersReviewed,input.financialStatementsReviewed,input.auditOpinionReviewed,input.uncorrectedMisstatementsReviewed];
    if(['Review Complete','Cleared'].includes(input.status)&&mandatory.some(v=>!v))errors.push('Review Complete requires all mandatory review areas.');if(input.status==='Cleared'&&(!input.reviewerConclusion.trim()||!input.reviewCompletionDate))errors.push('Cleared EQR requires conclusion and completion date.');
    if(errors.length)throw new ValidationError('Engagement Quality Review could not be saved.',errors);return this.saveRecord(this.repositories.qualityReviews,input,operatorName,'Engagement Quality Review',id);
  }
  async saveKam(input:KeyAuditMatterInput,operatorName:string,id?:string){
    await this.listed(input.engagementId,operatorName,'Key Audit Matter mutation');const errors:string[]=[];if(!input.kamReference.trim()||!input.title.trim())errors.push('KAM Reference and Title are required.');if(input.status==='Not a KAM'&&!input.decisionReason.trim())errors.push('Not a KAM requires a reason.');if(['Approved','Reported'].includes(input.status)&&!input.partnerApproverId)errors.push('Approved KAM requires Partner approval.');if(input.relatedSignificantRiskId){const risk=await this.repositories.auditRisks.getById(input.relatedSignificantRiskId);if(!risk||risk.engagementId!==input.engagementId||!(risk.significantRisk||risk.fraudRisk))errors.push('KAM must link to a valid Significant/Fraud Risk.');}const all=await this.repositories.keyAuditMatters.list({includeDeleted:true});if(all.some(x=>x.id!==id&&!x.isDeleted&&x.engagementId===input.engagementId&&x.kamReference.toLowerCase()===input.kamReference.toLowerCase()))errors.push('KAM Reference must be unique within the engagement.');if(errors.length)throw new ValidationError('Key Audit Matter could not be saved.',errors);return this.saveRecord(this.repositories.keyAuditMatters,input,operatorName,'Key Audit Matter',id);
  }
  async listedReadiness(engagementId:string):Promise<{percentage:number;blockingItems:string[]}>{
    const blockers=await getListedGateBlockers(this.repositories,engagementId);const items=(await this.repositories.listedComplianceItems.list()).filter(i=>i.engagementId===engagementId&&!i.isDeleted&&i.required);const total=5+Math.max(items.length,1);return{percentage:Math.max(0,Math.round((total-blockers.length)/total*100)),blockingItems:blockers};
  }

  async saveTax(input:TaxAssignmentInput,operatorName:string,id?:string){await this.serviceEngagement(input.engagementId,'Tax',operatorName,'Tax assignment mutation');const e:string[]=[];if(!input.assessmentYear||!input.filingDeadline)e.push('Assessment Year and Filing Deadline are required.');for(const [v,n] of [[input.taxableIncome,'Taxable Income'],[input.taxLiability,'Tax Liability'],[input.advanceTax,'Advance Tax'],[input.withholdingTax,'Withholding Tax']] as const)if(v<0)e.push(`${n} cannot be negative.`);if(['Submission Ready','Submitted'].includes(input.status)&&!input.clientConfirmationDate)e.push('Client confirmation is required before submission.');if(input.status==='Submitted'&&(!input.submissionDate||!input.submissionReference.trim()))e.push('Submitted status requires date and reference.');if(input.submissionDate&&input.managerReviewDate&&input.submissionDate<input.managerReviewDate)e.push('Submission Date cannot precede Manager Review Date.');if(input.submissionDate&&input.clientConfirmationDate&&input.submissionDate<input.clientConfirmationDate)e.push('Submission Date cannot precede Client Confirmation Date.');if(e.length)throw new ValidationError('Tax assignment could not be saved.',e);return this.saveRecord(this.repositories.taxAssignments,input,operatorName,'Tax Assignment',id);}
  async saveVat(input:VatAssignmentInput,operatorName:string,id?:string){await this.serviceEngagement(input.engagementId,'VAT',operatorName,'VAT assignment mutation');const e:string[]=[];if(!input.vatPeriod||!input.bin.trim()||!input.filingDeadline)e.push('VAT Period, BIN and Filing Deadline are required.');const calculated=input.outputVat-input.inputVat+input.adjustments;if(Math.abs(input.netVatPayableRefundable-calculated)>0.001)e.push('Net VAT must equal Output VAT - Input VAT + Adjustments.');if(input.status==='Submitted'&&(!input.clientApprovalDate||!input.submissionDate||!input.submissionReference.trim()))e.push('Submission requires Client Approval, Submission Date and Reference.');if(e.length)throw new ValidationError('VAT assignment could not be saved.',e);return this.saveRecord(this.repositories.vatAssignments,input,operatorName,'VAT Assignment',id);}
  async saveRjsc(input:RjscAssignmentInput,operatorName:string,id?:string){await this.serviceEngagement(input.engagementId,'RJSC',operatorName,'RJSC assignment mutation');const e:string[]=[];if(!input.companyRegistrationNumber.trim()||!input.filingType.trim()||!input.filingPeriod.trim())e.push('Registration Number, Filing Type and Filing Period are required.');if(['Filing Ready','Filed','Accepted','Completed','Closed'].includes(input.status)&&!input.clientSignOffDate)e.push('Client sign-off is required before filing.');if(['Filed','Accepted','Completed','Closed'].includes(input.status)&&(!input.filingDate||!input.filingReference.trim()))e.push('Filed status requires Filing Date and Reference.');if(input.status==='Accepted'&&!input.acceptanceDate)e.push('Accepted status requires Acceptance Date.');if(e.length)throw new ValidationError('RJSC assignment could not be saved.',e);return this.saveRecord(this.repositories.rjscAssignments,input,operatorName,'RJSC Assignment',id);}
  async saveAccounting(input:AccountingAssignmentInput,operatorName:string,id?:string){await this.serviceEngagement(input.engagementId,'Accounting',operatorName,'Accounting assignment mutation');const e:string[]=[];if(!input.accountingPeriodStart||!input.accountingPeriodEnd)e.push('Accounting period is required.');if(input.accountingPeriodEnd&&input.accountingPeriodStart&&input.accountingPeriodEnd<input.accountingPeriodStart)e.push('Accounting Period End cannot precede Start.');if(input.status==='Finalised'){if(!input.openingBalanceConfirmed)e.push('Opening Balance confirmation is required.');if(input.unreconciledItems.trim())e.push('Unreconciled items must be resolved or explained before finalisation.');if(!input.reviewerId||!input.reviewerApprovalDate)e.push('Reviewer approval is required before Finalised.');if(!input.finalAccountsVersion.trim())e.push('Final Accounts Version is required.');}if(e.length)throw new ValidationError('Accounting assignment could not be saved.',e);return this.saveRecord(this.repositories.accountingAssignments,input,operatorName,'Accounting Assignment',id);}
  async saveAdvisory(input:AdvisoryAssignmentInput,operatorName:string,id?:string){await this.serviceEngagement(input.engagementId,'Advisory',operatorName,'Advisory assignment mutation');const e:string[]=[];if(!input.scope.trim()||!input.deliverables.trim())e.push('Scope and Deliverables are required.');if(input.budgetAmount<0||input.budgetHours<0)e.push('Budget amounts and hours cannot be negative.');if(['Approved','Planning','Information Gathering','Analysis','Draft Deliverable','Internal Review','Client Presentation','Final Deliverable','Closed'].includes(input.status)&&!input.clientAcceptanceDate)e.push('Approved workflow requires Client Acceptance Date.');if(input.status==='Final Deliverable'&&!input.finalDeliverableReference.trim())e.push('Final Deliverable requires a final reference.');e.push(...await validateStaff(this.repositories,input.responsiblePartnerId,'Responsible Partner','Partner'));e.push(...await validateStaff(this.repositories,input.responsibleManagerId,'Responsible Manager','Manager'));const dates=[input.clientAcceptanceDate,input.internalReviewDate,input.clientPresentationDate].filter(Boolean);for(let i=1;i<dates.length;i++)if(dates[i]<dates[i-1])e.push('Advisory dates must follow logical chronology.');if(e.length)throw new ValidationError('Advisory assignment could not be saved.',[...new Set(e)]);return this.saveRecord(this.repositories.advisoryAssignments,input,operatorName,'Advisory Assignment',id);}
  async listForEngagement(engagementId:string){return Promise.all([
    this.repositories.listedComplianceItems.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.regulatoryDeadlines.list().then(x=>x.filter(r=>r.engagementId===engagementId)),
    this.repositories.auditCommitteeCommunications.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.qualityReviews.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.keyAuditMatters.list().then(x=>x.filter(r=>r.engagementId===engagementId)),
    this.repositories.taxAssignments.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.vatAssignments.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.rjscAssignments.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.accountingAssignments.list().then(x=>x.filter(r=>r.engagementId===engagementId)),this.repositories.advisoryAssignments.list().then(x=>x.filter(r=>r.engagementId===engagementId))]);}
  isDueSoon(date:string,days:number){return isUpcoming(date,days);}
}
