import { loginGuest } from "@/lib/server/day0-service";
import { jsonError, jsonOk, optionsResponse, readJson } from "@/lib/server/http";

export const runtime = "nodejs";

type GuestLoginBody = {
  guestToken?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<GuestLoginBody>(request);
    const account = await loginGuest(body.guestToken);
    return jsonOk({ account });
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
