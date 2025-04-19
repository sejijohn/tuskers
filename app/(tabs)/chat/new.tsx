import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, Image, Switch, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Users } from 'lucide-react-native';
import { db } from '../../utils/firebase';
import { useUser } from '../../context/UserContext';
import { User } from '../../types/user';
import { Button } from '../../components/Button';
import { v4 as uuidv4 } from 'uuid';

export default function NewChat() {
  const router = useRouter();
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('approved', '==', true),
        where('deleted', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const usersList: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = { ...doc.data(), id: doc.id } as User;
        if (userData.id !== currentUser?.id) {
          usersList.push(userData);
        }
      });
      
      setUsers(usersList.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createChat = async () => {
    if (!currentUser || selectedUsers.length === 0) return;

    try {
      setCreating(true);

      const chatData = {
        type: isGroupChat ? 'group' : 'direct',
        participants: [currentUser.id, ...selectedUsers],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(isGroupChat ? { name: groupName } : {}),
      };

      const chatRef = await addDoc(collection(db, 'chats'), chatData);
      router.push(`/chat/${chatRef.id}`);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        selectedUsers.includes(item.id) && styles.selectedUser
      ]}
      onPress={() => toggleUserSelection(item.id)}
    >
      <Image
        source={{ 
          uri: item.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80'
        }}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <View style={[
        styles.checkbox,
        selectedUsers.includes(item.id) && styles.checkboxSelected
      ]} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
        </View>

        <View style={styles.groupToggle}>
          <View style={styles.groupToggleLeft}>
            <Users size={20} color="#3dd9d6" />
            <Text style={styles.groupToggleText}>Create Group Chat</Text>
          </View>
          <Switch
            value={isGroupChat}
            onValueChange={setIsGroupChat}
            trackColor={{ false: '#243c44', true: '#3dd9d6' }}
            thumbColor={isGroupChat ? '#ffffff' : '#3dd9d6'}
          />
        </View>

        {isGroupChat && (
          <View style={styles.groupNameContainer}>
            <TextInput
              style={styles.groupNameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
        )}

        {loading ? (
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.userList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title={creating ? 'Creating...' : 'Create Chat'}
          onPress={createChat}
          disabled={
            creating || 
            selectedUsers.length === 0 || 
            (isGroupChat && !groupName.trim())
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#243c44',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  searchInput: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#243c44',
    marginBottom: 1,
  },
  groupToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupToggleText: {
    fontSize: 16,
    color: '#3dd9d6',
  },
  groupNameContainer: {
    padding: 16,
    backgroundColor: '#243c44',
    marginBottom: 1,
  },
  groupNameInput: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  userList: {
    padding: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#243c44',
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedUser: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.7,
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#3dd9d6',
  },
  footer: {
    padding: 16,
    backgroundColor: '#243c44',
    borderTopWidth: 1,
    borderTopColor: 'rgba(61, 217, 214, 0.1)',
  },
});