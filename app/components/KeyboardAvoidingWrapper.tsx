// import React, { ReactNode } from 'react';
// import { 
//   KeyboardAvoidingView, 
//   ScrollView, 
//   TouchableWithoutFeedback,
//   Keyboard,
//   Platform,
//   StyleSheet,
//   ViewStyle
// } from 'react-native';

// interface Props {
//   children: ReactNode;
//   style?: ViewStyle;
// }

// export function KeyboardAvoidingWrapper({ children, style }: Props) {
//   return (
//     <KeyboardAvoidingView
//       style={[styles.container, style]}
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//       keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
//     >
//       <ScrollView 
//         contentContainerStyle={styles.scrollView}
//         keyboardShouldPersistTaps="handled"
//       >
//         <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
//           {children}
//         </TouchableWithoutFeedback>
//       </ScrollView>
//     </KeyboardAvoidingView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   scrollView: {
//     flexGrow: 1,
//   },
// });


import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  ViewStyle,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

export function KeyboardAvoidingWrapper({ children, style }: Props) {
  const dismissKeyboardOnTouchOutside = () => {
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0} // Adjust based on header height
    >
      <TouchableWithoutFeedback onPress={dismissKeyboardOnTouchOutside}>
        <ScrollView
          contentContainerStyle={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});
