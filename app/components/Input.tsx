import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor="rgba(255, 107, 74, 0.6)"
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#FF6B4A',
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 74, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 107, 74, 0.1)',
    color: '#FF6B4A',
  },
  inputError: {
    borderColor: '#FF6B4A',
    backgroundColor: 'rgba(255, 107, 74, 0.2)',
  },
  errorText: {
    color: '#FF6B4A',
    fontSize: 14,
    marginTop: 4,
  },
});