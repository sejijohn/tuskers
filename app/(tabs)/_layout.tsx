import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, LogOut, Shield, List, CircleUser as UserCircle, MessageSquare } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useUser } from '../context/UserContext';

export default function TabLayout() {
  const { user, loading, setUser } = useUser();
  const router = useRouter();
  console.log('Router:', router);
console.log('Home Icon:', Home);

  const handleSignOut = async () => {
    try {
      setUser(null);
      await signOut(auth);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading || !user) {
    return null;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <Tabs 
      screenOptions={{ 
        header: () => (
          <View style={styles.headerContainer}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ 
                      uri: user?.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80'
                    }}
                    style={styles.headerImage}
                  />
                </View>
                <View style={styles.titleContainer}>
                  <Text style={styles.headerTitle}>Tuskers</Text>
                  <View style={[
                    styles.roleTag,
                    isAdmin ? styles.adminTag : styles.memberTag
                  ]}>
                    <Shield size={14} color="#3dd9d6" />
                    <Text style={[
                      styles.roleText,
                      isAdmin ? styles.adminText : styles.memberText
                    ]}>
                      {isAdmin ? 'Admin' : 'Member'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
                <LogOut size={20} color="#FF6B4A" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ),
        tabBarStyle: { 
          backgroundColor: '#243c44',
          borderTopWidth: 1,
          borderTopColor: 'rgba(61, 217, 214, 0.1)',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#3dd9d6',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => {
            console.log('Rendering Home Icon');
          return  <Home size={size} color={color} />},
        }}
      />
      <Tabs.Screen
        name="members/index"
        options={{
          title: 'Directory',
          tabBarIcon: ({ color, size }) => {
            console.log('Rendering Directory Icon');
            return <List size={size} color={color} />},
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => {
            console.log('Rendering Chat Icon');
            return <MessageSquare size={size} color={color} />},
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'My Profile',
          tabBarIcon: ({ color, size }) => {
            console.log('Rendering Profile Icon');
            return <UserCircle size={size} color={color} />},
        }}
      />
      {isAdmin && (
        <Tabs.Screen
          name="admin/index"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => {
              console.log('Rendering Admin Icon');
              return <Shield size={size} color={color} />},
          }}
        />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#1a2f35',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61, 217, 214, 0.1)',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a2f35',
    height: 60,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#3dd9d6',
    overflow: 'hidden',
    marginRight: 12,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  titleContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  adminTag: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderColor: '#3dd9d6',
  },
  memberTag: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderColor: '#3dd9d6',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  adminText: {
    color: '#3dd9d6',
  },
  memberText: {
    color: '#3dd9d6',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B4A',
  },
  signOutText: {
    marginLeft: 6,
    color: '#FF6B4A',
    fontWeight: '500',
    fontSize: 13,
  },
});