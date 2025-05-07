import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { v4 as uuidv4 } from 'uuid';
import { auth, db, storage } from '../../utils/firebase';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { User } from '../../types/user';
import { KeyboardAvoidingWrapper } from '../../components/KeyboardAvoidingWrapper';
import { useUser } from '../../context/UserContext';
import { Alert } from 'react-native';

export default function ProfileScreen() {
  const { user: contextUser, refreshUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: '',
    city: '',
    phoneNumber: '',
    myRides: '',
    bio: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setUser(userData);
        setFormData({
          fullName: userData.fullName || '',
          dateOfBirth: userData.dateOfBirth || '',
          city: userData.city || '',
          phoneNumber: userData.phoneNumber || '',
          myRides: userData.myRides || '',
          bio: userData.bio || '',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable photo access in Settings > Privacy > Photos.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        //mediaTypes: 'images' as ImagePicker.MediaTypeOptions,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];

        // Get file extension from URI or use default
        let fileType = 'jpeg';
        if (selectedImage.uri) {
          const mimeType = selectedImage.mimeType || 'image/jpeg';
          fileType = mimeType.split('/')[1];
          if (fileType === 'jpg') fileType = 'jpeg';
        }

        await uploadImage(selectedImage.uri, fileType);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri: string, fileType: string) => {
    if (!auth.currentUser) {
      setError('Not authenticated');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);

      // Create a unique filename
      const timestamp = Date.now();
      const filename = `profile-pictures/${auth.currentUser.uid}/${timestamp}-${uuidv4()}.${fileType}`;
      const storageRef = ref(storage, filename);

      // Handle image upload based on platform
      if (Platform.OS === 'web') {
        // For web platform
        const response = await fetch(uri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob, {
          contentType: `image/${fileType}`,
        });
      } else {
        // For iOS/Android
        const response = await fetch(uri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob, {
          contentType: `image/${fileType}`,
        });
      }

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update user profile
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        photoURL: downloadURL,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setUser(prev => prev ? { ...prev, photoURL: downloadURL } : null);

      // Refresh user context
      await refreshUser();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!auth.currentUser) return;

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        ...formData,
        updatedAt: new Date().toISOString(),
      });

      setUser(prev => prev ? { ...prev, ...formData } : null);
      await refreshUser(); // Refresh user context after saving changes
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    try {
      setPasswordError(null);

      if (!auth.currentUser?.email) return;

      // Validate password fields
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
        setPasswordError('All password fields are required');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmNewPassword) {
        setPasswordError('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters');
        return;
      }

      setSaving(true);

      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        passwordData.currentPassword
      );

      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordData.newPassword);

      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });

      setPasswordError('Password updated successfully!');
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordError('Current password is incorrect');
      } else {
        setPasswordError('Failed to update password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3dd9d6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        <ScrollView>
          <View style={styles.header}>
            <Image
              source={{
                uri: user?.photoURL || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
                cache: 'reload',
              }}
              style={styles.backgroundImage}
            />
            <View style={styles.overlay} />
          </View>

          <View style={styles.content}>
            <View style={styles.profileHeader}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                <Image
                  source={{
                    uri: user?.photoURL || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
                    cache: 'reload',
                  }}
                  style={styles.avatar}
                />
                {uploadingImage ? (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#3dd9d6" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                ) : (
                  <View style={styles.changePhotoOverlay}>
                    <Camera size={20} color="#ffffff" />
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.emailText}>{user?.email}</Text>
            </View>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Profile Information</Text>

              <Input
                label="Full Name"
                value={formData.fullName}
                onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                placeholder="Enter your full name"
              />

              <Input
                label="Date of Birth"
                value={formData.dateOfBirth}
                onChangeText={(text) => setFormData(prev => ({ ...prev, dateOfBirth: text }))}
                placeholder="YYYY-MM-DD"
              />

              <Input
                label="City"
                value={formData.city}
                onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                placeholder="Enter your city"
              />

              <Input
                label="Phone Number"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phoneNumber: text }))}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />

              <Input
                label="My Rides"
                value={formData.myRides}
                onChangeText={(text) => setFormData(prev => ({ ...prev, myRides: text }))}
                placeholder="Enter your rides (e.g., Harley Davidson Sportster, Triumph Bonneville)"
              />

              <Input
                label="Bio"
                value={formData.bio}
                onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
                placeholder="Tell us about yourself"
                multiline
                numberOfLines={4}
                style={styles.bioInput}
              />

              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Email Address</Text>
                <Text style={styles.emailValue}>{user.email}</Text>
              </View>

              <Button
                title={saving ? "Saving..." : "Save Changes"}
                onPress={handleSave}
                disabled={saving}
                style={styles.saveButton}
              />
            </View>

            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Change Password</Text>

              {passwordError && (
                <View style={[
                  styles.errorBanner,
                  passwordError.includes('successfully') && styles.successBanner
                ]}>
                  <Text style={[
                    styles.errorBannerText,
                    passwordError.includes('successfully') && styles.successText
                  ]}>
                    {passwordError}
                  </Text>
                </View>
              )}

              <Input
                label="Current Password"
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                placeholder="Enter current password"
                secureTextEntry
              />

              <Input
                label="New Password"
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                placeholder="Enter new password"
                secureTextEntry
              />

              <Input
                label="Confirm New Password"
                value={passwordData.confirmNewPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmNewPassword: text }))}
                placeholder="Confirm new password"
                secureTextEntry
              />

              <Button
                title={saving ? "Updating Password..." : "Update Password"}
                onPress={handlePasswordUpdate}
                disabled={saving}
                variant="secondary"
                style={styles.passwordButton}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2f35',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a2f35',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a2f35',
    padding: 20,
  },
  errorText: {
    color: '#FF6B4A',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    height: 200,
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    flex: 1,
    marginTop: -60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#1a2f35',
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#3dd9d6',
    marginTop: -60,
    overflow: 'hidden',
    backgroundColor: '#243c44',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  emailText: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 12,
    opacity: 0.8,
  },
  form: {
    backgroundColor: '#243c44',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3dd9d6',
    marginBottom: 20,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  emailContainer: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(61, 217, 214, 0.2)',
  },
  emailLabel: {
    fontSize: 14,
    color: '#3dd9d6',
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
  },
  saveButton: {
    marginTop: 16,
  },
  passwordButton: {
    marginTop: 16,
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderColor: '#3dd9d6',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B4A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBanner: {
    backgroundColor: 'rgba(61, 217, 214, 0.1)',
    borderColor: '#3dd9d6',
  },
  errorBannerText: {
    color: '#FF6B4A',
    fontSize: 14,
    textAlign: 'center',
  },
  successText: {
    color: '#3dd9d6',
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  changePhotoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
  },
});