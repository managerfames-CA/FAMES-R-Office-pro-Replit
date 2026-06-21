import type { RepositoryRegistry } from '../repositories';
import type {
  BillingSummary, CollectionRecord, CommunicationRecord, ExpenseRecord, FollowUpRecord, InvoiceRecord,
  Staff, TimesheetEntry, WorkloadView
} from '../types/models';
import type { ActivityService } from './ActivityService';
import { AppError, ValidationError } from '../utils/errors';
import { createMetadata, updateMetadata } from './helpers';
import { summarizeChanges } from '../utils/changeSummary';
import { requireMutableEngagement } from './engagementLock';
import { isPastDue, todayIso } from '../utils/dates';

export type TimesheetInput = Omit<TimesheetEntry,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type ExpenseInput = Omit<ExpenseRecord,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type InvoiceInput = Omit<InvoiceRecord,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type CollectionInput = Omit<CollectionRecord,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type CommunicationInput = Omit<CommunicationRecord,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;
export type FollowUpInput = Omit<FollowUpRecord,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>;

interface Phase5Settings { expenseReceiptThreshold: number; upcomingDeadlineDays: number; }

const TIMESHEET_TRANSITIONS: Record<TimesheetEntry['status'], TimesheetEntry['status'][]> = {
  Draft:['Submitted'], Submitted:['Draft','Approved','Returned'], Approved:['Locked'], Returned:['Submitted'], Locked:[]
};
const EXPENSE_TRANSITIONS: Record<ExpenseRecord['status'], ExpenseRecord['status'][]> = {
  Draft:['Submitted','Cancelled'], Submitted:['Draft','Approved','Rejected','Cancelled'], Approved:['Reimbursed','Cancelled'], Rejected:['Draft','Cancelled'], Reimbursed:[], Cancelled:[]
};
const INVOICE_TRANSITIONS: Record<InvoiceRecord['status'], InvoiceRecord['status'][]> = {
  Draft:['Review Pending','Cancelled'], 'Review Pending':['Draft','Approved','Cancelled'], Approved:['Issued','Adjusted','Written Off','Cancelled'],
  Issued:['Partially Collected','Paid','Adjusted','Written Off'], 'Partially Collected':['Paid','Adjusted','Written Off'], Paid:[], Overdue:['Partially Collected','Paid','Adjusted','Written Off'],
  Adjusted:['Issued','Partially Collected','Paid','Written Off'], 'Written Off':[], Cancelled:[]
};
const COLLECTION_TRANSITIONS: Record<CollectionRecord['status'], CollectionRecord['status'][]> = { Draft:['Confirmed'], Confirmed:['Reversed'], Reversed:[] };
const COMMUNICATION_TRANSITIONS: Record<CommunicationRecord['status'], CommunicationRecord['status'][]> = { Draft:['Final','Closed'], Final:['Amended','Closed'], Amended:['Final','Closed'], Closed:[] };
const FOLLOWUP_TRANSITIONS: Record<Exclude<FollowUpRecord['status'],'Overdue'>, Exclude<FollowUpRecord['status'],'Overdue'>[]> = {
  Open:['In Progress','Waiting','Completed','Cancelled'], 'In Progress':['Open','Waiting','Completed','Cancelled'], Waiting:['Open','In Progress','Completed','Cancelled'], Completed:[], Cancelled:[]
};

function finite(value:number):boolean{return Number.isFinite(value);}
function inRangeDate(value:string,start:string,end:string):boolean{return Boolean(value)&&value>=start&&value<=end;}
function isClientActivity(activityType:string):boolean{return !['Internal','Administration','Training','Leave'].includes(activityType);}
function round(value:number):number{return Math.round((value+Number.EPSILON)*100)/100;}
function periodBounds(period?:string):{start:string;end:string}{
  if(period&&/^\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(period)){const [start,end]=period.split(':');return{start,end};}
  const date=new Date(`${todayIso()}T00:00:00`);const day=(date.getDay()+6)%7;date.setDate(date.getDate()-day);const start=date.toISOString().slice(0,10);date.setDate(date.getDate()+6);return{start,end:date.toISOString().slice(0,10)};
}

export class Phase5Service {
  constructor(private readonly repositories:RepositoryRegistry,private readonly activity:ActivityService,private readonly getSettings:()=>Phase5Settings){}

