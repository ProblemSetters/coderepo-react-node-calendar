const baseUrl = import.meta.env.VITE_API_URL || "/api/v1";
let activeProfileId = localStorage.getItem("calendar-profile-id") || "";

export function setActiveProfileId(profileId) {
    activeProfileId = profileId || "";
}

export async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(activeProfileId ? { "X-Calendar-Profile": activeProfileId } : {}),
            ...options.headers,
        },
    });
    if (response.status === 204) return null;
    const contentType = response.headers?.get?.("content-type") || "";
    const payload = contentType.includes("application/json") || !response.headers
        ? await response.json()
        : null;
    if (!response.ok) throw new Error(payload?.error?.message || `Calendar service returned ${response.status}.`);
    if (!payload || !("data" in payload)) throw new Error("Calendar service returned an invalid response.");
    return payload.data;
}
