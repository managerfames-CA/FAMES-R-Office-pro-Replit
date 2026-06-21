import type { RepositoryRegistry } from '../repositories';
import type { IStorageGateway } from '../repositories/interfaces/IStorageGateway';
import { ALL_STORAGE_KEYS, STORAGE_KEYS } from '../repositories/localStorage/keys';
import type { AppSettings, BaseRecord, Engagement, InvoiceRecord } from '../types/models';
import { BACKUP_DATA_KEYS, validateMeta, validateModuleRecords, validateSettings } from '../utils/backupValidation';
import { AppError, ValidationError } from '../utils/errors';
import type { BackupService } from './BackupService';

export type SearchResultType =
  | 'Client' | 'Engagement' | 'Staff' | 'Invoice' | 'Task' | 'Working Paper' | 'Risk'
  | 'Review Note' | 'Finding' | 'Audit Report' | 'Document Request'
  | 'Tax Assignment' | 'VAT Assignment' | 'RJSC Assignment' | 'Accounting Assignment' | 'Advisory Assignment';

export interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  status: string;
  route: string;
  archived: boolean;
  score: number;
}

export type IntegritySeverity = 'Error' | 'Warning' | 'Information';
export interface IntegrationIssue {
  code: string;
  severity: IntegritySeverity;
  module: string;
  recordId: string;
  message: string;
  route: string;
}
export interface ModuleHealth {
  module: string;
  storageKey: string;
  recordCount: number;
  state: 'Healthy' | 'Empty' | 'Corrupt';
  errors: string[];
}
export interface IntegrationHealth {
  checkedAt: string;
  totalRecords: number;
  healthyModules: number;
  emptyModules: number;
  corruptModules: number;
  errorCount: number;
  warningCount: number;
  moduleHealth: ModuleHealth[];
  issues: IntegrationIssue[];
}

export type ReferenceKind = keyof AppSettings['numbering']['referencePrefixes'];

const normalize = (value: unknown): string => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
const includesAll = (haystack: string, tokens: string[]): boolean => tokens.every(token => haystack.includes(token));
const scoreText = (query: string, title: string, searchable: string): number => {
  const normalizedTitle = normalize(title);
  if (normalizedTitle === query) return 100;
  if (normalizedTitle.startsWith(query)) return 80;
  if (normalizedTitle.includes(query)) return 60;
  return searchable.includes(query) ? 30 : 0;
};
const active = (record: BaseRecord): boolean => !record.isDeleted;
const issueRoute = (module: string, record: Record<string, unknown>): string => {
  const engagementId = String(record.engagementId ?? '');
  if (module === 'Clients') return `/clients/${record.id}`;
  if (module === 'Engagements') return `/engagements/${record.id}`;
  if (module === 'Tasks') return `/tasks/${record.id}`;
  if (module === 'Invoices' || module === 'Collections') return '/billing';
  if (module === 'Communications' || module === 'Follow-ups') return '/communications';
  if (module === 'Staff') return '/staff';
  if (module === 'Working Papers') return `/engagements/${engagementId}/audit-planning/working-papers`;
  if (module === 'Risks') return `/engagements/${engagementId}/audit-planning/risks`;
  if (module === 'Review Notes') return `/engagements/${engagementId}/audit-planning/review-notes`;
  if (module === 'Findings') return `/engagements/${engagementId}/audit-planning/findings`;
  if (module === 'Report Versions') return `/engagements/${engagementId}/audit-planning/audit-reports`;
  if (module === 'Document Requests') return `/engagements/${engagementId}/audit-planning/document-requests`;
  if (['Tax Assignments','VAT Assignments','RJSC Assignments','Accounting Assignments','Advisory Assignments'].includes(module)) return `/engagements/${engagementId}/phase4/assignment`;
  return '/administration/data-integrity';
};

export class Phase6Service {
  constructor(
    private readonly repositories: RepositoryRegistry,
    private readonly storage: IStorageGateway,
    private readonly backup: BackupService,
    private readonly getSettings: () => AppSettings
  ) {}

