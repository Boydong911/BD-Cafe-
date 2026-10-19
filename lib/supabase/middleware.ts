import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Seat } from "@/lib/supabase/seats";
import { seatAuthOptions } from "@/lib/supabase/seats";

// Seat menentukan cookie mana yang dipakai (lihat lib/supabase/seats.ts).
// Middleware menerima seat dari middleware.ts, yang memilihnya dari pathname.
export function createMiddlewareClient(request: NextRequest, seat: Seat = "owner") {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
      ...seatAuthOptions(seat),
    }
  )

  return { supabase, response }
}