  private async activeStaff(id:string,label:string):Promise<Staff>{
    const staff=await this.repositories.staff.getById(id);
    if(!staff||staff.isDeleted||!staff.isActive)throw new ValidationError(`${label} is invalid.`,[`${label} must be active staff.`]);
    return staff;
  }
  private async mutableEngagement(id:string,operatorName:string,operation:string){
    return requireMutableEngagement(this.repositories.engagements,this.activity,id,operatorName,operation);
  }
  private async validateTransition<T extends string>(previous:T,next:T,map:Record<T,T[]>,label:string):Promise<void>{
    if(previous!==next&&!map[previous]?.includes(next))throw new ValidationError(`${label} status change is invalid.`,[`Cannot move from ${previous} to ${next}.`]);
  }
  private async saveSimple<T extends {id:string;status:string;isDeleted:boolean;createdAt:string;updatedAt:string;createdByName:string;updatedByName:string;recordVersion:number}>(
    repo:{getById(id:string):Promise<T|null>;create(record:T):Promise<T>;update(record:T):Promise<T>},input:Omit<T,'id'|'createdAt'|'updatedAt'|'createdByName'|'updatedByName'|'recordVersion'|'isDeleted'>,
    operatorName:string,entityType:string,id?:string
  ):Promise<T>{
    const existing=id?await repo.getById(id):null;if(id&&!existing)throw new AppError(`${entityType} was not found.`,'NOT_FOUND');
    if(existing){const candidate={...existing,...input} as T;const summary=summarizeChanges(existing,candidate);if(!summary)return existing;const saved=await repo.update(updateMetadata(candidate,operatorName));await this.activity.log({entityType,entityId:saved.id,action:existing.status===saved.status?'Update':'Status Change',previousStatus:existing.status,newStatus:saved.status,changedFieldSummary:summary,operatorName});return saved;}
    const saved=await repo.create({...createMetadata(input.status,operatorName),...input} as T);await this.activity.log({entityType,entityId:saved.id,action:'Create',newStatus:saved.status,changedFieldSummary:`${entityType} created`,operatorName});return saved;
  }

  async listTimesheets():Promise<TimesheetEntry[]>{return this.repositories.timesheets.list();}
  async saveTimesheet(input:TimesheetInput,operatorName:string,id?:string):Promise<TimesheetEntry>{
    const errors:string[]=[];const existing=id?await this.repositories.timesheets.getById(id):null;
    if(id&&!existing)throw new AppError('Timesheet entry was not found.','NOT_FOUND');
    if(existing&&['Approved','Locked'].includes(existing.status)){const candidate={...existing,...input};if(summarizeChanges(existing,candidate))errors.push('Approved/Locked timesheet entries are read-only. Use the controlled amendment workflow for corrections.');}
    if(existing)await this.validateTransition(existing.status,input.status,TIMESHEET_TRANSITIONS,'Timesheet');
    if(!input.staffId)errors.push('Staff is required.');else await this.activeStaff(input.staffId,'Staff');
    if(!input.workDate)errors.push('Work Date is required.');else if(input.workDate>todayIso())errors.push('Future work dates are not allowed.');
    if(!finite(input.hours)||input.hours<=0)errors.push('Hours must be positive.');
    if(isClientActivity(input.activityType)&&!input.engagementId)errors.push('Engagement is required for client work.');
    if(input.engagementId)await this.mutableEngagement(input.engagementId,operatorName,'Timesheet mutation');
    if(!input.description.trim())errors.push('Description is required.');
    if(input.status==='Approved'){
      if(!input.reviewerId)errors.push('Reviewer is required for approval.');else{await this.activeStaff(input.reviewerId,'Reviewer');if(input.reviewerId===input.staffId)errors.push('Reviewer cannot equal the preparer.');}
      if(!input.reviewDate)errors.push('Review Date is required for approval.');
    }
    if(input.status==='Returned'&&!input.returnReason.trim())errors.push('Returned timesheet requires a reason.');
    const total=(await this.repositories.timesheets.list()).filter(r=>r.staffId===input.staffId&&r.workDate===input.workDate&&r.id!==id&&!r.isDeleted).reduce((s,r)=>s+r.hours,0)+input.hours;
    if(total>24)errors.push(`Daily timesheet hours cannot exceed 24. Current total would be ${round(total)}.`);
    if(errors.length)throw new ValidationError('Timesheet entry could not be saved.',errors);
    return this.saveSimple(this.repositories.timesheets,input,operatorName,'Timesheet',id);
  }

