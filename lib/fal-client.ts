export async function isFalConfigured() {
  try {
    const response = await fetch("/api/flux/edit", { cache: "no-store" });
    if (!response.ok) return false;
    const result = await response.json() as { configured?: boolean };
    return result.configured === true;
  } catch {
    return false;
  }
}

export async function editPhotoWithFal(fileData: string, width: number, height: number) {
  const response = await fetch("/api/flux/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: fileData, width, height }),
  });
  const result = await response.json() as { image?: string; error?: string };
  if (!response.ok || !result.image) {
    throw new Error(result.error ?? "FLUX.2 Flash could not edit this photo. Try again.");
  }
  return result.image;
}
