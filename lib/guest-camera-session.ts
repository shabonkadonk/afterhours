export const LAST_GUEST_ROLL_KEY = "afterhours-guest-last-roll";
const GUEST_CAMERA_SETUP_KEY = "afterhours-guest-camera-setup-complete";

export function hasGuestCameraSetup() {
  try { return window.localStorage.getItem(GUEST_CAMERA_SETUP_KEY) === "1"; }
  catch { return false; }
}

export function rememberGuestCameraSetup() {
  try { window.localStorage.setItem(GUEST_CAMERA_SETUP_KEY, "1"); }
  catch { /* Camera setup can continue when local storage is unavailable. */ }
}

export function guestCameraFrameLimit(rollPhotoLimit: number, participantCount: number) {
  return Math.max(1, Math.ceil(rollPhotoLimit / Math.max(1, participantCount)));
}

export function guestInviteStorageKey(kind: "token" | "code", value: string) {
  const normalized = kind === "token" ? value.toLowerCase() : value.toUpperCase();
  return `afterhours-guest-invite-${kind}-${normalized}`;
}

export function rememberGuestRoll(rollId: string, inviteKind?: "token" | "code", inviteValue?: string, userId?: string) {
  try {
    window.localStorage.setItem(LAST_GUEST_ROLL_KEY, rollId);
    if (inviteKind && inviteValue) window.localStorage.setItem(guestInviteStorageKey(inviteKind, inviteValue), JSON.stringify({ rollId, userId }));
  } catch {
    // The server membership still grants access if this browser blocks local storage.
  }
}

export function getRememberedGuestRoll(inviteKind: "token" | "code", inviteValue: string, userId: string) {
  try {
    const value = window.localStorage.getItem(guestInviteStorageKey(inviteKind, inviteValue));
    if (!value) return null;
    const remembered = JSON.parse(value) as { rollId?: unknown; userId?: unknown };
    return typeof remembered.rollId === "string" && remembered.userId === userId ? remembered.rollId : null;
  }
  catch { return null; }
}