  async listExpenses():Promise<ExpenseRecord[]>{return this.repositories.expenses.list();}
  async saveExpense(input:ExpenseInput,operatorName:string,id?:string):Promise<ExpenseRecord>{
    const errors:string[]=[];const existing=id?await this.repositories.expenses.getById(id):null;if(id&&!existing)throw new AppError('Expense was not found.','NOT_FOUND');
    if(existing)await this.validateTransition(existing.status,input.status,EXPENSE_TRANSITIONS,'Expense');
    if(input.engagementId)await this.mutableEngagement(input.engagementId,operatorName,'Expense mutation');
    if(!input.expenseDate)errors.push('Expense Date is required.');else if(input.expenseDate>todayIso())errors.push('Future expense dates are not allowed.');
    if(!input.expenseCategory.trim())errors.push('Expense Category is required.');
    if(!finite(input.amount)||input.amount<=0)errors.push('Amount must be positive.');
    if(!input.currency.trim())errors.push('Currency is required.');
    if(!input.claimedById)errors.push('Claimed By is required.');else await this.activeStaff(input.claimedById,'Claimed By');
    if(input.amount>this.getSettings().expenseReceiptThreshold&&!input.receiptReference.trim())errors.push(`Receipt Reference is required above ${this.getSettings().expenseReceiptThreshold}.`);
    if(['Approved','Reimbursed'].includes(input.status)){
      if(!input.reviewerId)errors.push('Reviewer is required.');else{await this.activeStaff(input.reviewerId,'Reviewer');if(input.reviewerId===input.claimedById)errors.push('Reviewer cannot equal claimant.');}
      if(!input.approvalDate)errors.push('Approval Date is required.');
    }
    if(input.status==='Rejected'&&!input.rejectionReason.trim())errors.push('Rejected expense requires a reason.');
    if(input.status==='Reimbursed'){
      if(!input.reimbursementDate)errors.push('Reimbursement Date is required.');
      if(input.approvalDate&&input.reimbursementDate<input.approvalDate)errors.push('Reimbursement Date cannot precede Approval Date.');
    }
    if(errors.length)throw new ValidationError('Expense could not be saved.',errors);
    return this.saveSimple(this.repositories.expenses,input,operatorName,'Expense',id);
  }

  async listInvoices():Promise<InvoiceRecord[]>{return this.repositories.invoices.list();}
  async saveInvoice(input:InvoiceInput,operatorName:string,id?:string):Promise<InvoiceRecord>{
    const errors:string[]=[];const existing=id?await this.repositories.invoices.getById(id):null;if(id&&!existing)throw new AppError('Invoice was not found.','NOT_FOUND');
    if(existing)await this.validateTransition(existing.status,input.status,INVOICE_TRANSITIONS,'Invoice');
    if(!input.invoiceNumber.trim())errors.push('Invoice Number is required.');
    const duplicate=(await this.repositories.invoices.list({includeDeleted:true})).find(r=>r.invoiceNumber.trim().toLowerCase()===input.invoiceNumber.trim().toLowerCase()&&r.id!==id);if(duplicate)errors.push('Invoice Number must be unique.');
    const client=await this.repositories.clients.getById(input.clientId);if(!client||client.isDeleted)errors.push('Client is required.');
    if(!input.engagementId)errors.push('Engagement is required.');else{const engagement=await this.mutableEngagement(input.engagementId,operatorName,'Invoice mutation');if(input.clientId&&engagement.clientId!==input.clientId)errors.push('Invoice Client must match the Engagement client.');}
    if(!input.invoiceDate)errors.push('Invoice Date is required.');
    if(!input.dueDate)errors.push('Due Date is required.');else if(input.invoiceDate&&input.dueDate<input.invoiceDate)errors.push('Due Date cannot precede Invoice Date.');
    for(const [label,value] of [['Gross Amount',input.grossAmount],['Discount',input.discount],['Tax/VAT Amount',input.taxVatAmount]] as const)if(!finite(value)||value<0)errors.push(`${label} must be nonnegative.`);
    const net=round(input.grossAmount-input.discount+input.taxVatAmount);if(net<0)errors.push('Net Amount cannot be negative.');
    if(input.status==='Approved'){
      if(!input.reviewerId)errors.push('Reviewer is required for approval.');else{await this.activeStaff(input.reviewerId,'Reviewer');if(input.reviewerId===input.preparedById)errors.push('Reviewer cannot equal preparer.');}
      if(!input.approvalDate)errors.push('Approval Date is required.');
    }
    if(['Issued','Partially Collected','Paid','Overdue'].includes(input.status)){
      if(!input.approvalDate)errors.push('Approved invoice is required before issue.');
      if(!input.issueDate)errors.push('Issue Date is required for issued invoices.');
    }
    if(['Adjusted','Written Off'].includes(input.status)&&!input.adjustmentReason.trim())errors.push(`${input.status} invoice requires a reason.`);
    if(input.preparedById)await this.activeStaff(input.preparedById,'Prepared By');
    if(errors.length)throw new ValidationError('Invoice could not be saved.',errors);
    const collected=existing?.amountCollected??0;
    const normalized={...input,netAmount:net,amountCollected:Math.min(collected,net),outstandingAmount:round(Math.max(0,net-collected))};
    return this.saveSimple(this.repositories.invoices,normalized,operatorName,'Invoice',id);
  }

