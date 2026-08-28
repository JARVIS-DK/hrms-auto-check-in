import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleAdminError } from "@/lib/middleware/adminAuth";
import {
  createInvite,
  getInvitesCollection,
  inviteStatus,
  revokeInvite,
  INVITE_TTL_DAYS,
} from "@/lib/models/invite";
import { sendInviteEmail } from "@/lib/mail";
import { emailIsTaken, isValidEmail, normalizeEmail } from "@/lib/account";

const ROUTE = "/admin/invites";

export async function GET() {
  try {
    await requireAdmin();

    const col = await getInvitesCollection();
    const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();

    return NextResponse.json({
      invites: docs.map((i) => ({
        token: i.token,
        email: i.email,
        invitedByName: i.invitedByName,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        usedAt: i.usedAt ?? null,
        status: inviteStatus(i),
      })),
    });
  } catch (err) {
    return handleAdminError(ROUTE, err, { invites: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await req.json();
    const email = normalizeEmail(body.email);
    const sendEmail = body.sendEmail !== false;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (await emailIsTaken(email)) {
      return NextResponse.json(
        { error: "An account already exists for this email" },
        { status: 409 }
      );
    }

    const invite = await createInvite(email, admin.userId, admin.name);
    const inviteUrl = `${req.nextUrl.origin}/register?invite=${invite.token}`;

    if (sendEmail) {
      await sendInviteEmail(email, inviteUrl, admin.name, INVITE_TTL_DAYS);
    }

    return NextResponse.json({
      success: true,
      invite: {
        token: invite.token,
        email: invite.email,
        url: inviteUrl,
        expiresAt: invite.expiresAt,
        status: "pending" as const,
      },
      emailSent: sendEmail,
    });
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();

    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "token param required" }, { status: 400 });
    }

    const revoked = await revokeInvite(token);
    if (!revoked) {
      return NextResponse.json(
        { error: "Invite is already used, revoked, or does not exist" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleAdminError(ROUTE, err);
  }
}
