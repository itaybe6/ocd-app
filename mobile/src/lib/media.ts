import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

type PickImageOptions = {
  /** 0–1; lower = smaller file from picker (upload path still recompresses in `uploadCompressedImage`). */
  quality?: number;
};

export async function pickImageFromLibrary(options?: PickImageOptions): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Toast.show({ type: 'error', text1: 'אין הרשאה לגלריה' });
    return null;
  }

  const quality = options?.quality ?? 1;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality,
  });

  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

