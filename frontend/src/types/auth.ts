export interface LoginCredentials {
  vendorId: string;
  accessKey: string;
  secretKey: string;
}

export interface LoginResponse {
  token: string;
  vendor_id: string;
  expires_at: number;
}

export interface User {
  vendorId: string;
  accessKey: string;
  secretKey: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}
