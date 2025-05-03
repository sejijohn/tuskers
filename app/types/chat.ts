export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string | null;
  timestamp: string;
  type: 'text' | 'image';
  statusMap?: {
    [userId: string]: 'sent' | 'delivered' | 'read';
  };
  seenBy?: string[]; // For group chat
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name?: string; // For group chats
  participants: string[]; // User IDs
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus = 'sent' | 'delivered' | 'read';