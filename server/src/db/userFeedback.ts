import { query, dbEnabled } from './pool';

export interface UserFeedbackInput {
  rating: number;
  category: string;
  comment: string | null;
  email: string | null;
}

export async function recordUserFeedback(input: UserFeedbackInput): Promise<void> {
  if (!dbEnabled()) return;
  await query(
    `INSERT INTO user_feedback (rating, category, comment, email)
     VALUES ($1, $2, $3, $4)`,
    [input.rating, input.category, input.comment, input.email],
  );
}

export async function getUserFeedback(): Promise<UserFeedbackInput[]> {
  if (!dbEnabled()) return [];
  return query<UserFeedbackInput>(
    `SELECT rating, category, comment, email, created_at
     FROM user_feedback
     ORDER BY created_at DESC
     LIMIT 500`,
  );
}
