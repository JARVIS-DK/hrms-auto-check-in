const BASE_URL = "https://sopl.vprocure.com";

/**
 * A hung HRMS request would otherwise consume the whole 60s function budget
 * and starve every user later in the batch.
 */
const REQUEST_TIMEOUT_MS = 10_000;

function timeout() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

const COMMON_HEADERS = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "accept-language": "en-GB,en;q=0.6",
  origin: BASE_URL,
  referer: `${BASE_URL}/employee-checkin`,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "x-frappe-cmd": "employee_checkin",
  "x-frappe-csrf-token": "None",
  "x-requested-with": "XMLHttpRequest",
};

export interface HrmsSession {
  sid: string;
  fullName: string;
}

export interface CheckinState {
  checkins: { log_type: string; time: string }[];
  employee: string;
}

export async function hrmsLogin(
  email: string,
  password: string
): Promise<HrmsSession> {
  const res = await fetch(`${BASE_URL}/api/method/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: BASE_URL,
      "user-agent": COMMON_HEADERS["user-agent"],
    },
    body: JSON.stringify({ usr: email, pwd: password }),
    signal: timeout(),
  });

  if (!res.ok) {
    throw new Error(`HRMS login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.message !== "Logged In") {
    // Don't echo the raw body — it reaches logs and user-facing failure emails.
    throw new Error("HRMS login rejected — credentials may have changed");
  }

  return { sid: data.sid, fullName: data.full_name };
}

export async function hrmsGetState(session: HrmsSession): Promise<CheckinState> {
  const form = new FormData();
  form.append("action", "get_state");
  form.append("cmd", "employee_checkin");

  const res = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      Cookie: `sid=${session.sid}`,
    },
    body: form,
    signal: timeout(),
  });

  if (!res.ok) {
    throw new Error(`HRMS get_state failed: ${res.status}`);
  }

  const data = await res.json();
  const state = data.message as CheckinState | undefined;

  // Guard the shape: without this an unexpected response surfaces to the user
  // as "Cannot read properties of undefined" in a failure email.
  if (!state || !Array.isArray(state.checkins)) {
    throw new Error("HRMS get_state returned an unexpected response");
  }

  return state;
}

export async function hrmsCheckin(
  session: HrmsSession,
  lat: string,
  lng: string,
  logType: "IN" | "OUT"
): Promise<{ success: boolean; time?: string; raw: unknown }> {
  const form = new FormData();
  form.append("action", "mark");
  form.append("cmd", "employee_checkin");
  form.append("log_type", logType);
  form.append("lat", lat);
  form.append("lng", lng);

  const res = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      Cookie: `sid=${session.sid}`,
    },
    body: form,
    signal: timeout(),
  });

  if (!res.ok) {
    return { success: false, raw: { status: res.status, text: await res.text() } };
  }

  const data = await res.json();
  const success = data.message?.status === "success";
  return { success, time: data.message?.time, raw: data };
}
