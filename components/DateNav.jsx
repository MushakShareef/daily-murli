// components/DateNav.jsx
import React from "react";
import dayjs from "dayjs";

export default function DateNav({ date, setDate }) {
  const prev = () => setDate(dayjs(date).subtract(1, "day").format("YYYY-MM-DD"));
  const next = () => setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"));
  const today = () => setDate(dayjs().format("YYYY-MM-DD"));

  const devanagariDate = (d) => {
    // simple mapping for date display; for full Devanagari numerals you can extend
    return dayjs(d).format("DD MMMM YYYY");
  };

  return (
    <div style={{ maxWidth: 960, margin: "12px auto", display: "flex", alignItems: "center", gap: 8, padding: "0 12px" }}>
      <button onClick={prev} aria-label="Previous day">←</button>
      <button onClick={next} aria-label="Next day">→</button>
      <button onClick={today} aria-label="Today">Today</button>
      <div style={{ marginLeft: 12, fontWeight: 600 }}>{devanagariDate(date)}</div>
    </div>
  )
}
