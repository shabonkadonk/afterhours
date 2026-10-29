import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Photo, Roll } from "@/lib/types";

type RollInput = { name: string; durationHours: number; photoLimit: number; theme: string };
type PhotoInput = (Omit<Photo, "id" | "at" | "by"> & { uploadId?: string })[];

function backendError(error: { message: string; details?: string | null; hint?: string | null }) {
  return new Error([error.message, error.details, error.hint].filter(Boolean).join(" "));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function createPhotoId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function loadCloudRolls(supabase: SupabaseClient, user: User): Promise<Roll[]> {
  const { data: myMemberships, error: memberError } = await supabase
    .from("roll_members").select("roll_id").eq("user_id", user.id);
  if (memberError) throw backendError(memberError);
  const rollIds = (myMemberships ?? []).map((member) => member.roll_id as string);
  if (!rollIds.length) return [];

  const { data: initialRolls, error: rollsError } = await supabase
    .from("rolls").select("*").in("id", rollIds).order("created_at", { ascending: false });
  if (rollsError) throw backendError(rollsError);

  const expired = (initialRolls ?? []).filter((roll) => roll.status === "active" && Date.parse(roll.ends_at) <= Date.now());
  if (expired.length) {
    const closeResults = await Promise.all(expired.map((roll) => supabase.rpc("close_roll", { target_roll_id: roll.id })));
    const closeError = closeResults.find((result) => result.error)?.error;
    if (closeError) throw backendError(closeError);
  }
  const { data: rolls, error: refreshError } = expired.length
    ? await supabase.from("rolls").select("*").in("id", rollIds).order("created_at", { ascending: false })
    : { data: initialRolls, error: null };
  if (refreshError) throw backendError(refreshError);

  const [{ data: members, error: membersError }, { data: photos, error: photosError }] = await Promise.all([
    supabase.from("roll_members").select("roll_id,user_id,display_name,role").in("roll_id", rollIds),
    supabase.from("photos").select("id,roll_id,uploaded_by,object_path,caption,filter,filter_version,date_stamp_year,created_at").in("roll_id", rollIds).order("created_at"),
  ]);
  if (membersError) throw backendError(membersError);
  if (photosError) throw backendError(photosError);

  const revealedPaths = (photos ?? []).filter((photo) => rolls?.find((roll) => roll.id === photo.roll_id)?.status === "revealed").map((photo) => photo.object_path as string);
  const signedByPath = new Map<string, string>();
  if (revealedPaths.length) {
    const { data: signed, error } = await supabase.storage.from("roll-photos").createSignedUrls(revealedPaths, 60 * 60);
    // Signing a photo is a display concern, not a roll-data or upload failure.
    // Match successful responses by request order; Storage can return a per-file
    // error while still returning valid links for other photos in the batch.
    if (error) {
      console.warn("Could not sign a batch of revealed photo URLs; retrying individually.", error.message);
    } else {
      signed?.forEach((item, index) => {
        const path = revealedPaths[index];
        if (path && item.signedUrl) signedByPath.set(path, item.signedUrl);
        else if (item.error) console.warn(`Could not sign revealed photo ${path ?? index}:`, item.error);
      });
    }

    const missingPaths = revealedPaths.filter((path) => !signedByPath.has(path));
    const retries = await Promise.all(missingPaths.map(async (path) => {
      const { data: item, error: retryError } = await supabase.storage.from("roll-photos").createSignedUrl(path, 60 * 60);
      if (retryError || !item?.signedUrl) {
        console.warn(`Could not sign revealed photo ${path}:`, retryError?.message ?? "No signed URL returned.");
        return null;
      }
      return [path, item.signedUrl] as const;
    }));
    retries.forEach((entry) => { if (entry) signedByPath.set(entry[0], entry[1]); });
  }

  return (rolls ?? []).map((row) => {
    const people = (members ?? []).filter((member) => member.roll_id === row.id);
    const rollPhotos = (photos ?? []).filter((photo) => photo.roll_id === row.id).map((photo) => {
      const uploader = people.find((member) => member.user_id === photo.uploaded_by)?.display_name || "A friend";
      return {
        id: photo.id as string,
        src: signedByPath.get(photo.object_path as string) ?? "",
        caption: photo.caption as string,
        by: photo.uploaded_by === user.id ? "You" : uploader,
        at: photo.created_at as string,
        filter: photo.filter as string | undefined,
        filterVersion: photo.filter_version as number | undefined,
        dateStampYear: photo.date_stamp_year as Photo["dateStampYear"],
      };
    });
    return {
      id: row.id as string,
      ownerId: row.owner_id as string,
      name: row.name as string,
      theme: row.theme as string,
      status: row.status as Roll["status"],
      createdAt: row.created_at as string,
      endsAt: row.ends_at as string,
      photoLimit: row.photo_limit as number,
      inviteCode: row.invite_code as string,
      participants: people.map((person) => ({ name: person.display_name || "Friend", initials: initials(person.display_name || "Friend") })),
      photos: rollPhotos,
    };
  });
}

export async function createCloudRoll(supabase: SupabaseClient, user: User, input: RollInput): Promise<Roll> {
  const { data, error } = await supabase.from("rolls").insert({
    owner_id: user.id,
    name: input.name,
    theme: input.theme,
    photo_limit: input.photoLimit,
    ends_at: new Date(Date.now() + input.durationHours * 60 * 60 * 1000).toISOString(),
  }).select("*").single();
  if (error) throw backendError(error);
  return {
    id: data.id, ownerId: data.owner_id, name: data.name, theme: data.theme, status: data.status,
    createdAt: data.created_at, endsAt: data.ends_at, photoLimit: data.photo_limit,
    inviteCode: data.invite_code,
    participants: [{ name: user.user_metadata.display_name || "You", initials: initials(user.user_metadata.display_name || "You") }],
    photos: [],
  };
}

export async function addCloudPhotos(supabase: SupabaseClient, user: User, rollId: string, additions: PhotoInput) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rollId)) {
    throw new Error("This is a local demo roll, not a cloud roll. Create a new roll while signed in to upload shared photos.");
  }
  const { data: roll, error: rollError } = await supabase.from("rolls")
    .select("status,photo_count,photo_limit").eq("id", rollId).maybeSingle();
  if (rollError) throw backendError(rollError);
  if (!roll) throw new Error("This roll is not shared with this account. Join it with the invite code first.");
  if (roll.status !== "active") throw new Error("This roll is already closed, so it can’t accept photos.");
  if (roll.photo_count + additions.length > roll.photo_limit) throw new Error("There aren’t enough frames left for these photos.");

  const [memberResult, ownerResult] = await Promise.all([
    supabase.rpc("is_roll_member", { target_roll_id: rollId }),
    supabase.rpc("is_roll_owner", { target_roll_id: rollId }),
  ]);
  if (memberResult.error) throw backendError(memberResult.error);
  if (ownerResult.error) throw backendError(ownerResult.error);
  const isMember = memberResult.data === true;
  const isOwner = ownerResult.data === true;
  if (!isMember && !isOwner) throw new Error("This account can open the roll but is missing its roll membership. Ask the owner to share a fresh invite code, then join the roll again.");

  for (const item of additions) {
    const response = await fetch(item.src);
    if (!response.ok) throw new Error("Could not read the prepared photo.");
    const blob = await response.blob();
    const photoId = item.uploadId ?? createPhotoId();
    const path = `${user.id}/${rollId}/${photoId}.jpg`;
    const { data: existingPhoto, error: existingError } = await supabase.from("photos")
      .select("id").eq("id", photoId).maybeSingle();
    if (existingError) throw backendError(existingError);
    if (existingPhoto) continue;
    const { error: uploadError } = await supabase.storage.from("roll-photos").upload(path, blob, {
      contentType: "image/jpeg", upsert: false,
    });
    const existingObject = uploadError && /already exists/i.test(uploadError.message);
    if (uploadError && !existingObject) throw new Error(`Photo storage upload was rejected (account recognized as ${isOwner ? "owner" : "member"}; roll active; ${roll.photo_count}/${roll.photo_limit} frames used): ${backendError(uploadError).message}`);

    const { error: insertError } = await supabase.from("photos").insert({
      id: photoId,
      roll_id: rollId,
      uploaded_by: user.id,
      object_path: path,
      caption: item.caption,
      filter: item.filter,
      filter_version: item.filterVersion,
      date_stamp_year: item.dateStampYear ?? null,
    });
    if (insertError) {
      await supabase.storage.from("roll-photos").remove([path]);
      throw new Error(`Photo record insert was rejected: ${backendError(insertError).message}`);
    }
  }
}

export async function deleteCloudRoll(supabase: SupabaseClient, rollId: string) {
  const { data: photos, error: photoError } = await supabase.from("photos").select("object_path").eq("roll_id", rollId);
  if (photoError) throw backendError(photoError);
  const paths = (photos ?? []).map((photo) => photo.object_path as string);
  if (paths.length) {
    const { error } = await supabase.storage.from("roll-photos").remove(paths);
    if (error) throw backendError(error);
  }
  const { error } = await supabase.from("rolls").delete().eq("id", rollId);
  if (error) throw backendError(error);
}

export async function closeCloudRoll(supabase: SupabaseClient, rollId: string) {
  const { error } = await supabase.rpc("close_roll", { target_roll_id: rollId });
  if (error) throw backendError(error);
}

export async function joinCloudRoll(supabase: SupabaseClient, inviteCode: string, displayName: string) {
  const { data, error } = await supabase.rpc("join_roll_by_invite_code", {
    code: inviteCode.trim().toUpperCase(),
    member_name: displayName.trim(),
  });
  if (error) throw backendError(error);
  return data as string;
}
