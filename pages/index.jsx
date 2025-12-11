// pages/index.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Header from "../components/Header";
import DateNav from "../components/DateNav";
import MurliDisplay from "../components/MurliDisplay";
import SelectionTranslator from "../components/SelectionTranslator";
import dayjs from "dayjs";

export default function Home() {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [murli, setMurli] = useState(null);
  const [language, setLanguage] = useState(process.env.NEXT_PUBLIC_PRIMARY_LANGUAGE || "Tamil");

  const fetchMurli = async (d) => {
    try {
      const res = await fetch(`/api/murli?date=${d}`);
      if (!res.ok) {
        setMurli(null);
        return;
      }
      const json = await res.json();
      setMurli(json);
    } catch (e) {
      setMurli(null);
    }
  };

  useEffect(() => {
    fetchMurli(date);
  }, [date]);

  return (
    <>
      <Head>
         <meta name="google" content="notranslate" />
      </Head>

      <Header onTodayClick={() => setDate(dayjs().format("YYYY-MM-DD"))} language={language} onLanguageChange={(l) => setLanguage(l)} />

      <main style={{ paddingTop: 8 }}>
        <DateNav date={date} setDate={setDate} />
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 14, color: "#222", fontWeight: 700 }}>
              {murli ? (murli.metadata?.morning_murli || "प्रात:मुरली") : "प्रात:मुरली"}
            </div>
            <div style={{ color: "#666", marginTop: 6 }}>ओम् शान्ति • बापदादा • मधुबन</div>
          </div>

          <MurliDisplay murliHtml={murli ? (murli.content || "") : null} />
        </div>

        <SelectionTranslator primaryLanguage={language} />
      </main>
    </>
  );
}
