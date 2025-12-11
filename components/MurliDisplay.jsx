// components/MurliDisplay.jsx
import React from "react";

export default function MurliDisplay({ murliHtml }) {
  return (
    <article id="murli-content-area" style={{ padding: "16px", maxWidth: 960, margin: "0 auto", fontFamily: "'Noto Sans Devanagari', sans-serif", color: "#000", background: "#fff" }}>
      {/* If murliHtml is plain text, render paragraphs, otherwise trust HTML (sanitization recommended) */}
      {murliHtml ? (
        <div dangerouslySetInnerHTML={{ __html: murliHtml }} />
      ) : (
        <p style={{ color: "#666" }}>No Murli content for this date.</p>
      )}
    </article>
  );
}
