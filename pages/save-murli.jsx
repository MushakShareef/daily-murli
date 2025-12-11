export default function SaveMurli() {
  const save = async () => {
    const res = await fetch("/api/murli", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2025-12-10",
        metadata: {
          morning_murli: "प्रात:मुरली",
          om_shanti: "ओम् शान्ति",
          bapdada: "बापदादा",
          madhuban: "मधुबन"
        },
        content:
          "<p>ओम् शान्ति। यह एक परीक्षण मुरली है। आप इसका कुछ हिस्सा चुनकर उसके पास अनुवाद दिखाई देगा।</p><p>बापदादा का शुभ संदेश।</p>",
        adminToken: "devsecret"
      })
    });

    const data = await res.json();
    alert("Result: " + JSON.stringify(data));
  };

  return (
    <div style={{ padding: 50 }}>
      <h1>Save Murli Helper Page</h1>
      <p>Click the button below to save the Murli automatically.</p>
      <button
        onClick={save}
        style={{
          padding: "10px 20px",
          background: "black",
          color: "white",
          borderRadius: 6,
          fontSize: 16
        }}
      >
        SAVE MURLI NOW
      </button>
    </div>
  );
}
