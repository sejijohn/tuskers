import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Send, Users, X } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { Message, Chat } from '../../types/chat';
import { User } from '../../types/user';

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;

    // Fetch chat details
    const fetchChat = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', id as string));
      if (chatDoc.exists()) {
        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        setChat(chatData);

        // Fetch members if it's a group chat
        if (chatData.type === 'group') {
          const memberPromises = chatData.participants.map(async (participantId) => {
            const userDoc = await getDoc(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              return { id: userDoc.id, ...userDoc.data() } as User;
            }
            return null;
          });

          const memberData = await Promise.all(memberPromises);
          setMembers(memberData.filter((m): m is User => m !== null));
        }
      }
      setLoading(false);
    };

    fetchChat();

    // Subscribe to messages
    const q = query(
      collection(db, 'chats', id as string, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList: Message[] = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messageList);
    });

    return () => unsubscribe();
  }, [id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chat) return;

    const messageData: Omit<Message, 'id'> = {
      content: newMessage.trim(),
      senderId: user.id,
      senderName: user.fullName,
      senderPhotoURL: user.photoURL,
      timestamp: new Date().toISOString(),
      type: 'text',
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
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
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
});