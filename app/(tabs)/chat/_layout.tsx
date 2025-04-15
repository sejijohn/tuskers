import { Stack } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { usePathname } from 'expo-router';
import { db } from '../../utils/firebase';
import { Chat } from '../../types/chat';
import { User } from '../../types/user';
import { useUser } from '../../context/UserContext';

export default function ChatLayout() {
  const { user: currentUser } = useUser();
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({});
  const pathname = usePathname();

  const getChatTitle = useCallback(async (chatId: string) => {
    try {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (!chatDoc.exists()) return null;

      const chatData = chatDoc.data() as Chat;
      
      // If it's a group chat, return the name
      if (chatData.type === 'group') {
        return chatData.name;
      }

      // For direct chats, get the other participant's name
      const otherParticipantId = chatData.participants.find(id => id !== currentUser?.id);
      if (!otherParticipantId) return 'Unknown User';

      const userDoc = await getDoc(doc(db, 'users', otherParticipantId));
      if (!userDoc.exists()) return 'Unknown User';

      const userData = userDoc.data() as User;
      return userData.fullName;
    } catch (error) {
      console.error('Error getting chat title:', error);
      return 'Chat';
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !pathname) return;

    const match = pathname.match(/\/chat\/([^?/]+)/);
    if (match) {
      const chatId = match[1];
      if (!chatTitles[chatId]) {
        getChatTitle(chatId).then(title => {
          if (title) {
            setChatTitles(prev => ({ ...prev, [chatId]: title }));
          }
        });
      }
    }
  }, [pathname, currentUser, getChatTitle, chatTitles]);

  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={({ route }) => ({ 
          headerShown: true,
          headerStyle: {
            backgroundColor: '#243c44',
          },
          headerTintColor: '#3dd9d6',
          headerTitleStyle: {
            color: '#3dd9d6',
          },
          title: chatTitles[route.params?.id as string] || 'Chat',
        })} 
      />
      <Stack.Screen 
        name="new" 
        options={{
          presentation: 'modal',
          headerStyle: {
            backgroundColor: '#243c44',
          },
          headerTintColor: '#3dd9d6',
          headerTitleStyle: {
            color: '#3dd9d6',
          },
          title: 'New Chat',
        }}
      />
    </Stack>
  );
}