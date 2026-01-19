import { User, Attendance, Meeting } from '../types';

/**
 * Calculate trust level from score
 */
export function getTrustLevel(score: number): 'trust' | 'stable' | 'caution' | 'restricted' {
  if (score >= 90) return 'trust';
  if (score >= 70) return 'stable';
  if (score >= 50) return 'caution';
  return 'restricted';
}

/**
 * Calculate attendance rate score (max 40 points)
 */
export function calculateAttendanceRateScore(
  attendedCount: number,
  approvedCount: number
): number {
  if (approvedCount === 0) return 0;
  if (approvedCount < 3) return 0; // Need at least 3 approvals to get score
  
  const rate = attendedCount / approvedCount;
  return Math.round(rate * 40);
}

/**
 * Calculate no-show penalty (max -30 points)
 */
export function calculateNoShowPenalty(noShowCount: number): number {
  if (noShowCount === 0) return 0;
  if (noShowCount === 1) return -10;
  if (noShowCount === 2) return -20;
  return -30; // Max -30 for 3+ no-shows
}

/**
 * Calculate cancellation penalty based on timing (max -20 points)
 */
export function calculateCancellationPenalty(
  cancelledAt: string,
  meetingDate: string
): number {
  const cancelledTime = new Date(cancelledAt).getTime();
  const meetingTime = new Date(meetingDate).getTime();
  const hoursUntilMeeting = (meetingTime - cancelledTime) / (1000 * 60 * 60);
  
  if (hoursUntilMeeting >= 24) return 0; // No penalty for 24+ hours notice
  if (hoursUntilMeeting >= 12) return -5;
  if (hoursUntilMeeting >= 6) return -10;
  if (hoursUntilMeeting >= 1) return -15;
  return -20; // Less than 1 hour
}

/**
 * Calculate host experience score (max 10 points)
 */
export function calculateHostExperienceScore(hostedCount: number): number {
  if (hostedCount === 0) return 0;
  if (hostedCount === 1) return 2;
  if (hostedCount >= 3 && hostedCount < 5) return 5;
  if (hostedCount >= 5) return 10;
  return 0;
}

/**
 * Update user trust score
 */
export async function updateTrustScore(
  userId: string,
  scoreChange: number,
  reason: string,
  relatedMeetingId?: string
): Promise<void> {
  // This would typically update the database
  // Implementation depends on your database setup
}

