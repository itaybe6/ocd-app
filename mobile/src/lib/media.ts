import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

export async function pickImageFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Toast.show({ type: 'error', text1: 'אין הרשאה לגלריה' });
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 1,
  });

  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

