import type { Response } from "express";

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  res: Response,
  message: string,
  code: string = "INTERNAL_SERVER_ERROR",
  statusCode: number = 500
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
