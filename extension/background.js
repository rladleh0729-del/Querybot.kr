const NATIVE_HOST = "com.youtube_flac.converter";

console.log("QueryBot Audio Converter background started");

function friendlyNativeError(error) {
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("native messaging host not found") ||
    lower.includes("specified native messaging host not found") ||
    lower.includes("host not found") ||
    lower.includes("not registered") ||
    lower.includes("access to the specified native messaging host is forbidden")
  ) {
    return {
      code: "NATIVE_HOST_MISSING",
      message: "QueryBot Windows component is not installed or not registered."
    };
  }

  return { code: "NATIVE_ERROR", message: raw || "Native messaging error" };
}

function isSuccessResponse(data) {
  if (!data || typeof data !== "object") return false;
  if (data.ok === true || data.success === true) return true;
  const status = String(data.status || "").trim().toLowerCase();
  return ["success","ok","connected","ready","completed","complete","done"].includes(status);
}

async function callNative(action, data = {}) {
  try {
    const response = await chrome.runtime.sendNativeMessage(
      NATIVE_HOST,
      { action, data }
    );
    if (!response) throw new Error("Empty native host response");
    return response;
  } catch (error) {
    const friendly = friendlyNativeError(error);
    return {
      status: "error",
      code: friendly.code,
      message: friendly.message,
      raw_error: String(error?.message || error || "")
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) {
      sendResponse({ status: "error", message: "Invalid message" });
      return;
    }

    if (message.type === "EXTRACT_FLAC") {
      const data = await callNative("extract", message.data || {});
      sendResponse({ status: isSuccessResponse(data) ? "success" : "error", data });
      return;
    }

    if (message.type === "NATIVE_PING") {
      const data = await callNative("ping", {});
      sendResponse({ status: isSuccessResponse(data) ? "success" : "error", data });
      return;
    }

    if (message.type === "OPEN_FOLDER") {
      const data = await callNative("open_folder", {});
      sendResponse({ status: isSuccessResponse(data) ? "success" : "error", data });
      return;
    }

    sendResponse({ status: "error", message: "Unsupported message type" });
  })();

  return true;
});
