import type { IRepository } from '../repositories/interfaces/IRepository';
import type { Engagement } from '../types/models';
import { AppError, ValidationError } from '../utils/errors';
import type { ActivityService } from './ActivityService';

export const isEngagementReadOnly = (engagement: Engagement): boolean =>
  engagement.status === 'Locked' || engagement.status === 'Closed';

export async function requireMutableEngagement(
  engagements: IRepository<Engagement>,
  activity: ActivityService,
  engagementId: string,
  operatorName: string,
  operation: string
): Promise<Engagement> {
  const engagement = await engagements.getById(engagementId);
  if (!engagement || engagement.isDeleted) throw new AppError('Engagement was not found.', 'NOT_FOUND');
  if (isEngagementReadOnly(engagement)) {
    await activity.log({
      entityType: 'Engagement',
      entityId: engagement.id,
      action: 'Lock Attempt',
      previousStatus: engagement.status,
      newStatus: engagement.status,
      changedFieldSummary: `Blocked ${operation}`,
      operatorName,
      reason: `${engagement.status} engagements and linked records are read-only.`
    });
    throw new ValidationError('Linked record cannot be changed.', [
      `${engagement.status} engagement ${engagement.engagementCode} is read-only.`
    ]);
  }
  return engagement;
}
