export function utcStampCompact() {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

export function downloadJsonFile(filename, text, contentType = "application/json") {
  const blob = new Blob([text], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function createCalendarExportEnvelope(state, clonePlain) {
  let calendarPayload = {
    inputs: { ...state.inputs },
    ui: { ...state.ui },
  };
  if (Array.isArray(state?._allProfiles) && state._allProfiles.length) {
    const profiles = state._allProfiles.map((profile, idx) => ({
      id: String(profile?.id || `cal-${idx + 1}`),
      name: String(profile?.name || profile?.ui?.calendarName || `Calendar ${idx + 1}`),
      inputs: clonePlain(profile?.inputs || {}),
      ui: clonePlain(profile?.ui || {}),
    }));
    calendarPayload = {
      activeProfileId: String(state.profileId || profiles[0]?.id || "cal-1"),
      profiles,
    };
  }
  return {
    tool: "WorldSmith Web",
    type: "calendar",
    calendarSchemaVersion: 2,
    exportedUtc: new Date().toISOString(),
    calendar: calendarPayload,
  };
}

export function readCalendarCandidate(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.calendar && typeof parsed.calendar === "object") return parsed.calendar;
  if (parsed.world && parsed.world.calendar && typeof parsed.world.calendar === "object") {
    return parsed.world.calendar;
  }
  if (parsed.inputs || parsed.ui || parsed.specialDays || parsed.holidays || parsed.leapRules) {
    return parsed;
  }
  return null;
}
