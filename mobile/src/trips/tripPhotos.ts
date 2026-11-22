import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

export async function pickTripPhotos(): Promise<ImagePickerAsset[]> {
  const { launchImageLibraryAsync } = await import('expo-image-picker');
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 12,
    quality: 0.8,
  });
  return result.canceled ? [] : result.assets;
}

function photoDirectory(ownerId: string, tripId: string) {
  return new Directory(
    Paths.document,
    'trip-memories',
    encodeURIComponent(ownerId),
    encodeURIComponent(tripId),
  );
}

export function listTripPhotos(ownerId: string, tripId: string): string[] {
  const directory = photoDirectory(ownerId, tripId);
  if (!directory.exists) return [];
  return directory
    .list()
    .filter((item): item is File => item instanceof File)
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((file) => file.uri);
}

export async function addTripPhotos(ownerId: string, tripId: string, photos: ImagePickerAsset[]) {
  const directory = photoDirectory(ownerId, tripId);
  directory.create({ idempotent: true, intermediates: true });
  for (const photo of photos) {
    const source = new File(photo.uri);
    const extension = /^\.[a-z0-9]{1,8}$/i.test(source.extension) ? source.extension : '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    await source.copy(new File(directory, name));
  }
}

export function removeTripPhotos(ownerId: string, tripId: string) {
  const directory = photoDirectory(ownerId, tripId);
  if (directory.exists) directory.delete();
}
