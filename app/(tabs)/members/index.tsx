import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, Image } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import { User } from '../../types/user';
import { useUser } from '../../context/UserContext';
import { Shield, Mail, MapPin, Phone, Bike } from 'lucide-react-native';

export default function MembersScreen() {
  const { user: currentUser } = useUser();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    try {
      setError(null);
      const q = query(
        collection(db, 'users'),
        where('approved', '==', true),
        where('deleted', '==', false)
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const users: User[] = [];
          snapshot.forEach((doc) => {
            const userData = { ...doc.data(), id: doc.id } as User;
            users.push(userData);
          });

          // Sort users by fullName
          const sortedUsers = users.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setMembers(sortedUsers);
          setLoading(false);
          setRefreshing(false);
        },
        (error) => {
          console.error('Error fetching members:', error);
          setError('Failed to load members. Please try again.');
          setLoading(false);
          setRefreshing(false);
        }
      );

      // Cleanup subscription on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up members listener:', error);
      setError('Failed to load members. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    // The onSnapshot listener will automatically refresh the data
  };

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Please log in to view members</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading members...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Members Directory</Text>
        <Text style={styles.subtitle}>
          {members.length} active member{members.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <ScrollView
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No members found</Text>
          </View>
        ) : (
          members.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <Image
                  source={{
                    uri: member.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80'
                  }}
                  style={styles.avatar}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.fullName}</Text>
                  <View style={styles.roleContainer}>
                    <Shield size={14} color={member.role === 'admin' ? '#3dd9d6' : '#3dd9d6'} />
                    <Text style={styles.roleText}>
                      {member.role === 'admin' ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailsContainer}>
                {member.email && (
                  <View style={styles.detailRow}>
                    <Mail size={16} color="#ffffff" />
                    <Text style={styles.detailText}>{member.email}</Text>
                  </View>
                )}
                {!!member.city && (
                  <View style={styles.detailRow}>
                    <MapPin size={16} color="#ffffff" />
                    <Text style={styles.detailText}>{member.city}</Text>
                  </View>
                )}
                {!!member.phoneNumber && (
                  <View style={styles.detailRow}>
                    <Phone size={16} color="#ffffff" />
                    <Text style={styles.detailText}>{member.phoneNumber}</Text>
                  </View>
                )}
                {currentUser.role === "admin" && (
                  <View style={styles.detailRow}>
                    <Bike size={16} color="#ffffff" />
                    <Text style={styles.detailText}>
                      Rides Participated: {member.rideCounter != null ? String(member.rideCounter) : '0'}
                    </Text>
                  </View>
                )}

              </View>

              {!!member.myRides && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Rides</Text>
                  <Text style={styles.infoText}>{member.myRides}</Text>
                </View>
              )}

              {!!member.bio && (
                <View style={[styles.infoCard, styles.bioCard]}>
                  <Text style={styles.infoLabel}>Bio</Text>
                  <Text style={styles.infoText}>{member.bio}</Text>
                </View>
              )}
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
  memberCard: {
    backgroundColor: '#243c44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    gap: 16,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#3dd9d6',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    color: '#3dd9d6',
    marginLeft: 4,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(61, 217, 214, 0.2)',
  },
  bioCard: {
    backgroundColor: 'rgba(61, 217, 214, 0.05)',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3dd9d6',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
    color: '#3dd9d6',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B4A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  errorText: {
    color: '#FF6B4A',
    fontSize: 14,
    textAlign: 'center',
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
});