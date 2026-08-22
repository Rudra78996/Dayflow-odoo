import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { signupSchema, loginSchema, verifyEmailSchema, refreshTokenSchema } from "./auth.schema.js";
import { sendSuccess, AppError } from "../../utils/response.js";

export class AuthController {
  static async signup(req: Request, res: Response) {
    const validatedData = signupSchema.parse(req.body);
    const result = await AuthService.signup(validatedData);
    return sendSuccess(res, result, 201);
  }

  static async verifyEmail(req: Request, res: Response) {
    const validatedQuery = verifyEmailSchema.parse(req.query);
    const result = await AuthService.verifyEmail(validatedQuery.token);
    return sendSuccess(res, result, 200);
  }

  static async login(req: Request, res: Response) {
    const validatedData = loginSchema.parse(req.body);
    const result = await AuthService.login(validatedData);
    return sendSuccess(res, result, 200);
  }

  static async refresh(req: Request, res: Response) {
    let token = req.body.refresh_token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    const validatedData = refreshTokenSchema.parse({ refresh_token: token });
    const result = await AuthService.refreshToken(validatedData.refresh_token);
    return sendSuccess(res, result, 200);
  }

  static async logout(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await AuthService.logout(req.user.userId);
    return sendSuccess(res, result, 200);
  }

  static async me(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    }

    const result = await AuthService.getCurrentUser(req.user.userId);
    return sendSuccess(res, result, 200);
  }
}
