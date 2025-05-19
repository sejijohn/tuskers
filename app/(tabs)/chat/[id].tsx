import { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, Modal, ViewToken, Linking, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Send, Users, X } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Message, Chat } from '../../types/chat';
import { User } from '../../types/user';
import ParsedText from 'react-native-parsed-text';
import { useRouter } from 'expo-router';

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
  const readMessagesRef = useRef<Set<string>>(new Set());
  const statusPriority: Record<string, number> = {
    sent: 1,
    delivered: 2,
    read: 3,
  };
  const memberUnsubscribes = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!id) return;

    // Fetch chat details
    const fetchChat = async () => {
      try {
        const chatDoc = await getDoc(doc(db, 'chats', id as string));
        if (!chatDoc.exists()) {
          Alert.alert(
            'Chat Not Found',
            'This chat may have been deleted.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/chat'), // go back to chat list
              },
            ]
          );
          return;
        } else {
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          setChat(chatData);
          if (chatData.type === 'group') {
            // Clear any previous listeners
            Object.values(memberUnsubscribes.current).forEach((unsub) => unsub());
            memberUnsubscribes.current = {};

            const newMembers: Record<string, User> = {};

            chatData.participants.forEach((participantId) => {
              const userRef = doc(db, 'users', participantId);
              const unsubscribe = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                  const updatedUser = { id: docSnap.id, ...docSnap.data() } as User;
                  newMembers[docSnap.id] = updatedUser;
                  setMembers((prevMembers) => {
                    const membersMap = Object.fromEntries(prevMembers.map((m) => [m.id, m]));
                    membersMap[updatedUser.id] = updatedUser;
                    return Object.values(membersMap);
                  });
                }
              });

              memberUnsubscribes.current[participantId] = unsubscribe;
            });
          }
        }
        setLoading(false);

      } catch (error) {
        Alert.alert(
          'Chat Not Found',
          'This chat may have been deleted.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/chat'), // go back to chat list
            },
          ]
        );


      }

    };

    fetchChat();

    // Subscribe to messages
    const q = query(
      collection(db, 'chats', id as string, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<Message, 'id'>;


        const existing = messages.find((m) => m.id === docSnap.id);
        const incomingStatusMap = data.statusMap || {};
        let mergedStatusMap = { ...incomingStatusMap };
        if (existing && existing.statusMap) {
          for (const [uid, oldStatus] of Object.entries(existing.statusMap)) {
            const currentStatus = incomingStatusMap[uid] || 'sent';
            if (statusPriority[oldStatus] > statusPriority[currentStatus]) {
              mergedStatusMap[uid] = oldStatus;
            }
          }
        }

        const msg: Message = {
          id: docSnap.id,
          ...data,
          statusMap: mergedStatusMap,
        };

        messageList.push(msg);
        if (user?.id && msg.senderId !== user.id) {
          // If sender is not the current user and the message hasn't been delivered yet.
          if (!msg.statusMap || msg.statusMap[user.id] !== 'delivered') {
            const messageRef = doc(db, 'chats', id as string, 'messages', docSnap.id);
            updateDoc(messageRef, {
              [`statusMap.${user.id}`]: 'delivered',
            }).catch((err) => console.error('Failed to update statusMap:', err));
          }
        } else if (msg.senderId === user?.id && msg.statusMap) {
          // Handle sender's message status updates here if needed
          if (!msg.statusMap[user.id]) {
            const messageRef = doc(db, 'chats', id as string, 'messages', docSnap.id);
            updateDoc(messageRef, {
              [`statusMap.${user.id}`]: 'sent',
            }).catch((err) => console.error('Failed to update sender status:', err));
          }
        }

      });
      setMessages(messageList);
    });

    return () => { unsubscribe(); Object.values(memberUnsubscribes.current).forEach((unsub) => unsub()); }
  }, [id]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      if (!user?.id) return;

      viewableItems.forEach(({ item }) => {
        const msg = item as Message;

        const alreadyMarked = readMessagesRef.current.has(msg.id);
        const shouldMarkAsRead =
          msg.senderId !== user.id &&
          msg.statusMap?.[user.id] !== 'read' &&
          !alreadyMarked;

        if (shouldMarkAsRead) {
          const messageRef = doc(db, 'chats', id as string, 'messages', msg.id);
          updateDoc(messageRef, {
            [`statusMap.${user.id}`]: 'read',
          })
            .then(() => {
              readMessagesRef.current.add(msg.id);
            })
            .catch((err) => console.error('Failed to update message to read:', err));
        }
      });
    },
    [user?.id, id]
  );

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chat) return;

    const messageData: Omit<Message, 'id'> = {
      content: newMessage.trim(),
      senderId: user?.id,
      senderName: user?.fullName,
      senderPhotoURL: user?.photoURL,
      timestamp: new Date().toISOString(),
      type: 'text',
      statusMap: {
        [user.id]: 'sent' // only sender has it as 'sent' initially
      },
      seenBy: []
    };

    try {
      // Add message to subcollection
      await addDoc(collection(db, 'chats', id as string, 'messages'), messageData);

      // Update chat's last message
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: messageData,
        updatedAt: new Date().toISOString(),
      });

      setNewMessage('');

      // Scroll to bottom
      flatListRef.current?.scrollToEnd();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === user?.id;
    //const userStatus = user?.id && item.statusMap ? item.statusMap[user.id] : undefined;
    let userStatus: string | undefined = undefined;


    if (isOwnMessage && item.statusMap) {

      const otherStatuses = Object.entries(item.statusMap)
        .filter(([uid]) => uid !== user?.id)  // ignore self
        .map(([, status]) => status);


      if (otherStatuses.some(status => status === 'read')) {
        userStatus = 'read';
      } else if (otherStatuses.some(status => status === 'delivered')) {
        userStatus = 'delivered';
      } else if (otherStatuses.some(status => status === 'sent')) {
        userStatus = 'sent';
      } else {
        userStatus = undefined;
      }

      const highestStatus = otherStatuses.reduce((highest, current) => {
        return statusPriority[current] > statusPriority[highest] ? current : highest;
      }, 'sent');

      userStatus = highestStatus;
    } else {
      userStatus = item.statusMap?.[user?.id ?? ''];
    }

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
          {/* <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text> */}
          <ParsedText
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}
            parse={[
              {
                type: 'url',
                style: {
                  color: isOwnMessage ? '#269999' : '#3dd9d6', // Darker teal for own messages
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
          {/* Updated message status rendering */}
          {isOwnMessage && (
            <Text style={styles.messageStatus}>
              {userStatus === 'read'
                ? 'Delivered'
                : userStatus === 'delivered'
                  ? 'Read'
                  : 'Sent'}
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
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80, // only mark as read if 80% visible
  };
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {chat?.type === 'group' && (
        <TouchableOpacity
          style={styles.membersButton}
          onPress={() => setShowMembers(true)}
        >
          <Users size={20} color="#3dd9d6" />
          <Text style={styles.membersButtonText}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />



      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Send size={20} color={newMessage.trim() ? '#3dd9d6' : 'rgba(61, 217, 214, 0.5)'} />
        </TouchableOpacity>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
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
    fontSize: 8,  // Adjust the font size as needed
    color: 'gray', // Adjust the color as needed
    marginTop: 5,  // Add some space if needed
  },
});