  async listCollections():Promise<CollectionRecord[]>{return this.repositories.collections.list();}
  async saveCollection(input:CollectionInput,operatorName:string,id?:string):Promise<CollectionRecord>{
    const errors:string[]=[];const existing=id?await this.repositories.collections.getById(id):null;if(id&&!existing)throw new AppError('Collection was not found.','NOT_FOUND');
    if(existing)await this.validateTransition(existing.status,input.status,COLLECTION_TRANSITIONS,'Collection');
    if(!input.collectionReference.trim())errors.push('Collection Reference is required.');
    const duplicate=(await this.repositories.collections.list({includeDeleted:true})).find(r=>r.collectionReference.trim().toLowerCase()===input.collectionReference.trim().toLowerCase()&&r.id!==id);if(duplicate)errors.push('Collection Reference must be unique.');
    const invoice=await this.repositories.invoices.getById(input.invoiceId);if(!invoice||invoice.isDeleted)errors.push('Invoice is required.');
    if(!input.collectionDate)errors.push('Collection Date is required.');else if(input.collectionDate>todayIso())errors.push('Future Collection Date is not allowed.');
    if(!finite(input.amount)||input.amount<=0)errors.push('Collection Amount must be positive.');
    if(input.recordedById)await this.activeStaff(input.recordedById,'Recorded By');
    if(input.status==='Reversed'&&!input.reversalReason.trim())errors.push('Reversal requires a reason.');
    if(invoice){
      if(invoice.clientId!==input.clientId||invoice.engagementId!==input.engagementId)errors.push('Collection client/engagement must match the invoice.');
      const otherConfirmed=(await this.repositories.collections.list()).filter(r=>r.invoiceId===invoice.id&&r.id!==id&&r.status==='Confirmed').reduce((s,r)=>s+r.amount,0);
      if(input.status==='Confirmed'&&otherConfirmed+input.amount>invoice.netAmount+0.0001)errors.push('Confirmed collection cannot exceed invoice outstanding balance.');
    }
    if(errors.length)throw new ValidationError('Collection could not be saved.',errors);
    const originalCollections=await this.repositories.collections.list({includeDeleted:true});const originalInvoices=await this.repositories.invoices.list({includeDeleted:true});
    try{
      const saved=existing?await this.repositories.collections.update(updateMetadata({...existing,...input},operatorName)):await this.repositories.collections.create({...createMetadata(input.status,operatorName),...input});
      if(invoice){
        const all=await this.repositories.collections.list();const confirmed=all.filter(r=>r.invoiceId===invoice.id&&r.status==='Confirmed').reduce((s,r)=>s+r.amount,0);const outstanding=round(Math.max(0,invoice.netAmount-confirmed));
        let status=invoice.status;if(['Issued','Partially Collected','Paid','Overdue'].includes(status)){status=outstanding<=0?'Paid':confirmed>0?'Partially Collected':(isPastDue(invoice.dueDate,false)?'Overdue':'Issued');}
        await this.repositories.invoices.update(updateMetadata({...invoice,amountCollected:round(confirmed),outstandingAmount:outstanding,status},operatorName));
      }
      await this.activity.log({entityType:'Collection',entityId:saved.id,action:existing?(existing.status===saved.status?'Update':'Status Change'):'Create',previousStatus:existing?.status,newStatus:saved.status,changedFieldSummary:existing?summarizeChanges(existing,saved):'Collection created',operatorName});
      return saved;
    }catch(error){await this.repositories.collections.replaceAll(originalCollections);await this.repositories.invoices.replaceAll(originalInvoices);throw error;}
  }

