import { NextResponse } from "next/server";

export async function middleware(req) {
  const url = req.nextUrl.clone();

  // Jangan blok halaman blocked itu sendiri
  if (url.pathname.startsWith("/blocked")) {
    return NextResponse.next();
  }

  // Call backend IP guard
  const res = await fetch(
    "https://api.vinzzyy.my.id/api/ip-guard",
    {
      method: "POST",
      headers: {
        "x-forwarded-for": req.ip || ""
      }
    }
  );

  // Kalau diblok
  if (res.status === 403) {
    url.pathname = "/blocked/";
    return NextResponse.redirect(url);
  }

  // Aman → lanjut
  return NextResponse.next();
}
