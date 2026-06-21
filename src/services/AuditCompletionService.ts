import type { RepositoryRegistry } from '../repositories';
import type { AuditCompletionItem } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type CompletionItemInput=Omit<AuditCompletionItem,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export const DEFAULT_COMPLETION_ITEMS=[
 ['ACP-01','Audit programme completed'],['ACP-02','Working Papers reviewed'],['ACP-03','Significant risks concluded'],['ACP-04','Fraud risks concluded'],['ACP-05','Materiality reassessed'],['ACP-06','Misstatements evaluated'],['ACP-07','Going concern completed'],['ACP-08','Subsequent events completed'],['ACP-09','Related parties completed'],['ACP-10','Laws and regulations completed'],['ACP-11','Litigation and claims considered'],['ACP-12','Management representations obtained'],['ACP-13','Final financial statements referenced'],['ACP-14','Review notes cleared'],['ACP-15','Management Letter considered'],['ACP-16','Audit opinion concluded'],['ACP-17','Final report version selected'],['ACP-18','Partner approval completed']
] as const;
export class AuditCompletionService{
 constructor(private readonly repositories:RepositoryRegistry,private readonly activity:ActivityService){}
 async list(engagementId:string){return (await this.repositories.auditCompletionItems.list({includeDeleted:true})).filter(r=>r.engagementId===engagementId);}
 async initializeDefaults(engagementId:string,operatorName:string):Promise<AuditCompletionItem[]>{
  await requireMutableEngagement(this.repositories.engagements,this.activity,engagementId,operatorName,'completion checklist initialization');
  const existing=await this.list(engagementId); if(existing.some(i=>!i.isDeleted)) throw new ValidationError('Completion checklist already exists.',['Default items can only be created once per engagement.']);
  const records:AuditCompletionItem[]=DEFAULT_COMPLETION_ITEMS.map(([code,item])=>({...createMetadata('Not Started',operatorName),engagementId,checklistCode:code,checklistItem:item,responsiblePersonId:'',required:true,status:'Not Started',evidenceReference:'',completionComment:'',completedById:'',completionDate:'',reviewerId:'',reviewDate:'',notApplicableReason:'',notes:''}));
  await this.repositories.auditCompletionItems.replaceAll([...(await this.repositories.auditCompletionItems.list({includeDeleted:true})),...records]);
  await this.activity.log({entityType:'Audit Completion Checklist',entityId:engagementId,action:'Create',operatorName,changedFieldSummary:`${records.length} default completion items created.`}); return records;
 }
 async save(input:CompletionItemInput,operatorName:string,id?:string):Promise<AuditCompletionItem>{
  await requireMutableEngagement(this.repositories.engagements,this.activity,input.engagementId,operatorName,'completion checklist mutation'); const errors:string[]=[];
  if(!input.checklistCode.trim()||!input.checklistItem.trim()) errors.push('Checklist Code and Checklist Item are required.');
  if(input.status==='Not Applicable'&&!input.notApplicableReason.trim()) errors.push('Not Applicable requires a reason.');
  if(input.status==='Completed'&&!(input.evidenceReference.trim()||input.completionComment.trim())) errors.push('Completed item requires evidence/reference or completion comment.');
  if(['Completed','Reviewed'].includes(input.status)&&(!input.completedById||!input.completionDate)) errors.push('Completed By and Completion Date are required.');
  if(input.status==='Reviewed'&&(!input.reviewerId||!input.reviewDate)) errors.push('Reviewed status requires Reviewer and Review Date.');
  if(input.reviewerId&&input.completedById&&input.reviewerId===input.completedById) errors.push('Reviewer cannot equal preparer/completer.');
  if(input.required&&input.status==='Not Applicable'&&!input.notApplicableReason.trim()) errors.push('Required item cannot be skipped without a reason.');
  const dup=(await this.list(input.engagementId)).find(r=>!r.isDeleted&&r.checklistCode.toLowerCase()===input.checklistCode.toLowerCase()&&r.id!==id); if(dup) errors.push('Checklist Code must be unique within the engagement.');
  if(errors.length) throw new ValidationError('Completion item could not be saved.',errors);
  const existing=id?await this.repositories.auditCompletionItems.getById(id):null; if(id&&!existing) throw new AppError('Completion item not found.','NOT_FOUND');
  const record:AuditCompletionItem=existing?updateMetadata({...existing,...input},operatorName):{...input,...createMetadata(input.status,operatorName),status:input.status}; const saved=existing?await this.repositories.auditCompletionItems.update(record):await this.repositories.auditCompletionItems.create(record);
  const changes=existing?summarizeChanges(existing,saved):`Checklist item ${saved.checklistCode} created`; if(changes) await this.activity.log({entityType:'Audit Completion Item',entityId:saved.id,action:existing?'Update':'Create',previousStatus:existing?.status,newStatus:saved.status,changedFieldSummary:changes,operatorName}); return saved;
 }
 async blockers(engagementId:string,excludeCodes:string[]=[]):Promise<string[]>{const items=(await this.list(engagementId)).filter(i=>!i.isDeleted&&!excludeCodes.includes(i.checklistCode)); const errors:string[]=[]; if(!items.length) errors.push('Audit Completion Checklist has not been created.'); for(const i of items){if(i.status==='Exception') errors.push(`${i.checklistCode}: ${i.checklistItem} has an exception.`); if(i.required&&!['Completed','Reviewed','Not Applicable'].includes(i.status)) errors.push(`${i.checklistCode}: ${i.checklistItem} is incomplete.`);} const byCode=new Map(items.map(i=>[i.checklistCode,i]));
  const requireActual=(code:string,ok:boolean,message:string)=>{const item=byCode.get(code);if(item&&['Completed','Reviewed'].includes(item.status)&&!ok)errors.push(`${code}: ${message}`);};
  const programmes=(await this.repositories.engagementProgrammes.list()).filter(p=>p.engagementId===engagementId&&p.mandatory); requireActual('ACP-01',programmes.length>0&&programmes.every(p=>['Completed','Reviewed'].includes(p.status)),'actual mandatory programme procedures are incomplete.');
  const wps=(await this.repositories.workingPapers.list()).filter(w=>w.engagementId===engagementId); requireActual('ACP-02',wps.length>0&&wps.every(w=>['Manager Cleared','Partner Cleared','Final','Locked'].includes(w.status)),'actual Working Papers are not fully reviewed.');
  const risks=(await this.repositories.auditRisks.list()).filter(r=>r.engagementId===engagementId&&(r.significantRisk||r.fraudRisk)); requireActual('ACP-03',risks.filter(r=>r.significantRisk).every(r=>['Approved','Closed'].includes(r.status)),'actual Significant Risks are unresolved.'); requireActual('ACP-04',risks.filter(r=>r.fraudRisk).every(r=>['Approved','Closed'].includes(r.status)),'actual Fraud Risks are unresolved.');
  requireActual('ACP-05',(await this.repositories.auditMateriality.list()).some(m=>m.engagementId===engagementId&&m.status==='Approved'),'actual approved Materiality is missing.');
  requireActual('ACP-14',!(await this.repositories.reviewNotes.list()).some(n=>n.engagementId===engagementId&&!['Cleared','Cancelled'].includes(n.status)),'actual Review Notes remain open.');
  requireActual('ACP-17',(await this.repositories.reportVersions.list()).some(r=>r.engagementId===engagementId&&r.finalVersion&&['Final Approved','Issued'].includes(r.status)),'actual Final Report Version is not selected/approved.');
  requireActual('ACP-18',(await this.repositories.partnerReviewRecords.list()).some(r=>r.engagementId===engagementId&&['Approved','Completed'].includes(r.status)),'actual Partner Approval is missing.'); return [...new Set(errors)];}
}
