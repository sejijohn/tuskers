import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { db } from '../../utils/firebase';
import { Button } from '../../components/Button';
import { User } from '../../types/user';
import { useUser } from '../../context/UserContext';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export default function AdminScreen() {
  const { user: currentUser } = useUser();
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<{ [key: string]: boolean }>({});
  const [deletionStatus, setDeletionStatus] = useState<{ [key: string]: boolean }>({});

  // Check if user is admin, if not redirect to home
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/(tabs)/profile');
      return;
    }
  }, [currentUser]);

  // If not admin, don't render the admin content
  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const fetchPendingUsers = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('approved', '==', false),
        where('deleted', '==', false),
        where('role', '==', 'member')
      );

      const querySnapshot = await getDocs(q);
      const users: User[] = [];

      querySnapshot.forEach((doc) => {
        users.push({ ...doc.data(), id: doc.id } as User);
      });

      // Sort users by createdAt in descending order (most recent first)
      const sortedUsers = users.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setPendingUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      setApprovalStatus(prev => ({ ...prev, [userId]: true }));

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        approved: true,
        updatedAt: new Date().toISOString(),
      });

      setPendingUsers((current) => current.filter(user => user.id !== userId));
      setApprovalStatus(prev => ({ ...prev, [userId]: false }));
    } catch (error) {
      console.error('Error approving user:', error);
      setApprovalStatus(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setDeletionStatus(prev => ({ ...prev, [userId]: true }));

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        deleted: true,
        updatedAt: new Date().toISOString(),
      });

      setPendingUsers((current) => current.filter(user => user.id !== userId));
      setDeletionStatus(prev => ({ ...prev, [userId]: false }));
    } catch (error) {
      console.error('Error removing user:', error);
      setDeletionStatus(prev => ({ ...prev, [userId]: false }));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingUsers();
  };

  // useEffect(() => {
  //   fetchPendingUsers();
  // }, []);
  useFocusEffect(
    useCallback(() => {
      fetchPendingUsers();
    }, [])
  );
  useEffect(() => {
    const appState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        fetchPendingUsers();
      }
    });
    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Member Approvals</Text>
        <Text style={styles.subtitle}>
          {pendingUsers.length} pending approval{pendingUsers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {pendingUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No pending approvals</Text>
          </View>
        ) : (
          pendingUsers.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.fullName}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                {user.myRides ? (
                  <Text style={styles.userRides}>
                    Rides: {user.myRides}
                  </Text>
                ) : null}
                <Text style={styles.userDate}>
                  Joined: {new Date(user.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.actions}>
                <Button
                  title={deletionStatus[user.id] ? "Removing..." : "Remove"}
                  onPress={() => handleRemove(user.id)}
                  disabled={deletionStatus[user.id] || approvalStatus[user.id]}
                  variant="secondary"
                  style={[styles.actionButton, styles.removeButton]}
                />
                <Button
                  title={approvalStatus[user.id] ? "Approving..." : "Approve"}
                  onPress={() => handleApprove(user.id)}
                  disabled={approvalStatus[user.id] || deletionStatus[user.id]}
                  style={styles.actionButton}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  header: {
    padding: 16,
    backgroundColor: '#243c44',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#3dd9d6',
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
  },
  list: {
    flex: 1,
    padding: 8,
  },
  userCard: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    width: 'auto',
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    color: '#3dd9d6',
  },
  userEmail: {
    fontSize: 13,
    color: '#ffffff',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minWidth: 90,
  },
  removeButton: {
    borderColor: '#FF6B4A',
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#3dd9d6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#243c44',
    borderRadius: 12,
    marginTop: 16,
    marginHorizontal: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
  },
  userRides: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 2,
  },
});