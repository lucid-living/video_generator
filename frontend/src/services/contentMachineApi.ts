/**
 * Service for integrating with Content Machine API to fetch channel information.
 */

const CONTENT_MACHINE_API_URL = import.meta.env.VITE_CONTENT_MACHINE_API_URL || "";

export interface Channel {
  id: string;
  name: string;
  channel_type?: string;
  channel_link?: string;
  youtube_channel_id?: string;
  youtube_account_email?: string;
  instagram_handle?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all channels from Content Machine.
 */
export async function fetchChannels(): Promise<Channel[]> {
  if (!CONTENT_MACHINE_API_URL) {
    console.warn("Content Machine API URL not configured. Set VITE_CONTENT_MACHINE_API_URL environment variable.");
    return [];
  }

  try {
    const response = await fetch(`${CONTENT_MACHINE_API_URL}/api/channels`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.statusText}`);
    }

    const channels = await response.json();
    return channels;
  } catch (error) {
    console.error("Error fetching channels from Content Machine:", error);
    throw error;
  }
}

/**
 * Fetch a specific channel by ID from Content Machine.
 */
export async function fetchChannel(channelId: string): Promise<Channel | null> {
  if (!CONTENT_MACHINE_API_URL) {
    console.warn("Content Machine API URL not configured.");
    return null;
  }

  try {
    const response = await fetch(`${CONTENT_MACHINE_API_URL}/api/channels/${channelId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch channel: ${response.statusText}`);
    }

    const channel = await response.json();
    return channel;
  } catch (error) {
    console.error("Error fetching channel from Content Machine:", error);
    throw error;
  }
}

/**
 * Check if Content Machine integration is available.
 */
export function isContentMachineAvailable(): boolean {
  return !!CONTENT_MACHINE_API_URL && CONTENT_MACHINE_API_URL.trim() !== "";
}
