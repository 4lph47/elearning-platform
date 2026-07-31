import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Páginas onde uma conta ainda por registar (Google/link mágico que ainda
// não aceitou os termos em /register/complete) pode estar — tudo o resto
// fica trancado até lá. /api fica de fora porque o próprio
// /register/complete depende de chamar /api/account/complete-registration
// (ou become-instructor) para se conseguir destrancar.
const ALLOWED_WHEN_UNREGISTERED = ["/register", "/register/complete", "/login", "/termos", "/privacidade"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    ALLOWED_WHEN_UNREGISTERED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  // secureCookie por defeito tenta adivinhar a partir do pedido, mas atrás
  // do proxy da Vercel isso às vezes desalinha com o cookie __Secure- que a
  // própria rota de auth usou ao criar a sessão -- getToken() devolvia null
  // (não token.registered === false, null mesmo) e o gate abaixo nem entrava,
  // deixando contas por registar passarem direto pra qualquer página.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });
  // token.registered só existe (true/false) em sessões emitidas depois
  // desta feature — sessões antigas (sem o campo) passam livremente até
  // rodarem/relogarem, nunca ficam trancadas por um campo que nunca tiveram.
  if (token && token.registered === false) {
    const url = request.nextUrl.clone();
    url.pathname = "/register/complete";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
