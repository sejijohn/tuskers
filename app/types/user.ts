export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  approved: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  photoURL: string | null;
  bio: string;
  dateOfBirth?: string;
  city?: string;
  phoneNumber?: string;
  myRides?: string;
}