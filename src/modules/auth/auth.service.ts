import crypto from "crypto";
import { eq, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, employeeProfiles } from "../../db/Schema/index.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { AppError } from "../../utils/response.js";
import type { SignupInput, LoginInput } from "./auth.schema.js";

export class AuthService {
  static async signup(data: SignupInput) {
    // Check if email or employee_id already exists
    const existingUser = await db.query.users.findFirst({
      where: or(
        eq(users.email, data.email),
        eq(users.employeeId, data.employee_id)
      ),
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new AppError(409, "EMAIL_EXISTS", "User with this email already exists");
      }
      if (existingUser.employeeId === data.employee_id) {
        throw new AppError(409, "EMPLOYEE_ID_EXISTS", "User with this employee ID already exists");
      }
    }

    const passwordHash = await hashPassword(data.password);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const [newUser] = await db
      .insert(users)
      .values({
        employeeId: data.employee_id,
        email: data.email,
        passwordHash,
        role: data.role || "employee",
        isVerified: false,
        verificationToken,
      })
      .returning();

    if (!newUser) {
      throw new AppError(500, "SIGNUP_FAILED", "Failed to create user");
    }

    const fullName = data.full_name || data.email.split("@")[0] || "Employee";

    await db.insert(employeeProfiles).values({
      userId: newUser.id,
      fullName,
    });

    return {
      user_id: newUser.id,
      verification_token: verificationToken,
      message: "Verification email sent",
    };
  }

  static async verifyEmail(token: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.verificationToken, token),
    });

    if (!user) {
      throw new AppError(400, "INVALID_TOKEN", "Invalid or expired verification token");
    }

    await db
      .update(users)
      .set({
        isVerified: true,
        verificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { message: "Email verified" };
  }

  static async login(data: LoginInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    });

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    if (!user.isVerified) {
      throw new AppError(
        403,
        "EMAIL_NOT_VERIFIED",
        "Email is not verified. Please verify your email before logging in."
      );
    }

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    await db
      .update(users)
      .set({
        refreshToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const profile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, user.id),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        role: user.role,
        full_name: profile?.fullName || "",
        employee_id: user.employeeId,
        email: user.email,
      },
    };
  }

  static async refreshToken(token: string) {
    const payload = verifyRefreshToken(token);

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!user || user.refreshToken !== token) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or has been revoked");
    }

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    const newAccessToken = generateAccessToken(jwtPayload);
    const newRefreshToken = generateRefreshToken(jwtPayload);

    await db
      .update(users)
      .set({
        refreshToken: newRefreshToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await db
      .update(users)
      .set({
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { message: "Logged out successfully" };
  }

  static async getCurrentUser(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const profile = await db.query.employeeProfiles.findFirst({
      where: eq(employeeProfiles.userId, user.id),
    });

    return {
      user: {
        id: user.id,
        employee_id: user.employeeId,
        email: user.email,
        role: user.role,
        is_verified: user.isVerified,
        full_name: profile?.fullName || "",
        phone: profile?.phone || null,
        address: profile?.address || null,
        profile_picture_url: profile?.profilePictureUrl || null,
        designation: profile?.designation || null,
        department: profile?.department || null,
        date_of_joining: profile?.dateOfJoining || null,
        employment_type: profile?.employmentType || null,
      },
    };
  }
}