  async listCommunications():Promise<CommunicationRecord[]>{return this.repositories.communications.list();}
  async saveCommunication(input:CommunicationInput,operatorName:string,id?:string):Promise<CommunicationRecord>{
    const errors:string[]=[];const existing=id?await this.repositories.communications.getById(id):null;if(id&&!existing)throw new AppError('Communication was not found.','NOT_FOUND');
    if(existing)await this.validateTransition(existing.status,input.status,COMMUNICATION_TRANSITIONS,'Communication');
    const client=await this.repositories.clients.getById(input.clientId);if(!client||client.isDeleted)errors.push('Client is required.');
    if(input.engagementId){const engagement=await this.mutableEngagement(input.engagementId,operatorName,'Communication mutation');if(engagement.clientId!==input.clientId)errors.push('Communication Client must match the Engagement client.');}
    if(['Final','Amended','Closed'].includes(input.status)){
      if(!input.communicationDateTime)errors.push('Communication Date/Time is required.');
      if(!input.subject.trim())errors.push('Subject is required.');
      if(!input.summary.trim())errors.push('Summary is required.');
    }
    if(existing?.status==='Final'&&input.status==='Final'&&summarizeChanges(existing,{...existing,...input}))errors.push('Final communication cannot be silently overwritten. Change status to Amended and provide an amendment reason.');
    if(input.status==='Amended'&&!input.amendmentReason.trim())errors.push('Amended communication requires a reason.');
    if(input.followUpRequired){if(!input.followUpOwnerId)errors.push('Follow-up Owner is required.');else await this.activeStaff(input.followUpOwnerId,'Follow-up Owner');if(!input.followUpDate)errors.push('Follow-up Date is required.');}
    if(errors.length)throw new ValidationError('Communication could not be saved.',errors);
    const saved=await this.saveSimple(this.repositories.communications,input,operatorName,'Communication',id);
    if(input.followUpRequired&&['Final','Amended'].includes(input.status)){
      const existingFollow=(await this.repositories.followUps.list()).find(r=>r.sourceType==='Communication'&&r.sourceId===saved.id&&!r.isDeleted&&!['Completed','Cancelled'].includes(r.status));
      const follow:FollowUpInput={followUpReference:existingFollow?.followUpReference??`FU-${saved.id.slice(0,8).toUpperCase()}`,sourceType:'Communication',sourceId:saved.id,clientId:saved.clientId,engagementId:saved.engagementId,ownerId:saved.followUpOwnerId,dueDate:saved.followUpDate,priority:'Normal',actionRequired:saved.commitments||`Follow up: ${saved.subject}`,completionComment:'',completedDate:'',status:'Open',cancellationReason:'',notes:''};
      await this.saveFollowUp(follow,operatorName,existingFollow?.id);
    }
    return saved;
  }

