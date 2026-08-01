import axiosLayer from "./axiosLayer";
import fpPromise from '@fingerprintjs/fingerprintjs';

const getFingerprint = async (): Promise<string> => {
  const fp = await fpPromise.load();
  const result = await fp.get();
  return result.visitorId;
};

interface ApiResponse<T = unknown> {
  status: "success" | "error";
  data?: T;
  error?: string;
}

interface LoginData {
  auth_status: "logged_in" | "mfa_required";
  mfa_setup_required: boolean;
}

export interface LoginResponse {
  auth_status: "logged_in" | "mfa_required";
  mfa_setup_required: boolean;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
    const device_id = await getFingerprint();
    const res = await axiosLayer.post<ApiResponse<LoginData>>(
      "/login",
      { username, password, device_id },
      { headers: { "Content-Type": "application/json" } }
    );
    if (res.data.status !== "success" || !res.data.data) {
      throw new Error(res.data.error ?? "Login failed");
    }
    return res.data.data;
};

export const verifyMfa = async (code: string): Promise<LoginResponse> => {
    const device_id = await getFingerprint();
    const res = await axiosLayer.post<ApiResponse<LoginData>>(
      "/mfa/verify",
      { code, device_id },
      { headers: { "Content-Type": "application/json" } }
    );
    if (res.data.status !== "success" || !res.data.data) {
      throw new Error(res.data.error ?? "MFA verification failed");
    }
    return res.data.data;
};

export interface MfaSetupResponse {
  secret: string;
  url: string;
}

export interface MfaEnableResponse {
  recovery_codes: string[];
}

export const setupMfa = async (): Promise<MfaSetupResponse> => {
    const res = await axiosLayer.post<ApiResponse<MfaSetupResponse>>("/auth/mfa/setup");
    if (res.data.status !== "success" || !res.data.data) {
      throw new Error(res.data.error ?? "MFA setup failed");
    }
    return res.data.data;
};

export const enableMfa = async (code: string): Promise<MfaEnableResponse> => {
    const res = await axiosLayer.post<ApiResponse<MfaEnableResponse>>(
      "/auth/mfa/confirm",
      { code },
      { headers: { "Content-Type": "application/json" } }
    );
    if (res.data.status !== "success" || !res.data.data) {
      throw new Error(res.data.error ?? "MFA enable failed");
    }
    return res.data.data;
};

export const verifyMfaRecovery = async (code: string): Promise<LoginResponse> => {
    const device_id = await getFingerprint();
    const res = await axiosLayer.post<ApiResponse<LoginData>>(
      "/mfa/recovery",
      { recovery_code: code, device_id },
      { headers: { "Content-Type": "application/json" } }
    );
    if (res.data.status !== "success" || !res.data.data) {
      throw new Error(res.data.error ?? "Recovery failed");
    }
    return res.data.data;
};

export const getMe = async (): Promise<{ username: string; role: string }> => {
  const res = await axiosLayer.get<ApiResponse<{ username: string; role: string }>>("/auth/me");
  if (res.data.status !== "success" || !res.data.data) {
    throw new Error(res.data.error ?? "Not authenticated");
  }
  return res.data.data;
};

export const checkAuthStatus = async (): Promise<{ username: string; role: string }> => {
  const res = await axiosLayer.get<ApiResponse<{ username: string; role: string }>>("/auth/me");
  if (res.data.status !== "success" || !res.data.data) {
    throw new Error(res.data.error ?? "Not authenticated");
  }
  return res.data.data;
};

export const logout = async (): Promise<void> => {
  await axiosLayer.post("/logout");
};

export interface SetupStatusResponse {
  setup_required: boolean;
}

export const getSetupStatus = async (): Promise<SetupStatusResponse> => {
  const res = await axiosLayer.get<ApiResponse<SetupStatusResponse>>("/setup/status");
  if (res.data.status !== "success" || !res.data.data) {
    throw new Error(res.data.error ?? "Failed to get setup status");
  }
  return res.data.data;
};

export const setupAdmin = async (username: string, password: string): Promise<void> => {
  const res = await axiosLayer.post<ApiResponse>(
    "/admin/provision",
    { username, password },
    { headers: { "Content-Type": "application/json" } }
  );
  if (res.data.status !== "success") {
    throw new Error(res.data.error ?? "Setup failed");
  }
};
