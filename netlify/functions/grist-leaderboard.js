// netlify/functions/grist-leaderboard.js

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { GRIST_API_KEY, GRIST_DOC_ID } = process.env;
  const GRIST_BASE = process.env.GRIST_BASE || "https://docs.getgrist.com";

  // Table names can be env vars or hard-coded
  const SESSIONS_TABLE = process.env.GRIST_SESSIONS_TABLE || "sessions";
  const ROLLS_TABLE = process.env.GRIST_ROLLS_TABLE || "rolls";

  if (!GRIST_API_KEY || !GRIST_DOC_ID) {
    return new Response("Grist not configured", { status: 500 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { action, sessionId, user, dieSides, result } = payload || {};

  if (!action || !sessionId) {
    return new Response("Missing action or sessionId", { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${GRIST_API_KEY}`,
    "Content-Type": "application/json",
  };

  const postRecord = async (tableId, fields) => {
    const url = `${GRIST_BASE}/api/docs/${GRIST_DOC_ID}/tables/${tableId}/records`;
    const body = JSON.stringify({ records: [{ fields }] });

    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Grist error:", res.status, text);
      throw new Error(`Grist error for table ${tableId}`);
    }
  };

  try {
    if (action === "start") {
      // One row per new session
      await postRecord(SESSIONS_TABLE, {
        sessionId,
        username: user,
        dieSides,
        action,
      });
    } else if (action === "roll") {
      // One row per roll
      await postRecord(ROLLS_TABLE, {
        sessionId,
        result, // "red" or "green"
      });
    } else {
      // For now, ignore "end"/"win"/others on the backend
      // You can add status logic here later if you add columns.
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
