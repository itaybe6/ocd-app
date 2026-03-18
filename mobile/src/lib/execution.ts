import { supabase } from './supabase';
import { uploadCompressedImage } from './storage';

export type UnifiedKind = 'regular' | 'installation' | 'special';

export async function completeUnifiedJob(kind: UnifiedKind, id: string) {
  if (kind === 'regular') {
    const { error } = await supabase.from('jobs').update({ status: 'completed' }).eq('id', id);
    if (error) throw error;
    return;
  }
  if (kind === 'installation') {
    const { error } = await supabase.from('installation_jobs').update({ status: 'completed' }).eq('id', id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('special_jobs').update({ status: 'completed' }).eq('id', id);
  if (error) throw error;
}

export async function uploadJobServicePointImage(params: {
  jobId: string;
  jobServicePointId: string;
  servicePointId: string;
  localUri: string;
}) {
  const storagePath = `${params.jobId}/${params.servicePointId}-${Date.now()}.jpg`;
  await uploadCompressedImage({ localUri: params.localUri, path: storagePath });
  const { error } = await supabase
    .from('job_service_points')
    .update({ image_url: storagePath })
    .eq('id', params.jobServicePointId);
  if (error) throw error;
  return storagePath;
}

export async function uploadInstallationDeviceImage(params: {
  installationJobId: string;
  installationDeviceId: string;
  localUri: string;
}) {
  const storagePath = `${params.installationJobId}/${params.installationDeviceId}-${Date.now()}.jpg`;
  await uploadCompressedImage({ localUri: params.localUri, path: storagePath });
  const { error } = await supabase
    .from('installation_devices')
    .update({ image_url: storagePath })
    .eq('id', params.installationDeviceId);
  if (error) throw error;
  return storagePath;
}

export async function uploadSpecialJobImage(params: { specialJobId: string; localUri: string }) {
  const storagePath = `${params.specialJobId}/special-${Date.now()}.jpg`;
  await uploadCompressedImage({ localUri: params.localUri, path: storagePath });
  const { error } = await supabase.from('special_jobs').update({ image_url: storagePath }).eq('id', params.specialJobId);
  if (error) throw error;
  return storagePath;
}

