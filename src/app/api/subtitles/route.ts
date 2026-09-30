import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") || "ar";

  const vttAr = `WEBVTT

00:00:00.500 --> 00:00:05.000
مرحباً بكم في منصة NAZMOVIES — أفلام ناز السينمائية

00:00:05.200 --> 00:00:11.000
أنت تشاهد الآن البث الفائق بدقة 4K Ultra HD عبر خوادم أفلام ناز

00:00:11.200 --> 00:00:18.000
يمكنك التبديل بين 6 سيرفرات تشغيل مختلفة في أي وقت من شريط المشغل

00:00:18.200 --> 00:00:25.000
نتمنى لكم سهرة سينمائية ممتعة على NAZMOVIES
`;

  const vttEn = `WEBVTT

00:00:00.500 --> 00:00:05.000
Welcome to NAZMOVIES — Naz Movies Luxury Cinema

00:00:05.200 --> 00:00:11.000
Now streaming in 4K Ultra HD via NAZMOVIES Multi-Server CDN

00:00:11.200 --> 00:00:18.000
Switch between 6 video servers anytime from the player toolbar

00:00:18.200 --> 00:00:25.000
Enjoy an unforgettable cinema experience on NAZMOVIES
`;

  return new NextResponse(lang === "en" ? vttEn : vttAr, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
