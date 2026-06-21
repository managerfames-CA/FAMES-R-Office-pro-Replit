import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement } from '../types/models';
import { ValidationError } from '../utils/errors';
import type { ActivityService } from './ActivityService';
import { requireMutableEngagement } from './engagementLock';

export async function requireAuditEngagement(
  engagements: IRepository<Engagement>,
  engagementId: string
): Promise<Engagement> {
  const engagement = await engagements.getById(engagementId);
  if (!engagement || engagement.isDeleted) throw new ValidationError('Audit planning record could not be accessed.', ['Engagement was not found.']);
  if (engagement.serviceType !== 'Audit') throw new ValidationError('Audit planning is unavailable.', ['Only Audit engagements may use Audit Planning modules.']);
  return engagement;
}

export async function requireMutableAuditEngagement(
  engagements: IRepository<Engagement>,
  activity: ActivityService,
  engagementId: string,
  operatorName: string,
  operation: string
): Promise<Engagement> {
  const engagement = await requireMutableEngagement(engagements, activity, engagementId, operatorName, operation);
  if (engagement.serviceType !== 'Audit') throw new ValidationError('Audit planning is unavailable.', ['Only Audit engagements may use Audit Planning modules.']);
  return engagement;
}
