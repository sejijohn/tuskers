import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, Modal, ViewToken, Linking, Alert, TouchableWithoutFeedback, Keyboard, SafeAreaView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, limit, startAfter, getDocs,where } from 'firebase/firestore';
import { Send, Users, X,MessageSquarePlus,Check } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Message, Chat } from '../../types/chat';
import { User } from '../../types/user';
import ParsedText from 'react-native-parsed-text';
import { useRouter } from 'expo-router';

const MESSAGES_PER_PAGE = 20;

export default function ChatRoom() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const [lastMessageDoc, setLastMessageDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
   const [showAddMembers, setShowAddMembers] = useState(false);
  const [eligibleUsers, setEligibleUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]); // fetched elsewhere

  useEffect(() => {
  // Filter out users who are already in the chat from eligibleUsers
  setEligibleUsers(allUsers.filter(user => !members.some(m => m.id === user.id)));
  fetchChat();
}, [members, allUsers]);

  useEffect(() => {
    if (!id) return;
    fetchChat();
  }, [id]);

 let unsubscribe: (() => void) | null = null;
  const fetchChat = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', id as string));
        if (!chatDoc.exists()) {
          Alert.alert(
            'Chat Not Found',
            'This chat may have been deleted.',
            [{ text: 'OK', onPress: () => router.replace('/chat') }]
          );
          return;
        }

        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        setChat(chatData);

        if (chatData.type === 'group') {
          const membersData = await Promise.all(
            chatData.participants.map(async (participantId) => {
              const userDoc = await getDoc(doc(db, 'users', participantId));
              return { id: userDoc.id, ...userDoc.data() } as User;
            })
          );
          setMembers(membersData);
          //fetchEligibleUsers();
        }

        // Initial messages query
        const messagesQuery = query(
          collection(db, 'chats', id as string, 'messages'),
          orderBy('timestamp', 'desc'),
          limit(MESSAGES_PER_PAGE)
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        const messagesList: Message[] = [];
        messagesSnapshot.forEach((doc) => {
          messagesList.push({ id: doc.id, ...doc.data() } as Message);
        });

        // Ensure messages have unique IDs by combining message ID with timestamp
        const uniqueMessages = messagesList.map(message => ({
          ...message,
          //uniqueId: `${message.id}-${message.timestamp}`
        }));

        //setMessages(uniqueMessages);
        setMessages(messagesList);
        setLastMessageDoc(messagesSnapshot.docs[messagesSnapshot.docs.length - 1]);
        setHasMoreMessages(messagesSnapshot.docs.length === MESSAGES_PER_PAGE);
        setLoading(false);
        setIsFirstLoad(false);

        // Set up real-time listener for new messages
        unsubscribe = onSnapshot(
          query(
            collection(db, 'chats', id as string, 'messages'),
            orderBy('timestamp', 'desc'),
            limit(1)
          ),
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const newMessage = {
                  id: change.doc.id,
                  ...change.doc.data(),
                  //uniqueId: `${change.doc.id}-${change.doc.data().timestamp}` 
                } as Message; //& { uniqueId: string };
                //setMessages(prev => [newMessage, ...prev]);
                setMessages(prev => {
                  const exists = prev.some(msg => msg.id === newMessage.id);
                  if (!exists) {
                    return [newMessage, ...prev];
                  }
                  return prev;
                });
              }
            });
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching chat:', error);
        setLoading(false);
      }
    };

  const loadMoreMessages = async () => {
    if (!hasMoreMessages || loadingMore || !lastMessageDoc) return;

    try {
      setLoadingMore(true);
      const moreMessagesQuery = query(
        collection(db, 'chats', id as string, 'messages'),
        orderBy('timestamp', 'desc'),
        startAfter(lastMessageDoc),
        limit(MESSAGES_PER_PAGE)
      );

      const moreMessagesSnapshot = await getDocs(moreMessagesQuery);
      const moreMessagesList: Message[] = [];
      moreMessagesSnapshot.forEach((doc) => {
        moreMessagesList.push({ id: doc.id, ...doc.data() } as Message);
      });

      if (moreMessagesList.length > 0) {
        // Ensure loaded messages have unique IDs
        const uniqueMessages = moreMessagesList.map(message => ({
          ...message,
          //uniqueId: `${message.id}-${message.timestamp}`
        }));

        //setMessages(prev => [...prev, ...uniqueMessages]);
        setMessages(prev => [...prev, ...moreMessagesList]);
        setLastMessageDoc(moreMessagesSnapshot.docs[moreMessagesSnapshot.docs.length - 1]);
        setHasMoreMessages(moreMessagesList.length === MESSAGES_PER_PAGE);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chat) return;

    const messageData: Omit<Message, 'id'> = {
      content: newMessage.trim(),
      senderId: user.id,
      senderName: user.fullName,
      senderPhotoURL: user.photoURL,
      timestamp: new Date().toISOString(),
      type: 'text',
      statusMap: {
        [user.id]: 'sent'
      },
      seenBy: []
    };

    try {
      await addDoc(collection(db, 'chats', id as string, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: messageData,
        updatedAt: new Date().toISOString(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message /*& { uniqueId: string }*/ }) => {
    const isOwnMessage = item.senderId === user?.id;
    let userStatus = isOwnMessage && item.statusMap ?
      Object.entries(item.statusMap)
        .filter(([uid]) => uid !== user?.id)
        .reduce((highest, [, status]) =>
          statusPriority[status] > statusPriority[highest] ? status : highest
          , 'sent') : item.statusMap?.[user?.id ?? ''];

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        {!isOwnMessage && (
          <Image
            source={{ uri: item.senderPhotoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' }}
            style={styles.messageAvatar}
          />
        )}
        <View style={[
          styles.messageContent,
          isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent
        ]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <ParsedText
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}
            parse={[
              {
                type: 'url',
                style: {
                  color: isOwnMessage ? '#269999' : '#3dd9d6',
                  textDecorationLine: 'underline'
                },
                onPress: async (url) => {
                  const supported = await Linking.canOpenURL(url);
                  if (supported) {
                    Linking.openURL(url);
                  } else {
                    Alert.alert("Can't open this URL:", url);
                  }
                }
              }
            ]}
            childrenProps={{ allowFontScaling: false }}
          >
            {item.content}
          </ParsedText>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isOwnMessage && userStatus && (
            <Text style={styles.messageStatus}>
              {userStatus === 'read' ? 'Read' : userStatus === 'delivered' ? 'Delivered' : 'Sent'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderMemberItem = ({ item }: { item: User }) => (
    <View style={styles.memberItem}>
      <Image
        source={{ uri: item.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' }}
        style={styles.memberAvatar}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.fullName}</Text>
        <Text style={styles.memberRole}>{item.role}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  const statusPriority: Record<string, number> = {
    sent: 1,
    delivered: 2,
    read: 3,
  };

    const fetchEligibleUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('approved', '==', true),
        where('deleted', '==', false)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      //const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setAllUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)))
      // Filter out users who are already in the chat
      const eligibleUsers = allUsers.filter(user => 
        !chat?.participants.includes(user.id)
      );
      
      setEligibleUsers(eligibleUsers);
    } catch (error) {
      console.error('Error fetching eligible users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    }
  };

    const handleAddMembers = async () => {
    if (!chat || selectedUsers.length === 0) return;

    try {
      setAddingMembers(true);
      const updatedParticipants = [...chat.participants, ...selectedUsers];
      
      await updateDoc(doc(db, 'chats', chat.id), {
        participants: updatedParticipants,
        updatedAt: new Date().toISOString(),
      });

      // Add system message about new members
      const newMembersNames = selectedUsers
        .map(id => eligibleUsers.find(user => user.id === id)?.fullName)
        .filter(Boolean)
        .join(', ');

      const systemMessage: Omit<Message, 'id'> = {
        content: `${newMembersNames} joined the group`,
        senderId: 'system',
        senderName: 'System',
        senderPhotoURL: null,
        timestamp: new Date().toISOString(),
        type: 'text',
        statusMap: {},
        seenBy: []
      };

      await addDoc(collection(db, 'chats', chat.id, 'messages'), systemMessage);

      // Update local state
      const newMembers = await Promise.all(
        selectedUsers.map(async (userId) => {
          const userDoc = await getDoc(doc(db, 'users', userId));
          return { id: userId, ...userDoc.data() } as User;
        })
      );

//       setMembers(prev => [...prev, ...newMembers]);
//       setEligibleUsers(prev =>
//   prev.filter(user => !selectedUsers.includes(user.id))
// );
//       setSelectedUsers([]);
//       setShowAddMembers(false);
setEligibleUsers(prev =>
  prev.filter(user => !selectedUsers.includes(user.id))
);
setSelectedUsers([]);
setShowAddMembers(false);
setMembers(prev => [...prev, ...newMembers]);

      
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  const renderEligibleUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.includes(item.id);
    
    return (
      <TouchableOpacity 
        style={[styles.eligibleUserItem, isSelected && styles.selectedUserItem]}
        onPress={() => {
          setSelectedUsers(prev => 
            isSelected 
              ? prev.filter(id => id !== item.id)
              : [...prev, item.id]
          );
        }}
      >
        <Image
          source={{ uri: item.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.fullName}</Text>
          <Text style={styles.memberRole}>{item.role}</Text>
        </View>
        <View style={[
                styles.checkbox,
                selectedUsers.includes(item.id) && styles.checkboxSelected
              ]} />
        {/* {isSelected && (
          <Check size={24} color="#3dd9d6" />
        )} */}
      </TouchableOpacity>
    );
  };


  return (
  <SafeAreaView style={[{ flex: 1 }, styles.container]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {chat?.type === 'group' && (
        <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.membersButton}
              onPress={() => setShowMembers(true)}
            >
              <Users size={20} color="#3dd9d6" />
              <Text style={styles.membersButtonText}>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.membersButton}
              onPress={() => {
                fetchEligibleUsers();
                setShowAddMembers(true);
                }
              }
            >
              <MessageSquarePlus size={20} color="#3dd9d6" />
              <Text style={styles.membersButtonText}>
                Add Member
              </Text>
            </TouchableOpacity>
          </View>   
          )}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item: Message) => item.id}
          inverted
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingBottom: 80, // match your input height
          }}
          ListFooterComponent={loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <Text style={styles.loadingText}>Loading more...</Text>
            </View>
          ) : null}
        />

        {/* Input bar */}
        <View style={styles.inputContainer}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            style={styles.input}
            placeholder="Type a message"
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!newMessage.trim()}
            style={styles.sendButton}
          >
            <Send size={20} color="#3dd9d6" />
          </TouchableOpacity>
        </View>
      </View>
      <Modal
            visible={showMembers}
            transparent
            animationType="slide"
            onRequestClose={() => setShowMembers(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Group Members</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowMembers(false)}
                  >
                    <X size={24} color="#3dd9d6" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={members}
                  renderItem={renderMemberItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.membersList}
                />
              </View>
            </View>
          </Modal>
          {/* Add Members Modal */}
        <Modal
          visible={showAddMembers}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAddMembers(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Members</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowAddMembers(false);
                    setSelectedUsers([]);
                  }}
                >
                  <X size={24} color="#3dd9d6" />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={eligibleUsers}
                renderItem={renderEligibleUserItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.membersList}
                keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
              />
              
              {selectedUsers.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.addMembersButton,
                    addingMembers && styles.addMembersButtonDisabled
                  ]}
                  onPress={handleAddMembers}
                  disabled={addingMembers}
                >
                  <Text style={styles.addMembersButtonText}>
                    {addingMembers ? 'Adding...' : `Add ${selectedUsers.length} Member${selectedUsers.length !== 1 ? 's' : ''}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
    </KeyboardAvoidingView>
  </SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
    padding:10
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageContent: {
    borderRadius: 16,
    padding: 12,
  },
  ownMessageContent: {
    backgroundColor: '#3dd9d6',
  },
  otherMessageContent: {
    backgroundColor: '#243c44',
  },
  senderName: {
    fontSize: 12,
    color: '#3dd9d6',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#1a2f35',
  },
  otherMessageText: {
    color: '#ffffff',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#243c44',
    borderTopWidth: 1,
    borderTopColor: 'rgba(61, 217, 214, 0.1)',
    marginBottom: 26,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    color: '#ffffff',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#3dd9d6',
  },
  membersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    padding: 8,
    borderRadius: 20,
    margin: 8,
    alignSelf: 'center',
  },
  membersButtonText: {
    color: '#3dd9d6',
    marginLeft: 8,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a2f35',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  closeButton: {
    padding: 4,
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243c44',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'capitalize',
  },
  messageStatus: {
    fontSize: 8,
    color: 'rgba(26, 47, 53, 0.7)',
    marginTop: 5,
  },
  loadingMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
   newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
   headerButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center', // ⬅️ center items horizontally
  alignItems: 'center', 
  },
    eligibleUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243c44',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
    selectedUserItem: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderWidth: 1,
    borderColor: '#3dd9d6',
  },
   addMembersButton: {
    backgroundColor: '#3dd9d6',
    padding: 16,
    borderRadius: 8,
    margin: 16,
    alignItems: 'center',
  },
  addMembersButtonDisabled: {
    opacity: 0.5,
  },
    addMembersButtonText: {
    color: '#1a2f35',
    fontSize: 16,
    fontWeight: '600',
  },
   checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3dd9d6',
  },
  checkboxSelected: {
    backgroundColor: '#3dd9d6',
  },
});