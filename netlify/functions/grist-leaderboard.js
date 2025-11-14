// netlify/functions/grist-leaderboard.js

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { GRIST_API_KEY, GRIST_DOC_ID } = process.env;
  const GRIST_BASE = process.env.GRIST_BASE || "https://docs.getgrist.com";

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
      console.error("Grist POST error:", res.status, text);
      throw new Error(`Grist POST error for table ${tableId}`);
    }
  };

  const updateSessionAction = async (sessionId, newAction) => {
    // Find session row by sessionId
    const filter = encodeURIComponent(
      JSON.stringify({ sessionId: [sessionId] })
    );
    const findUrl = `${GRIST_BASE}/api/docs/${GRIST_DOC_ID}/tables/${SESSIONS_TABLE}/records?filter=${filter}`;

    const foundRes = await fetch(findUrl, { headers });
    if (!foundRes.ok) {
      const text = await foundRes.text();
      console.error("Grist FIND error:", foundRes.status, text);
      throw new Error("Grist FIND error");
    }

    const found = await foundRes.json();
    const records = found.records || [];

    if (records.length === 0) {
      // Fallback: if somehow start wasn't recorded, create a new session row
      await postRecord(SESSIONS_TABLE, {
        sessionId,
        username: user,
        dieSides,
        action: newAction,
      });
      return;
    }

    const id = records[0].id;
    const patchUrl = `${GRIST_BASE}/api/docs/${GRIST_DOC_ID}/tables/${SESSIONS_TABLE}/records`;
    const patchBody = JSON.stringify({
      records: [{ id, fields: { action: newAction } }],
    });

    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers,
      body: patchBody,
    });

    if (!patchRes.ok) {
      const text = await patchRes.text();
      console.error("Grist PATCH error:", patchRes.status, text);
      throw new Error("Grist PATCH error");
    }
  };

  try {
    if (action === "start") {
      // One row per new session
      await postRecord(SESSIONS_TABLE, {
        sessionId,
        username: user,
        dieSides,
        action: "start",
      });
    } else if (action === "roll") {
      // One row per roll
      await postRecord(ROLLS_TABLE, {
        sessionId,
        result, // "red" or "green"
      });
    } else {
      // Any other action updates the `action` column on the session row
      await updateSessionAction(sessionId, action);
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
