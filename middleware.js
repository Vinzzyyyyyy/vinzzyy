import { NextResponse } from "next/server";

export function middleware(req) {
  const url = req.nextUrl.clone();

  // Jangan loop-block halaman blocked sendiri
  if (url.pathname.startsWith("/blocked")) {
    return NextResponse.next();
  }

  return fetch("https://api.vinzzyy.my.id/api/ip-guard", {
    method: "POST",
    headers: {
      "x-forwarded-for": req.ip || ""
    }
  }).then(res => {
    if (res.status === 403) {
      url.pathname = "/blocked";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  });
}

/* ⬇️ INI MATCHER-NYA */
export const config = {
  matcher: "/((?!_next|api|favicon.ico).*)"
};
