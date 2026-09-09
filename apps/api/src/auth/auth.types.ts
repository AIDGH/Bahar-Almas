import { Request } from 'express';
import { UserRole } from '../generated/prisma/enums';

export type AuthenticatedRequest = Request & {
  user: { id: string; role: UserRole };
  sessionToken: string;
};
