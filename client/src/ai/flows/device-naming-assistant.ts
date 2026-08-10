// Stub for removed Genkit integration. Phase 1 keeps the component building without Firebase/Genkit deps.
// Phase 2 can replace with local naming heuristic or remove the component entirely.
export async function deviceNamingAssistant(input: {
  deviceType: string;
  existingDeviceNames: string[];
}): Promise<{ suggestedNames: string[] }> {
  void input;
  return { suggestedNames: [] };
}