  async search(query: string, limit = 30): Promise<GlobalSearchResult[]> {
    const q = normalize(query);
    if (q.length < 2) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const [clients, engagements, staff, invoices, tasks, workingPapers, risks, reviewNotes, findings, reports, requests, tax, vat, rjsc, accounting, advisory] = await Promise.all([
      this.repositories.clients.list({ includeDeleted: true }), this.repositories.engagements.list({ includeDeleted: true }), this.repositories.staff.list({ includeDeleted: true }),
      this.repositories.invoices.list({ includeDeleted: true }), this.repositories.tasks.list({ includeDeleted: true }), this.repositories.workingPapers.list({ includeDeleted: true }),
      this.repositories.auditRisks.list({ includeDeleted: true }), this.repositories.reviewNotes.list({ includeDeleted: true }), this.repositories.auditFindings.list({ includeDeleted: true }),
      this.repositories.reportVersions.list({ includeDeleted: true }), this.repositories.documentRequests.list({ includeDeleted: true }), this.repositories.taxAssignments.list({ includeDeleted: true }),
      this.repositories.vatAssignments.list({ includeDeleted: true }), this.repositories.rjscAssignments.list({ includeDeleted: true }), this.repositories.accountingAssignments.list({ includeDeleted: true }),
      this.repositories.advisoryAssignments.list({ includeDeleted: true })
    ]);
    const engagementById = new Map(engagements.map(item => [item.id, item]));
    const clientById = new Map(clients.map(item => [item.id, item]));
    const results: GlobalSearchResult[] = [];
    const add = (result: Omit<GlobalSearchResult, 'score'>, values: unknown[]) => {
      const searchable = normalize(values.join(' '));
      if (!includesAll(searchable, tokens)) return;
      results.push({ ...result, score: scoreText(q, result.title, searchable) });
    };
    for (const item of clients) add({ id:item.id,type:'Client',title:`${item.clientCode} · ${item.legalName}`,subtitle:[item.tradeName,item.tin,item.bin].filter(Boolean).join(' · ')||'Client master',status:item.status,route:`/clients/${item.id}`,archived:!active(item) },[item.clientCode,item.legalName,item.tradeName,item.tin,item.bin,item.registrationNumber]);
    for (const item of engagements) add({ id:item.id,type:'Engagement',title:`${item.engagementCode} · ${clientById.get(item.clientId)?.legalName??'Missing client'}`,subtitle:`${item.serviceType} · ${item.engagementType}`,status:item.status,route:`/engagements/${item.id}`,archived:!active(item) },[item.engagementCode,item.engagementType,item.serviceType,clientById.get(item.clientId)?.legalName]);
    for (const item of staff) add({ id:item.id,type:'Staff',title:`${item.staffCode} · ${item.fullName}`,subtitle:`${item.role} · ${item.designation}`,status:item.isActive?'Active':'Inactive',route:'/staff',archived:!active(item) },[item.staffCode,item.fullName,item.role,item.designation,item.email]);
    for (const item of invoices) add({ id:item.id,type:'Invoice',title:item.invoiceNumber,subtitle:`${clientById.get(item.clientId)?.legalName??'Missing client'} · ${item.netAmount.toLocaleString()} ${item.currency}`,status:item.status,route:`/billing?invoice=${item.id}`,archived:!active(item) },[item.invoiceNumber,item.billingPeriod,item.serviceType,clientById.get(item.clientId)?.legalName,engagementById.get(item.engagementId)?.engagementCode]);
    for (const item of tasks) add({ id:item.id,type:'Task',title:item.title,subtitle:`${engagementById.get(item.engagementId)?.engagementCode??clientById.get(item.clientId)?.clientCode??'Internal'} · Due ${item.dueDate||'not set'}`,status:item.status,route:`/tasks/${item.id}`,archived:!active(item) },[item.title,item.description,item.status,engagementById.get(item.engagementId)?.engagementCode,clientById.get(item.clientId)?.legalName]);
    for (const item of workingPapers) add({ id:item.id,type:'Working Paper',title:`${item.wpReference} · ${item.title}`,subtitle:`${engagementById.get(item.engagementId)?.engagementCode??'Missing engagement'} · ${item.auditArea}`,status:item.status,route:`/engagements/${item.engagementId}/audit-planning/working-papers`,archived:!active(item) },[item.wpReference,item.title,item.auditArea,item.objective,item.localPhysicalFileReference]);
    for (const item of risks) add({ id:item.id,type:'Risk',title:`${item.riskCode} · ${item.riskTitle}`,subtitle:`${engagementById.get(item.engagementId)?.engagementCode??'Missing engagement'} · ${item.auditArea}`,status:item.status,route:`/engagements/${item.engagementId}/audit-planning/risks`,archived:!active(item) },[item.riskCode,item.riskTitle,item.riskDescription,item.auditArea,item.financialStatementCaption]);
    for (const item of reviewNotes) add({ id:item.id,type:'Review Note',title:`${item.reviewNoteReference} · ${item.reviewLevel}`,subtitle:item.reviewNote,status:item.status,route:`/engagements/${item.engagementId}/audit-planning/review-notes`,archived:!active(item) },[item.reviewNoteReference,item.reviewNote,item.reviewLevel,item.severity]);
    for (const item of findings) add({ id:item.id,type:'Finding',title:`${item.findingReference} · ${item.findingType}`,subtitle:item.description,status:item.status,route:`/engagements/${item.engagementId}/audit-planning/findings`,archived:!active(item) },[item.findingReference,item.findingType,item.description,item.auditArea,item.recommendation]);
    for (const item of reports) add({ id:item.id,type:'Audit Report',title:`${item.reportType} · v${item.versionNumber}`,subtitle:`${engagementById.get(item.engagementId)?.engagementCode??'Missing engagement'} · ${item.proposedOpinion}`,status:item.status,route:`/engagements/${item.engagementId}/audit-planning/audit-reports`,archived:!active(item) },[item.reportType,item.versionNumber,item.financialStatementVersionReference,item.proposedOpinion,item.fileReference]);
    for (const item of requests) add({ id:item.id,type:'Document Request',title:`${item.requestReference} · ${item.requestTitle}`,subtitle:engagementById.get(item.engagementId)?.engagementCode??'Missing engagement',status:item.status,route:`/engagements/${item.engagementId}/audit-planning/document-requests`,archived:!active(item) },[item.requestReference,item.requestTitle,item.notes]);
    const assignments: Array<[SearchResultType, typeof tax[number] | typeof vat[number] | typeof rjsc[number] | typeof accounting[number] | typeof advisory[number], string, unknown[]]> = [];
    for(const item of tax) assignments.push(['Tax Assignment',item,'TAX',[item.assessmentYear,item.taxAssignmentType,item.taxpayerTin,item.submissionReference]]);
    for(const item of vat) assignments.push(['VAT Assignment',item,'VAT',[item.vatPeriod,item.assignmentType,item.bin,item.submissionReference,item.noticeReference]]);
    for(const item of rjsc) assignments.push(['RJSC Assignment',item,'RJSC',[item.companyRegistrationNumber,item.filingType,item.filingPeriod,item.filingReference]]);
    for(const item of accounting) assignments.push(['Accounting Assignment',item,'ACC',[item.accountingPeriodStart,item.accountingPeriodEnd,item.scope,item.finalAccountsVersion]]);
    for(const item of advisory) assignments.push(['Advisory Assignment',item,'ADV',[item.advisoryType,item.scope,item.deliverables,item.finalDeliverableReference]]);
    for (const [type,item,prefix,values] of assignments) {
      const engagement=engagementById.get(item.engagementId); const expectedService=type.replace(' Assignment','').replace('VAT','VAT').replace('RJSC','RJSC').replace('Accounting','Accounting').replace('Advisory','Advisory').replace('Tax','Tax');
      if(!engagement||engagement.serviceType!==expectedService) continue;
      add({id:item.id,type,title:`${prefix}-${engagement.engagementCode}`,subtitle:`${clientById.get(engagement.clientId)?.legalName??'Missing client'} · ${values.filter(Boolean).slice(0,2).join(' · ')}`,status:item.status,route:`/engagements/${item.engagementId}/phase4/assignment`,archived:!active(item)},[prefix,engagement.engagementCode,clientById.get(engagement.clientId)?.legalName,...values]);
    }
    return results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,Math.max(1,limit));
  }

  nextReference(kind: ReferenceKind, existing: string[], scope = ''): string {
    const settings=this.getSettings(); const prefix=settings.numbering.referencePrefixes[kind]; const used=new Set(existing.map(value=>normalize(value)));
    let sequence=settings.numbering.startingSequence;
    while(sequence<10_000_000){
      const suffix=String(sequence).padStart(settings.numbering.numberPadding,'0');
      const candidate=scope?`${prefix}${scope}-${suffix}`:`${prefix}${suffix}`;
      if(!used.has(normalize(candidate))) return candidate;
      sequence++;
    }
    throw new ValidationError('Reference could not be generated.',['The configured numbering range is exhausted.']);
  }

  async numberingHealth(): Promise<{ duplicates: IntegrationIssue[]; suggestions: Record<string,string> }> {
    const [clients,engagements,notes,findings,invoices,requests,amendments,collections,followUps,management,representations]=await Promise.all([
      this.repositories.clients.list({includeDeleted:true}),this.repositories.engagements.list({includeDeleted:true}),this.repositories.reviewNotes.list({includeDeleted:true}),this.repositories.auditFindings.list({includeDeleted:true}),
      this.repositories.invoices.list({includeDeleted:true}),this.repositories.documentRequests.list({includeDeleted:true}),this.repositories.amendmentRequests.list({includeDeleted:true}),this.repositories.collections.list({includeDeleted:true}),this.repositories.followUps.list({includeDeleted:true}),this.repositories.managementLetters.list({includeDeleted:true}),this.repositories.representationLetters.list({includeDeleted:true})
    ]);
    const duplicates:IntegrationIssue[]=[];
    const check=(module:string,records:Array<BaseRecord & Record<string,unknown>>,field:string,route:(record:Record<string,unknown>)=>string)=>{const seen=new Map<string,string>();for(const record of records.filter(active)){const value=normalize(record[field]);if(!value)continue;const prior=seen.get(value);if(prior)duplicates.push({code:'DUPLICATE_REFERENCE',severity:'Error',module,recordId:record.id,message:`Duplicate ${field} “${String(record[field])}” also used by ${prior}.`,route:route(record)});else seen.set(value,record.id);}};
    check('Clients',clients as Array<typeof clients[number]&Record<string,unknown>>,'clientCode',r=>`/clients/${r.id}`); check('Engagements',engagements as Array<typeof engagements[number]&Record<string,unknown>>,'engagementCode',r=>`/engagements/${r.id}`);
    check('Review Notes',notes as Array<typeof notes[number]&Record<string,unknown>>,'reviewNoteReference',r=>issueRoute('Review Notes',r)); check('Findings',findings as Array<typeof findings[number]&Record<string,unknown>>,'findingReference',r=>issueRoute('Findings',r));
    check('Invoices',invoices as Array<typeof invoices[number]&Record<string,unknown>>,'invoiceNumber',r=>'/billing'); check('Document Requests',requests as Array<typeof requests[number]&Record<string,unknown>>,'requestReference',r=>issueRoute('Document Requests',r));
    check('Amendments',amendments as Array<typeof amendments[number]&Record<string,unknown>>,'amendmentReference',r=>issueRoute('Amendments',r)); check('Collections',collections as Array<typeof collections[number]&Record<string,unknown>>,'collectionReference',()=>'/billing'); check('Follow-ups',followUps as Array<typeof followUps[number]&Record<string,unknown>>,'followUpReference',()=>'/communications');
    check('Management Letters',management as Array<typeof management[number]&Record<string,unknown>>,'reference',r=>issueRoute('Management Letters',r)); check('Representation Letters',representations as Array<typeof representations[number]&Record<string,unknown>>,'reference',r=>issueRoute('Representation Letters',r));
    const suggestions={
      client:this.getSettings().numbering.clientPrefix+String(this.getSettings().numbering.startingSequence).padStart(this.getSettings().numbering.numberPadding,'0'),
      engagement:this.getSettings().numbering.engagementPrefix+String(this.getSettings().numbering.startingSequence).padStart(this.getSettings().numbering.numberPadding,'0'),
      reviewNote:this.nextReference('reviewNote',notes.map(r=>r.reviewNoteReference)), finding:this.nextReference('finding',findings.map(r=>r.findingReference)), invoice:this.nextReference('invoice',invoices.map(r=>r.invoiceNumber)),
      documentRequest:this.nextReference('documentRequest',requests.map(r=>r.requestReference)), amendment:this.nextReference('amendment',amendments.map(r=>r.amendmentReference)), collection:this.nextReference('collection',collections.map(r=>r.collectionReference)), followUp:this.nextReference('followUp',followUps.map(r=>r.followUpReference)),
      managementLetter:this.nextReference('managementLetter',management.map(r=>r.reference)), representationLetter:this.nextReference('representationLetter',representations.map(r=>r.reference))
    };
    return{duplicates,suggestions};
  }

  async scanIntegration(): Promise<IntegrationHealth> {
    const moduleHealth:ModuleHealth[]=[]; const issues:IntegrationIssue[]=[]; let totalRecords=0;
    for(const [name,storageKey] of Object.entries(STORAGE_KEYS)){
      if(name==='settings'||name==='meta') continue;
      const raw=this.storage.getItem(storageKey);
      if(!raw){moduleHealth.push({module:name,storageKey,recordCount:0,state:'Empty',errors:[]});continue;}
      try{
        const parsed:unknown=JSON.parse(raw); const errors=BACKUP_DATA_KEYS.includes(storageKey as typeof BACKUP_DATA_KEYS[number])?validateModuleRecords(storageKey,parsed):[];
        const count=Array.isArray(parsed)?parsed.length:0; totalRecords+=count;
        moduleHealth.push({module:name,storageKey,recordCount:count,state:errors.length?'Corrupt':count?'Healthy':'Empty',errors});
        for(const message of errors) issues.push({code:'SCHEMA_VALIDATION',severity:'Error',module:name,recordId:'',message,route:'/administration/data-integrity'});
      }catch(error){const message=`${storageKey} contains invalid JSON: ${error instanceof Error?error.message:'parse failed'}`;moduleHealth.push({module:name,storageKey,recordCount:0,state:'Corrupt',errors:[message]});issues.push({code:'CORRUPT_MODULE',severity:'Error',module:name,recordId:'',message,route:'/administration/data-integrity'});}
    }
    const settingsRaw=this.storage.getItem(STORAGE_KEYS.settings); if(settingsRaw){try{for(const message of validateSettings(JSON.parse(settingsRaw)))issues.push({code:'INVALID_SETTINGS',severity:'Error',module:'settings',recordId:'',message,route:'/administration/app-settings'});}catch{issues.push({code:'CORRUPT_SETTINGS',severity:'Error',module:'settings',recordId:'',message:'Settings contain invalid JSON.',route:'/administration/app-settings'});}}
    const metaRaw=this.storage.getItem(STORAGE_KEYS.meta); if(metaRaw){try{for(const message of validateMeta(JSON.parse(metaRaw)))issues.push({code:'INVALID_META',severity:'Error',module:'meta',recordId:'',message,route:'/administration/data-integrity'});}catch{issues.push({code:'CORRUPT_META',severity:'Error',module:'meta',recordId:'',message:'Application metadata contain invalid JSON.',route:'/administration/data-integrity'});}}
    if(!issues.some(item=>item.severity==='Error')&&totalRecords>0){
      try{const envelope=this.backup.createBackup();const preview=this.backup.preview(envelope,'replace');for(const message of preview.errors)issues.push({code:'RELATIONSHIP_VALIDATION',severity:'Error',module:'Backup/Relationships',recordId:'',message,route:'/administration/backup'});}catch(error){issues.push({code:'INTEGRATION_SCAN_FAILED',severity:'Error',module:'Integration',recordId:'',message:error instanceof Error?error.message:'Unable to validate current records.',route:'/administration/data-integrity'});}
    }
    try{
      const [engagements,invoices,collections,reports,letters,materiality,locks,amendments]=await Promise.all([this.repositories.engagements.list({includeDeleted:true}),this.repositories.invoices.list({includeDeleted:true}),this.repositories.collections.list({includeDeleted:true}),this.repositories.reportVersions.list({includeDeleted:true}),this.repositories.engagementLetters.list({includeDeleted:true}),this.repositories.auditMateriality.list({includeDeleted:true}),this.repositories.engagementLocks.list({includeDeleted:true}),this.repositories.amendmentRequests.list({includeDeleted:true})]);
      const confirmedByInvoice=new Map<string,number>();for(const c of collections.filter(c=>!c.isDeleted&&c.status==='Confirmed'))confirmedByInvoice.set(c.invoiceId,(confirmedByInvoice.get(c.invoiceId)??0)+c.amount);
      for(const invoice of invoices.filter(active)){const confirmed=confirmedByInvoice.get(invoice.id)??0;const expected=Math.max(0,invoice.netAmount-confirmed);if(Math.abs(invoice.amountCollected-confirmed)>.009||Math.abs(invoice.outstandingAmount-expected)>.009)issues.push({code:'INVOICE_BALANCE_MISMATCH',severity:'Error',module:'Invoices',recordId:invoice.id,message:`Invoice ${invoice.invoiceNumber} balance does not match confirmed collections.`,route:'/billing'});}
      const uniqueByEngagement=(records:Array<BaseRecord&{engagementId:string}>,predicate:(r:any)=>boolean,label:string,module:string)=>{const groups=new Map<string,string[]>();for(const r of records.filter(r=>active(r)&&predicate(r))){const list=groups.get(r.engagementId)??[];list.push(r.id);groups.set(r.engagementId,list);}for(const [engagementId,ids] of groups)if(ids.length>1)issues.push({code:'MULTIPLE_CURRENT_RECORDS',severity:'Error',module,recordId:ids[0],message:`Engagement ${engagementId} has ${ids.length} ${label}.`,route:issueRoute(module,{engagementId,id:ids[0]})});};
      uniqueByEngagement(letters,r=>r.status==='Accepted','current Accepted engagement letters','Engagement Letters'); uniqueByEngagement(materiality,r=>r.status==='Approved','current Approved materiality versions','Materiality'); uniqueByEngagement(reports,r=>r.currentVersion===true,'Current audit report versions','Report Versions'); uniqueByEngagement(reports,r=>r.finalVersion===true&&['Final Approved','Issued'].includes(r.status),'final audit report versions','Report Versions');
      const lockByEngagement=new Map(locks.filter(active).map(lock=>[lock.engagementId,lock]));for(const engagement of engagements.filter(active)){const lock=lockByEngagement.get(engagement.id);if(engagement.status==='Locked'&&!lock)issues.push({code:'LOCK_RECORD_MISSING',severity:'Warning',module:'Engagements',recordId:engagement.id,message:`Locked engagement ${engagement.engagementCode} has no file-lock record.`,route:`/engagements/${engagement.id}/audit-planning/file-lock`});if(lock&&!['Locked','Closed'].includes(engagement.status))issues.push({code:'LOCK_STATUS_MISMATCH',severity:'Error',module:'Engagements',recordId:engagement.id,message:`Engagement ${engagement.engagementCode} has a file-lock record but status ${engagement.status}.`,route:`/engagements/${engagement.id}`});}
      for(const amendment of amendments.filter(a=>active(a)&&['Approved','In Progress'].includes(a.amendmentStatus))){const engagement=engagements.find(e=>e.id===amendment.engagementId);if(!engagement||!['Locked','Closed'].includes(engagement.status))issues.push({code:'AMENDMENT_BOUNDARY',severity:'Warning',module:'Amendments',recordId:amendment.id,message:`Open amendment ${amendment.amendmentReference} is not attached to a currently locked/closed engagement.`,route:issueRoute('Amendments',amendment as unknown as Record<string,unknown>)});}
    }catch(error){if(!(error instanceof AppError))issues.push({code:'CONSISTENCY_SCAN_FAILED',severity:'Error',module:'Integration',recordId:'',message:error instanceof Error?error.message:'Consistency scan failed.',route:'/administration/data-integrity'});}
    const numbering=await this.numberingHealth().catch(()=>({duplicates:[],suggestions:{}})); issues.push(...numbering.duplicates);
    const severityRank: Record<IntegrationIssue['severity'], number> = { Error: 0, Warning: 1, Information: 2 };
    const sorted=issues.sort((a,b)=>severityRank[a.severity]-severityRank[b.severity]||a.module.localeCompare(b.module));
    return{checkedAt:new Date().toISOString(),totalRecords,healthyModules:moduleHealth.filter(m=>m.state==='Healthy').length,emptyModules:moduleHealth.filter(m=>m.state==='Empty').length,corruptModules:moduleHealth.filter(m=>m.state==='Corrupt').length,errorCount:sorted.filter(i=>i.severity==='Error').length,warningCount:sorted.filter(i=>i.severity==='Warning').length,moduleHealth,issues:sorted};
  }

  createRawRecoverySnapshot(): { createdAt:string; data:Record<string,string|null> } {
    return{createdAt:new Date().toISOString(),data:Object.fromEntries(ALL_STORAGE_KEYS.map(key=>[key,this.storage.getItem(key)]))};
  }

  resetCorruptModule(storageKey:string): string {
    if(!ALL_STORAGE_KEYS.includes(storageKey as typeof ALL_STORAGE_KEYS[number]))throw new ValidationError('Module cannot be reset.',['Unknown application storage key.']);
    const raw=this.storage.getItem(storageKey);if(raw===null)throw new ValidationError('Module cannot be reset.',['The selected module is already empty.']);
    const snapshotKey=`afm:recovery_snapshot:${Date.now()}`;this.storage.setItem(snapshotKey,JSON.stringify({storageKey,raw,createdAt:new Date().toISOString()}));this.storage.removeItem(storageKey);return snapshotKey;
  }


  resetStartupConfiguration(): string {
    const snapshotKey=`afm:recovery_snapshot:${Date.now()}`;
    const payload={createdAt:new Date().toISOString(),settings:this.storage.getItem(STORAGE_KEYS.settings),meta:this.storage.getItem(STORAGE_KEYS.meta),services:this.storage.getItem(STORAGE_KEYS.services)};
    this.storage.setItem(snapshotKey,JSON.stringify(payload));
    this.storage.removeItem(STORAGE_KEYS.settings); this.storage.removeItem(STORAGE_KEYS.meta);
    return snapshotKey;
  }

  validateReferenceScope(reference:string):void{if(!reference.trim())throw new ValidationError('Reference is required.',['Reference cannot be blank.']);if(reference.length>80)throw new ValidationError('Reference is too long.',['Reference cannot exceed 80 characters.']);}
}