  async listFollowUps():Promise<FollowUpRecord[]>{
    return (await this.repositories.followUps.list()).map(r=>!['Completed','Cancelled'].includes(r.status)&&isPastDue(r.dueDate,false)?{...r,status:'Overdue'}:r);
  }
  async saveFollowUp(input:FollowUpInput,operatorName:string,id?:string):Promise<FollowUpRecord>{
    const errors:string[]=[];const existing=id?await this.repositories.followUps.getById(id):null;if(id&&!existing)throw new AppError('Follow-up was not found.','NOT_FOUND');
    if(input.status==='Overdue')errors.push('Overdue is calculated automatically and cannot be selected.');
    if(existing){const from=existing.status==='Overdue'?'Open':existing.status;const to=input.status==='Overdue'?'Open':input.status;await this.validateTransition(from as Exclude<FollowUpRecord['status'],'Overdue'>,to as Exclude<FollowUpRecord['status'],'Overdue'>,FOLLOWUP_TRANSITIONS,'Follow-up');}
    if(!input.followUpReference.trim())errors.push('Follow-up Reference is required.');
    const duplicate=(await this.repositories.followUps.list({includeDeleted:true})).find(r=>r.followUpReference.trim().toLowerCase()===input.followUpReference.trim().toLowerCase()&&r.id!==id);if(duplicate)errors.push('Follow-up Reference must be unique.');
    const client=await this.repositories.clients.getById(input.clientId);if(!client||client.isDeleted)errors.push('Client is required.');
    if(input.engagementId){const engagement=await this.mutableEngagement(input.engagementId,operatorName,'Follow-up mutation');if(engagement.clientId!==input.clientId)errors.push('Follow-up Client must match the Engagement client.');}
    if(!input.ownerId)errors.push('Owner is required.');else await this.activeStaff(input.ownerId,'Owner');
    if(!input.dueDate)errors.push('Due Date is required.');if(!input.actionRequired.trim())errors.push('Action Required is required.');
    if(input.status==='Completed'){if(!input.completionComment.trim())errors.push('Completed follow-up requires a completion comment.');if(!input.completedDate)errors.push('Completed follow-up requires a completion date.');}
    if(input.status==='Cancelled'&&!input.cancellationReason.trim())errors.push('Cancelled follow-up requires a reason.');
    if(errors.length)throw new ValidationError('Follow-up could not be saved.',errors);
    return this.saveSimple(this.repositories.followUps,input,operatorName,'Follow-up',id);
  }

  async getWorkload(period?:string,filters?:{partnerId?:string;managerId?:string;role?:string;service?:string}):Promise<WorkloadView[]>{
    const {start,end}=periodBounds(period);const [staff,team,tasks,timesheets,engagements,deadlines]=await Promise.all([
      this.repositories.staff.list({includeDeleted:true}),this.repositories.engagementTeam.list(),this.repositories.tasks.list(),this.repositories.timesheets.list(),this.repositories.engagements.list({includeDeleted:true}),this.repositories.engagementDeadlines.list()
    ]);
    const engagementMap=new Map(engagements.map(e=>[e.id,e]));
    return staff.filter(s=>s.isActive&&!s.isDeleted).filter(s=>!filters?.role||s.role===filters.role).map(s=>{
      const relatedTeam=team.filter(t=>t.staffId===s.id&&t.isActive&&(!t.startDate||t.startDate<=end)&&(!t.endDate||t.endDate>=start)).filter(t=>{const e=engagementMap.get(t.engagementId);return e&&(!filters?.partnerId||e.responsiblePartnerId===filters.partnerId)&&(!filters?.managerId||e.responsibleManagerId===filters.managerId)&&(!filters?.service||e.serviceType===filters.service);});
      const engagementIds=new Set(relatedTeam.map(t=>t.engagementId));const assigned=round(relatedTeam.reduce((sum,t)=>sum+t.estimatedHours,0));
      const planned=assigned;const openTaskHours=round(tasks.filter(t=>t.assigneeId===s.id&&!['Completed','Cancelled'].includes(t.status)&&(!t.dueDate||t.dueDate>=start)&&(!t.startDate||t.startDate<=end)&&(!filters?.service||engagementMap.get(t.engagementId)?.serviceType===filters.service)).reduce((sum,t)=>sum+t.estimatedHours,0));
      const actual=round(timesheets.filter(t=>t.staffId===s.id&&inRangeDate(t.workDate,start,end)&&!['Returned'].includes(t.status)&&(!filters?.service||engagementMap.get(t.engagementId)?.serviceType===filters.service)).reduce((sum,t)=>sum+t.hours,0));
      const periodDays=Math.max(1,Math.floor((new Date(`${end}T00:00:00`).getTime()-new Date(`${start}T00:00:00`).getTime())/86400000)+1);
      const capacity=round(s.weeklyCapacityHours*(periodDays/7));const committed=Math.max(actual,planned+openTaskHours);const utilisation=capacity>0?round(committed/capacity*100):0;const unavailable=capacity<=0;const category:WorkloadView['availabilityStatus']=unavailable?'Unavailable':utilisation>100?'Overloaded':utilisation>=85?'High':utilisation>=50?'Normal':'Available';
      const deadlinePressure=deadlines.filter(d=>d.ownerId===s.id&&!['Completed','Cancelled'].includes(d.status)&&d.dueDate>=start&&d.dueDate<=end).length;
      return{staffId:s.id,staffName:s.fullName,role:s.role,periodStart:start,periodEnd:end,capacityHours:capacity,assignedHours:assigned,plannedEngagementHours:planned,openTaskHours,timesheetActualHours:actual,leaveUnavailableHours:0,remainingCapacity:round(capacity-committed),utilisationPercentage:utilisation,overAllocation:utilisation>100,availabilityStatus:category,engagementAllocation:engagementIds.size,deadlinePressure,notes:''};
    });
  }

