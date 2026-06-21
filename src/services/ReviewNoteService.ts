import type { RepositoryRegistry } from '../repositories';
import type { ReviewNote, ReviewNoteStatus } from '../types/models';
import { ValidationError, AppError } from '../utils/errors';
import { summarizeChanges } from '../utils/changeSummary';
import { createMetadata, updateMetadata } from './helpers';
import { requireMutableEngagement } from './engagementLock';
import type { ActivityService } from './ActivityService';

export type ReviewNoteInput = Omit<ReviewNote, 'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
const transitions: Record<ReviewNoteStatus, ReviewNoteStatus[]> = {
  Open:['Assigned','Cancelled'], Assigned:['Response Submitted','Cancelled'], 'Response Submitted':['Reviewer Recheck','Reopened'],
  'Reviewer Recheck':['Cleared','Reopened'], Cleared:['Reopened'], Reopened:['Assigned','Response Submitted','Cancelled'], Cancelled:[]
};

export class ReviewNoteService {
  constructor(private readonly repositories: RepositoryRegistry, private readonly activity: ActivityService) {}
  async list(engagementId: string): Promise<ReviewNote[]> { return (await this.repositories.reviewNotes.list({includeDeleted:true})).filter(r=>r.engagementId===engagementId); }
  private async validateLink(input: ReviewNoteInput): Promise<void> {
    const map: Record<string, keyof RepositoryRegistry> = {
      'Audit Programme Procedure':'engagementProgrammes','Working Paper':'workingPapers','Evidence':'evidenceRegister','Risk':'auditRisks',
      'Materiality':'auditMateriality','Document Request':'documentRequests','Audit Report Version':'reportVersions','Engagement':'engagements'
    };
    const key=map[input.relatedRecordType];
    if(!key) throw new ValidationError('Review note could not be saved.',['Related Record Type is unsupported.']);
    const record=await (this.repositories[key] as {getById(id:string):Promise<unknown>}).getById(input.relatedRecordId);
    if(!record) throw new ValidationError('Review note could not be saved.',['Related record was not found.']);
    const linked=record as {id?:string;engagementId?:string}; if(input.relatedRecordType==='Engagement'){if(linked.id!==input.engagementId)throw new ValidationError('Review note could not be saved.',['Related Engagement does not match the review-note engagement.']);}else if(linked.engagementId!==input.engagementId)throw new ValidationError('Review note could not be saved.',['Related record belongs to a different engagement.']);
  }
  async save(input: ReviewNoteInput, operatorName: string, id?: string): Promise<ReviewNote> {
    await requireMutableEngagement(this.repositories.engagements,this.activity,input.engagementId,operatorName,'review note mutation');
    const errors:string[]=[];
    if(!input.reviewNoteReference.trim()) errors.push('Review Note Reference is required.');
    if(!input.reviewNote.trim()) errors.push('Review Note is required.');
    if(!input.relatedRecordId) errors.push('A related record is required.');
    if(input.status==='Response Submitted'&&(!input.response.trim()||!input.responseById)) errors.push('Response Submitted requires a response and responder.');
    if(input.status==='Cleared'){
      if(!input.reviewerRecheckComment.trim()) errors.push('Cleared status requires reviewer recheck comment.');
      if(!input.clearedById||!input.clearedDate) errors.push('Cleared By and Cleared Date are required.');
      if(input.clearedById===input.responseById) errors.push('Reviewer cannot clear their own response.');
    }
    if(input.status==='Reopened'&&!input.reopenReason.trim()) errors.push('Reopened status requires a reason.');
    if(input.status==='Cancelled'&&!input.cancellationReason.trim()) errors.push('Cancelled status requires a reason.');
    const duplicate=(await this.repositories.reviewNotes.list({includeDeleted:true})).find(r=>!r.isDeleted&&r.engagementId===input.engagementId&&r.reviewNoteReference.trim().toLowerCase()===input.reviewNoteReference.trim().toLowerCase()&&r.id!==id);
    if(duplicate) errors.push('Review Note Reference must be unique within the engagement.');
    if(errors.length) throw new ValidationError('Review note could not be saved.',errors);
    await this.validateLink(input);
    const existing=id?await this.repositories.reviewNotes.getById(id):null;
    if(id&&!existing) throw new AppError('Review note was not found.','NOT_FOUND');
    if(existing&&existing.status!==input.status&&!transitions[existing.status].includes(input.status)) throw new ValidationError('Unsupported review-note status transition.',[`${existing.status} cannot move directly to ${input.status}.`]);
    const record:ReviewNote=existing?updateMetadata({...existing,...input},operatorName):{...input,...createMetadata(input.status,operatorName),status:input.status};
    const saved=existing?await this.repositories.reviewNotes.update(record):await this.repositories.reviewNotes.create(record);
    await this.activity.log({entityType:'Review Note',entityId:saved.id,action:existing?'Review Action':'Create',previousStatus:existing?.status,newStatus:saved.status,changedFieldSummary:existing?summarizeChanges(existing,saved):`Review note ${saved.reviewNoteReference} created`,operatorName,reason:saved.status==='Reopened'?saved.reopenReason:saved.status==='Cancelled'?saved.cancellationReason:''});
    return saved;
  }
  async archive(id:string,operatorName:string,reason:string):Promise<ReviewNote>{
    const existing=await this.repositories.reviewNotes.getById(id); if(!existing) throw new AppError('Review note not found.','NOT_FOUND');
    if(!reason.trim()) throw new ValidationError('Review note cannot be archived.',['Archive reason is required.']);
    await requireMutableEngagement(this.repositories.engagements,this.activity,existing.engagementId,operatorName,'review note archive');
    const saved=await this.repositories.reviewNotes.archive(id,operatorName);
    await this.activity.log({entityType:'Review Note',entityId:id,action:'Archive',operatorName,reason,changedFieldSummary:'Review note retained as archived history.'}); return saved;
  }
}
