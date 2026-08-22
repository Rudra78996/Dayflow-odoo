import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./response.js";

export interface JwtPayload {
  userId: string;
  email: string;
  role: "employee" | "admin";
  employeeId: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch (error) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
  }
}
