import { requireSession } from "@/lib/auth/guards";
import { toHttpError } from "@/lib/http/errors";

export async function GET() {
  try {
    const session = await requireSession();
    return Response.json({
      ok: true,
      me: {
        id: session.userId,
        name: session.name,
        isAdmin: session.isAdmin,
      },
    });
  } catch (e) {
    return toHttpError(e);
  }
}
