import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy, getDocs, deleteDoc, doc, addDoc, updateDoc, getDoc } from 'firebase/firestore';
import { MessageSquarePlus, Users, Trash2, Shield, PlusCircle, BarChart as ChartBar } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Chat } from '../../types/chat';
import { User } from '../../types/user';
import { Poll } from '../../types/poll';
import { Button } from '../../components/Button';

export default function ChatList() {
  const router = useRouter();
  const { user } = useUser();
  const [users, setUsers] = useState<Record<string, User>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [loadingPoll, setLoadingPoll] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch all users first
    const fetchUsers = async () => {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersMap: Record<string, User> = {};
      usersSnapshot.forEach((doc) => {
        usersMap[doc.id] = { id: doc.id, ...doc.data() } as User;
      });
      setUsers(usersMap);
    };

    fetchUsers();

    // Subscribe to active poll
    const pollQuery = query(
      collection(db, 'polls'),
      where('isActive', '==', true),
      where('isComplete', '==', false)
    );

    const unsubscribePoll = onSnapshot(pollQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const pollData = snapshot.docs[0].data() as Poll;
        const pollId = snapshot.docs[0].id;
        //const hasEnded = new Date(pollData.endsAt).getTime() <= new Date().getTime();
        
        //if (!hasEnded) {
          setActivePoll({ ...pollData, id: pollId });
        // } else {
        //   // If poll has ended, mark it as complete
        //   await updateDoc(doc(db, 'polls', pollId), {
        //     isActive: false,
        //     isComplete: true
        //   });
        //   setActivePoll(null);
        // }
      } else {
        setActivePoll(null);
      }
      setLoadingPoll(false);
    });

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.id),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatList);
      setLoading(false);
    });

    return () => {
      unsubscribePoll();
      unsubscribe();
    };
  }, [user]);

  const getChatTitle = (chat: Chat) => {
    if (chat.type === 'group') return chat.name;
    
    const otherParticipantId = chat.participants.find(id => id !== user?.id);
    if (!otherParticipantId) return 'Unknown';
    
    const otherUser = users[otherParticipantId];
    return otherUser?.fullName || 'Unknown User';
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!user) return;

    try {
      setDeleting(chatId);
      await deleteDoc(doc(db, 'chats', chatId));
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const startAdminChat = async () => {
    if (!user) return;

    try {
      // Fetch all admin users
      const adminQuery = query(
        collection(db, 'users'),
        where('role', '==', 'admin'),
        where('approved', '==', true)
      );
      const adminSnapshot = await getDocs(adminQuery);
      const adminIds = adminSnapshot.docs.map(doc => doc.id);

      if (adminIds.length === 0) {
        Alert.alert('No Admins', 'There are no admins available to chat with at the moment.');
        return;
      }

      const existingChat = chats.find(
        chat => chat.type === 'group' && chat.name === 'Admin Support'
      );
      if (existingChat) {
        router.push(`/chat/${existingChat.id}`);
        return;
      } else {


      // Create a group chat with all admins
      const chatData = {
        type: 'group',
        name: 'Admin Support',
        participants: [...adminIds, user.id],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      router.push(`/chat/${chatRef.id}`);

    }
    } catch (error) {
      console.error('Error creating admin chat:', error);
      Alert.alert('Error', 'Failed to create admin chat. Please try again.');
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!user) return;

    try {
      const pollDoc = await getDoc(doc(db, 'polls', pollId));
      if (!pollDoc.exists()) {
        setActivePoll(null);
        return;
      }

      const pollData = pollDoc.data() as Poll;
      //const hasEnded = new Date(pollData.endsAt).getTime() <= new Date().getTime();
      const hasEnded =
  pollData.endsAt.toDate().getTime() <= new Date().getTime();

      // Check permissions: allow if user is creator/admin or if poll has ended
      if (!hasEnded && user.id !== pollData.createdBy && user.role !== 'admin') {
        Alert.alert('Error', 'You do not have permission to delete this poll');
        return;
      }

      Alert.alert(
        'Delete Poll',
        'Are you sure you want to delete this poll?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // First mark the poll as complete
                await updateDoc(doc(db, 'polls', pollId), {
                  isActive: false,
                  isComplete: true
                });
                
                // Then delete the poll
                await deleteDoc(doc(db, 'polls', pollId));
                setActivePoll(null);
              } catch (error) {
                console.error('Error deleting poll:', error);
                Alert.alert('Error', 'Failed to delete poll');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error handling poll deletion:', error);
      Alert.alert('Error', 'Failed to delete poll');
    }
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      {item.type === 'group' ? (
        <View style={styles.groupAvatarContainer}>
          <Text style={styles.memberCount}>
            {item.participants.length}
          </Text>
          {item.name === 'Admin Support' ? (
            <Shield size={24} color="#3dd9d6" />
          ) : (
            <Users size={24} color="#3dd9d6" />
          )}
        </View>
      ) : (
        <Image
          source={{ 
            uri: users[item.participants.find(id => id !== user?.id) || '']?.photoURL || 
                'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80'
          }}
          style={styles.avatar}
        />
      )}
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{getChatTitle(item)}</Text>
        {item.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.content}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.deleteButton,
          deleting === item.id && styles.deleteButtonDisabled
        ]}
        onPress={() => {
          Alert.alert(
            'Delete Chat',
            'Are you sure you want to delete this chat?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteChat(item.id)
              }
            ]
          );
        }}
        disabled={deleting === item.id}
      >
        <Trash2 
          size={18} 
          color={deleting === item.id ? 'rgba(255, 107, 74, 0.5)' : '#FF6B4A'} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderActivePoll = () => {
    if (!activePoll) return null;

    const totalVotes = activePoll.options.reduce((sum, option) => sum + option.votes.length, 0);
    const hasVoted = activePoll.options.some(option => option.votes.includes(user?.id || ''));
    //const hasEnded = new Date(activePoll.endsAt).getTime() <= new Date().getTime();
    const hasEnded = activePoll.endsAt.toDate().getTime() <= new Date().getTime();
    const canDelete = hasEnded || user?.id === activePoll.createdBy || user?.role === 'admin';
    console.log('canDelete:', canDelete);

    return (
      <View style={styles.pollContainer}>
        <View style={styles.pollHeader}>
          <View style={styles.pollTitleContainer}>
            <ChartBar size={20} color="#3dd9d6" />
            <Text style={styles.pollTitle}>Active Poll</Text>
          </View>
          {canDelete && (
            <TouchableOpacity
              onPress={() => handleDeletePoll(activePoll.id)}
              style={styles.deletePollButton}
            >
              <Trash2 size={20} color="#FF6B4A" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.pollQuestion}>{activePoll.question}</Text>
        
        <View style={styles.pollStats}>
          <Text style={styles.pollVotes}>{totalVotes} votes</Text>
          <Text style={styles.pollCreator}>by {activePoll.createdByName}</Text>
        </View>

        <TouchableOpacity
          style={styles.viewPollButton}
          onPress={() => router.push('/polls')}
        >
          <Text style={styles.viewPollText}>View Poll</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.newChatButton, styles.pollButton, activePoll && styles.disabledButton]}
            onPress={() => {
              if (!activePoll) {
                router.push('/polls/new');
              }
            }}
            disabled={!!activePoll}
          >
            <PlusCircle size={24} color={activePoll ? '#aaa' : '#3dd9d6'} />
            <Text style={[styles.pollButtonText, activePoll && styles.disabledText]}>
              {activePoll ? 'Poll Active' : 'Create Poll'}
            </Text>
          </TouchableOpacity>
          {user?.role === 'member' && (
            <TouchableOpacity
              style={[styles.newChatButton, styles.adminChatButton]}
              onPress={startAdminChat}
            >
              <Shield size={24} color="#3dd9d6" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={() => router.push('/chat/new')}
          >
            <MessageSquarePlus size={24} color="#3dd9d6" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderActivePoll}
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>No chats yet</Text>
            {user?.role === 'member' && (
              <Button
                title="Chat with Admins"
                onPress={startAdminChat}
                style={styles.adminButton}
              />
            )}
            <TouchableOpacity
              style={styles.startChatButton}
              onPress={() => router.push('/chat/new')}
            >
              <Text style={styles.startChatText}>Start a new chat</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#243c44',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollButton: {
    width: 'auto',
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  pollButtonText: {
    color: '#3dd9d6',
    fontSize: 14,
    fontWeight: '500',
  },
  adminChatButton: {
    backgroundColor: 'rgba(61, 217, 214, 0.2)',
  },
  listContent: {
    padding: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#243c44',
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  groupAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3dd9d6',
  },
  memberCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#3dd9d6',
    color: '#1a2f35',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 1,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.7,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  adminButton: {
    marginBottom: 16,
    backgroundColor: 'rgba(61, 217, 214, 0.2)',
    borderColor: '#3dd9d6',
  },
  startChatButton: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3dd9d6',
  },
  startChatText: {
    color: '#3dd9d6',
    fontSize: 16,
    fontWeight: '500',
  },
  pollContainer: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    marginTop: 0,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pollTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
  },
  deletePollButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollQuestion: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 12,
  },
  pollStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pollVotes: {
    fontSize: 14,
    color: '#3dd9d6',
  },
  pollCreator: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  viewPollButton: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewPollText: {
    color: '#3dd9d6',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#2a3b3f',
    opacity: 0.5,
  },
  disabledText: {
    color: '#999',
  },
});