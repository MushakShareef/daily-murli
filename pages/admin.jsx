// pages/admin.jsx
import React, { useState } from "react";
import dayjs from "dayjs";

export default function Admin() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    const token = prompt("Enter admin token (use ADMIN_TOKEN env value)"); // simple dev auth
    if (!token) return;
    const res = await fetch("/api/murli", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, content, metadata: { morning_murli: "प्रात:मुरली" }, adminToken: token })
    });
    const j = await res.json();
    if (res.ok) setMessage("Saved!");
    else setMessage("Error: " + JSON.stringify(j));
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h2>Admin — paste Murli</h2>
      <div style={{ marginBottom: 8 }}>
        <label>Date: </label>
        <input value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label>Murli content (HTML allowed):</label>
        <textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} style={{ width: "100%" }} />
      </div>
      <button onClick={save} style={{ marginTop: 8 }}>Save</button>
      <div style={{ marginTop: 12 }}>{message}</div>
    </div>
  );
}