  async getBillingSummary(period?:string):Promise<BillingSummary>{
    const {start,end}=periodBounds(period);const [invoices,collections,engagements,clients]=await Promise.all([this.repositories.invoices.list(),this.repositories.collections.list(),this.repositories.engagements.list(),this.repositories.clients.list({includeDeleted:true})]);
    const issued=invoices.filter(i=>!['Draft','Review Pending','Cancelled'].includes(i.status));const confirmed=collections.filter(c=>c.status==='Confirmed');
    const totalBilled=round(issued.reduce((s,i)=>s+i.netAmount,0));const totalCollected=round(confirmed.reduce((s,c)=>s+c.amount,0));const totalOutstanding=round(issued.reduce((s,i)=>s+i.outstandingAmount,0));
    const ageing:Record<string,number>={'Current':0,'1-30 days':0,'31-60 days':0,'61-90 days':0,'90+ days':0};const now=new Date(`${todayIso()}T00:00:00`).getTime();
    for(const invoice of issued.filter(i=>i.outstandingAmount>0)){const due=new Date(`${invoice.dueDate}T00:00:00`).getTime();const days=Math.floor((now-due)/86400000);const bucket=days<=0?'Current':days<=30?'1-30 days':days<=60?'31-60 days':days<=90?'61-90 days':'90+ days';ageing[bucket]=round(ageing[bucket]+invoice.outstandingAmount);}
    const clientOutstanding:Record<string,number>={};const serviceBilling:Record<string,number>={};const engagementOutstanding:Record<string,number>={};
    for(const i of issued){const client=clients.find(c=>c.id===i.clientId)?.legalName??'Missing client';clientOutstanding[client]=round((clientOutstanding[client]??0)+i.outstandingAmount);serviceBilling[i.serviceType]=round((serviceBilling[i.serviceType]??0)+i.netAmount);const code=engagements.find(e=>e.id===i.engagementId)?.engagementCode??'Missing engagement';engagementOutstanding[code]=round((engagementOutstanding[code]??0)+i.outstandingAmount);}
    const billedEngagementIds=new Set(invoices.filter(i=>!['Cancelled'].includes(i.status)).map(i=>i.engagementId));
    return{totalBilled,totalCollected,totalOutstanding,overdueInvoices:issued.filter(i=>i.outstandingAmount>0&&isPastDue(i.dueDate,false)).length,unbilledEngagements:engagements.filter(e=>!['Cancelled'].includes(e.status)&&!billedEngagementIds.has(e.id)).length,collectionThisPeriod:round(confirmed.filter(c=>inRangeDate(c.collectionDate,start,end)).reduce((s,c)=>s+c.amount,0)),ageing,clientOutstanding,serviceBilling,engagementOutstanding};
  }

