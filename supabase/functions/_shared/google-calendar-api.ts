/**
 * Google Calendar API Helper Module
 */

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole: string;
  selected?: boolean;
  deleted?: boolean;
}

export interface GoogleCalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendar[];
}

export async function listCalendars(
  accessToken: string,
  pageToken?: string,
): Promise<GoogleCalendarListResponse> {
  const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");

  if (pageToken) url.searchParams.set("pageToken", pageToken);
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("showHidden", "false");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${response.status} ${error}`);
  }

  return await response.json();
}

export async function listAllCalendars(
  accessToken: string,
): Promise<GoogleCalendar[]> {
  const allCalendars: GoogleCalendar[] = [];
  let pageToken: string | undefined;

  do {
    const response = await listCalendars(accessToken, pageToken);
    allCalendars.push(...response.items);
    pageToken = response.nextPageToken;
  } while (pageToken);

  return allCalendars;
}