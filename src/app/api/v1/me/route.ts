import { apiRoute, ok } from "@/server/api/handler";
import { settingsDto } from "@/server/api/dto/me";

export const GET = apiRoute(async ({ userId, email, name, today, settings }) => ok({ user: { id: userId, email, name }, today, settings: settingsDto(settings) }));