  async managementReports(){
    const [engagements,deadlines,reviewNotes,workload,billing]=await Promise.all([this.repositories.engagements.list(),this.repositories.engagementDeadlines.list(),this.repositories.reviewNotes.list(),this.getWorkload(),this.getBillingSummary()]);
    return{engagementStatus:countBy(engagements,e=>e.status),deadlineSummary:countBy(deadlines,d=>isPastDue(d.dueDate,['Completed','Cancelled'].includes(d.status))?'Overdue':d.status),reviewNoteSummary:countBy(reviewNotes,r=>r.status),workloadSummary:countBy(workload,w=>w.availabilityStatus),billing,serviceLine:countBy(engagements,e=>e.serviceType)};
  }
  async partnerReports(partnerId=''){
    const [engagements,clients,notes,reports,issues,billing]=await Promise.all([this.repositories.engagements.list(),this.repositories.clients.list({includeDeleted:true}),this.repositories.reviewNotes.list(),this.repositories.reportVersions.list(),this.repositories.reportIssues.list(),this.getBillingSummary()]);
    const filtered=engagements.filter(e=>!partnerId||e.responsiblePartnerId===partnerId);const ids=new Set(filtered.map(e=>e.id));
    const partnerInvoices=(await this.repositories.invoices.list()).filter(i=>ids.has(i.engagementId)&&!['Cancelled','Written Off'].includes(i.status));
    const outstandingFees:Record<string,number>={};for(const invoice of partnerInvoices){const name=clients.find(c=>c.id===invoice.clientId)?.legalName??'Missing client';outstandingFees[name]=round((outstandingFees[name]??0)+invoice.outstandingAmount);}
    return{awaitingApproval:filtered.filter(e=>['Partner Review','Reporting'].includes(e.status)),listedBlocked:filtered.filter(e=>e.listedPieWorkflowRequired&&e.status!=='Locked'),criticalNotes:notes.filter(n=>ids.has(n.engagementId)&&['Critical','High'].includes(n.severity)&&!['Cleared','Cancelled'].includes(n.status)),reportsAwaitingIssue:reports.filter(r=>ids.has(r.engagementId)&&r.status==='Final Approved'&&!issues.some(i=>i.finalReportVersionId===r.id&&['Issued','Reissued'].includes(i.status))),outstandingFees,portfolio:countBy(filtered,e=>clients.find(c=>c.id===e.clientId)?.legalName??'Missing client')};
  }
  async managerReports(managerId=''){
    const [engagements,notes,programmes,workingPapers,deadlines,followUps,workload]=await Promise.all([this.repositories.engagements.list(),this.repositories.reviewNotes.list(),this.repositories.engagementProgrammes.list(),this.repositories.workingPapers.list(),this.repositories.engagementDeadlines.list(),this.listFollowUps(),this.getWorkload(undefined,{managerId})]);
    const assigned=engagements.filter(e=>!managerId||e.responsibleManagerId===managerId);const ids=new Set(assigned.map(e=>e.id));return{assignedEngagements:assigned,teamWorkload:workload,openReviewNotes:notes.filter(n=>ids.has(n.engagementId)&&!['Cleared','Cancelled'].includes(n.status)),programmeSummary:countBy(programmes.filter(p=>ids.has(p.engagementId)),p=>p.status),workingPaperSummary:countBy(workingPapers.filter(w=>ids.has(w.engagementId)),w=>w.status),upcomingDeadlines:deadlines.filter(d=>ids.has(d.engagementId)&&!['Completed','Cancelled'].includes(d.status)&&!isPastDue(d.dueDate,false)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),collectionFollowUps:followUps.filter(f=>ids.has(f.engagementId)&&!['Completed','Cancelled'].includes(f.status))};
  }
  async clientReport(clientId:string){
    const client=await this.repositories.clients.getById(clientId);if(!client)throw new AppError('Client not found.','NOT_FOUND');const [engagements,invoices,collections,followUps,communications]=await Promise.all([this.repositories.engagements.list(),this.repositories.invoices.list(),this.repositories.collections.list(),this.listFollowUps(),this.repositories.communications.list()]);const es=engagements.filter(e=>e.clientId===clientId);return{client,serviceHistory:countBy(es,e=>e.serviceType),engagements:es,invoices:invoices.filter(i=>i.clientId===clientId),collections:collections.filter(c=>c.clientId===clientId),outstanding:round(invoices.filter(i=>i.clientId===clientId&&!['Cancelled','Written Off'].includes(i.status)).reduce((s,i)=>s+i.outstandingAmount,0)),followUps:followUps.filter(f=>f.clientId===clientId),communications:communications.filter(c=>c.clientId===clientId)};
  }
}

function countBy<T>(records:T[],key:(record:T)=>string):Record<string,number>{const result:Record<string,number>={};for(const record of records){const k=key(record)||'Unspecified';result[k]=(result[k]??0)+1;}return result;}
