import type { RepositoryRegistry } from '../repositories';
import type { AuditFinding } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type AuditFindingInput=Omit<AuditFinding,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'|'uncorrectedAmount'> & {uncorrectedAmount?:number};
export class AuditFindingService{
 constructor(private readonly repositories:RepositoryRegistry,private readonly activity:ActivityService){}
 async list(engagementId:string){return (await this.repositories.auditFindings.list({includeDeleted:true})).filter(r=>r.engagementId===engagementId);}
 async save(input:AuditFindingInput,operatorName:string,id?:string):Promise<AuditFinding>{
  await requireMutableEngagement(this.repositories.engagements,this.activity,input.engagementId,operatorName,'audit finding mutation'); const errors:string[]=[];
  if(!input.findingReference.trim()||!input.description.trim()) errors.push('Finding Reference and Description are required.');
  if(input.amount<0) errors.push('Finding amount cannot be negative.');
  if(input.linkedRiskId&&!await this.repositories.auditRisks.getById(input.linkedRiskId)) errors.push('Linked Risk was not found.');
  if(input.linkedWorkingPaperId&&!await this.repositories.workingPapers.getById(input.linkedWorkingPaperId)) errors.push('Linked Working Paper was not found.');
  const duplicate=(await this.list(input.engagementId)).find(r=>!r.isDeleted&&r.findingReference.toLowerCase()===input.findingReference.toLowerCase()&&r.id!==id); if(duplicate) errors.push('Finding Reference must be unique within the engagement.');
  const material=['High','Critical'].includes(input.materialityImpact)||input.severity==='Critical'||input.severity==='High';
  if(material&&['Accepted','Corrected','Resolved','Reported','Closed'].includes(input.status)&&!input.partnerReviewed) errors.push('Material findings require Partner review before final disposition.');
  if(errors.length) throw new ValidationError('Audit finding could not be saved.',errors);
  const existing=id?await this.repositories.auditFindings.getById(id):null; if(id&&!existing) throw new AppError('Audit finding not found.','NOT_FOUND');
  const computed={...input,uncorrectedAmount:input.corrected?0:input.amount};
  const record:AuditFinding=existing?updateMetadata({...existing,...computed},operatorName):{...computed,...createMetadata(input.status,operatorName),status:input.status}; const saved=existing?await this.repositories.auditFindings.update(record):await this.repositories.auditFindings.create(record);
  const changes=existing?summarizeChanges(existing,saved):`Finding ${saved.findingReference} created`; if(changes) await this.activity.log({entityType:'Audit Finding',entityId:saved.id,action:existing?'Update':'Create',previousStatus:existing?.status,newStatus:saved.status,changedFieldSummary:changes,operatorName}); return saved;
 }
 async unresolvedMaterial(engagementId:string):Promise<AuditFinding[]>{return (await this.list(engagementId)).filter(f=>!f.isDeleted&&f.uncorrectedAmount>0&&(['High','Critical'].includes(f.materialityImpact)||['Critical','High'].includes(f.severity))&&!['Resolved','Closed','Corrected'].includes(f.status));}
}
