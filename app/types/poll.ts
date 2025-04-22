import { Timestamp } from "firebase/firestore";
export interface PollOption {
    id: string;
    text: string;
    votes: string[]; // Array of user IDs who voted for this option
  }
  
  export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    createdBy: string; // User ID of poll creator
    createdByName: string; // Name of poll creator
    //createdAt: string; // ISO date string
    //endsAt: string; // ISO date string
    createdAt: Timestamp; // Firestore Timestamp
    endsAt: Timestamp; // Firestore Timestamp
    isActive: boolean;
    isComplete: boolean; // New field to track if poll is complete
  }