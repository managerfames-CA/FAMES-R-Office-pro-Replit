export const STORAGE_KEYS = {
  meta: 'afm:meta', settings: 'afm:settings', clients: 'afm:clients', clientContacts: 'afm:client_contacts',
  staff: 'afm:staff', engagements: 'afm:engagements', engagementTeam: 'afm:engagement_team',
  engagementDeadlines: 'afm:engagement_deadlines', tasks: 'afm:tasks', services: 'afm:services',
  clientCategories: 'afm:client_categories', industries: 'afm:industries', auditEvents: 'afm:audit_events',
  acceptanceReviews: 'afm:acceptance_reviews', independenceAssessments: 'afm:independence_assessments',
  engagementLetters: 'afm:engagement_letters', auditPlans: 'afm:audit_plans', planningMilestones: 'afm:planning_milestones',
  auditRisks: 'afm:audit_risks', auditMateriality: 'afm:audit_materiality', programmeTemplates: 'afm:programme_templates',
  engagementProgrammes: 'afm:engagement_programmes', workingPapers: 'afm:working_papers', evidenceRegister: 'afm:evidence_register',
  samplingRegister: 'afm:sampling_register', documentRequests: 'afm:document_requests', documentRequestItems: 'afm:document_request_items',
  documentRequestReminders: 'afm:document_request_reminders',
  reviewNotes: 'afm:review_notes', auditCompletionItems: 'afm:audit_completion_items', auditFindings: 'afm:audit_findings',
  reportVersions: 'afm:report_versions', managementLetters: 'afm:management_letters', representationLetters: 'afm:representation_letters',
  reportIssues: 'afm:report_issues', engagementLocks: 'afm:engagement_locks', amendmentRequests: 'afm:amendment_requests',
  managerReviewRecords: 'afm:manager_review_records', partnerReviewRecords: 'afm:partner_review_records',
  listedComplianceItems: 'afm:listed_compliance_items', regulatoryDeadlines: 'afm:regulatory_deadlines',
  auditCommitteeCommunications: 'afm:audit_committee_communications', qualityReviews: 'afm:quality_reviews', keyAuditMatters: 'afm:key_audit_matters',
  taxAssignments: 'afm:tax_assignments', vatAssignments: 'afm:vat_assignments', rjscAssignments: 'afm:rjsc_assignments',
  accountingAssignments: 'afm:accounting_assignments', advisoryAssignments: 'afm:advisory_assignments',
  timesheets: 'afm:timesheets', expenses: 'afm:expenses', invoices: 'afm:invoices', collections: 'afm:collections',
  communications: 'afm:communications', followUps: 'afm:follow_ups'
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
export const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);
